import { useCallback, useRef } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { activityTypeLabels, type UnitContext } from '../../../shared/types/courses';
import { FallbackNotices } from '../components/FallbackNotices';
import { GenerationForm } from '../components/GenerationForm';
import { GenerationPlanView } from '../components/GenerationPlanView';
import { GenerationProgress } from '../components/GenerationProgress';
import { PlanErrorDetails } from '../components/PlanErrorDetails';
import { useGenerationPlan } from '../hooks/useGenerationPlan';
import { useGenerationRequest } from '../hooks/useGenerationRequest';
import { useProcessedMaterial } from '../hooks/useProcessedMaterial';
import { useResourceTypes } from '../hooks/useResourceTypes';
import { useStartGeneration } from '../hooks/useStartGeneration';
import type { GenerationError } from '../model/generationErrors';
import {
  planRequestFromGenerationBody, planRequestFromInputs, type CreateGenerationPlan,
} from '../model/generationPlan';
import { isTerminal, type GenerationRequestStatus, type StartGenerationRequest } from '../model/generationRequest';
import '../generation.css';

export function GenerationPage() {
  const context = useOutletContext<UnitContext>();
  // Con otra unidad, el estado y la consulta empiezan de cero.
  return <GenerationView key={context.unit.id} {...context} />;
}

function GenerationView({ course, unit, token, onSessionExpired }: UnitContext) {
  const audience = [
    course.educationLevel,
    course.academicCycle,
    course.activityType ? activityTypeLabels[course.activityType] : '',
  ].filter(Boolean).join(' · ');
  const catalog = useResourceTypes();
  const processedMaterial = useProcessedMaterial(token, unit.id, onSessionExpired);
  const tracking = useGenerationRequest({ unitId: unit.id, token, onSessionExpired });
  const plans = useGenerationPlan({ unitId: unit.id, token, onSessionExpired });
  const { track } = tracking;
  const { close: closePlan } = plans;
  // Al empezar la generación, el plan queda usado: se deja de mostrar y se sigue el pedido como siempre.
  const onStarted = useCallback((started: GenerationRequestStatus) => {
    track(started);
    closePlan();
  }, [track, closePlan]);
  const starting = useStartGeneration({ unitId: unit.id, token, onSessionExpired, onStarted });
  // Último cuerpo sin plan que se envió, para ofrecer «Planificar con estos datos» ante `PLAN_REQUIRED`.
  const lastBodyWithoutPlan = useRef<StartGenerationRequest | null>(null);
  const { request } = tracking;
  const running = !!request && !isTerminal(request.status);
  const ready = !running && !tracking.recovering && !plans.recovering;
  const plan = ready ? plans.plan : null;

  function startNew() {
    starting.clearError();
    tracking.reset();
  }

  function createPlan(body: CreateGenerationPlan) {
    starting.clearError();
    void plans.create(body);
  }

  function replan() {
    if (plans.plan) createPlan(planRequestFromInputs(plans.plan.unitId, plans.plan.inputs));
  }

  function planFromRejectedRequest() {
    if (lastBodyWithoutPlan.current) createPlan(planRequestFromGenerationBody(lastBodyWithoutPlan.current));
  }

  function reloadPlan() {
    starting.clearError();
    void plans.reload();
  }

  function closePlanView() {
    starting.clearError();
    plans.close();
  }

  function generateWithPlan() {
    if (plan) void starting.start({ planId: plan.id, planVersion: plan.version });
  }

  return (
    <div className="stack stack--loose">
      <p className="muted">
        Genera recursos para «{unit.title}» de {course.name} a partir del material procesado de la unidad.
        Lo generado pasa a Revisión.
      </p>

      {tracking.recovering && !request && <p className="muted" role="status">Buscando pedidos en curso…</p>}
      {plans.recovering && !tracking.recovering && !running && (
        <p className="muted" role="status">Buscando el último plan de la unidad…</p>
      )}

      {ready && processedMaterial === false && starting.error?.kind !== 'noMaterial' && (
        <div className="alert alert--warn" role="status">
          <p>Esta unidad todavía no tiene material procesado.</p>
          <p><Link to="../material">Ir a la pestaña Material</Link></p>
        </div>
      )}

      {ready && (
        // Se oculta, sin desmontarse, mientras se revisa el plan: al volver, el formulario conserva sus valores.
        <div className="generation-form-area" hidden={plan !== null}>
          <GenerationForm unit={unit} defaultAudience={audience} catalog={catalog} token={token} onSessionExpired={onSessionExpired}
            submitting={starting.submitting} planning={plans.busy === 'creating'} onPlan={createPlan}
            onSubmit={(body) => {
              lastBodyWithoutPlan.current = body;
              void starting.start(body);
            }} />
          {plans.error && !plan && (
            <div className="alert alert--warn" role="alert">
              <div className="stack generation-notice">
                <p>{plans.error.message}</p>
                <PlanErrorDetails error={plans.error} busy={plans.busy !== null} />
              </div>
            </div>
          )}
        </div>
      )}

      {plan && (
        <GenerationPlanView key={`${plan.id}:${plan.version}:${plan.status}`} plan={plan} unit={unit}
          resourceTypes={catalog.types} busy={plans.busy} generating={starting.submitting} error={plans.error}
          onSave={(body) => void plans.save(body)} onApprove={() => void plans.approve()} onGenerate={generateWithPlan}
          onReload={reloadPlan} onReplan={replan} onClose={closePlanView} />
      )}

      {starting.error && (
        <StartErrorNotice error={starting.error} submitting={starting.submitting || plans.busy !== null}
          onRetry={starting.retry} onStartFresh={starting.startFresh}
          onReloadPlan={plan ? reloadPlan : undefined} onReplan={plans.plan ? replan : undefined}
          onPlan={lastBodyWithoutPlan.current ? planFromRejectedRequest : undefined}
          onClosePlan={plan ? closePlanView : undefined} />
      )}

      {tracking.error && (
        <p className="alert alert--warn" role="alert">
          {tracking.error.kind === 'network'
            ? 'Se perdió la conexión al consultar el pedido. Seguimos intentándolo.'
            : tracking.error.message}
        </p>
      )}

      {request && (
        <>
          <FallbackNotices retrievalMode={request.retrievalMode} steps={request.steps} resourceTypes={catalog.types} />
          <GenerationProgress request={request} resourceTypes={catalog.types} onStartNew={startNew} />
          {isTerminal(request.status) && request.status !== 'interrupted' && (
            <div className="course-actions">
              <Link className="btn btn--primary" to="../review">Ir a Revisión</Link>
              <button className="btn" type="button" onClick={startNew}>Ocultar este resultado</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface StartErrorNoticeProps {
  error: GenerationError;
  submitting: boolean;
  onRetry: () => void;
  onStartFresh: () => void;
  /** Errores del plan al generar con él (specs/006). */
  onReloadPlan?: () => void;
  onReplan?: () => void;
  onPlan?: () => void;
  onClosePlan?: () => void;
}

export function StartErrorNotice({
  error, submitting, onRetry, onStartFresh, onReloadPlan, onReplan, onPlan, onClosePlan,
}: StartErrorNoticeProps) {
  return (
    <div className="alert alert--warn" role="alert">
      <div className="stack generation-notice">
        <p>{error.message}</p>
        {error.kind === 'network' && (
          <>
            <p>El pedido se puede reenviar sin duplicarse.</p>
            <div><button className="btn" type="button" disabled={submitting} onClick={onRetry}>Reintentar</button></div>
          </>
        )}
        {error.kind === 'keyReused' && (
          <div><button className="btn" type="button" disabled={submitting} onClick={onStartFresh}>Crear un pedido nuevo</button></div>
        )}
        {error.kind === 'tooManyActive' && <p>Espera a que termine alguno de tus pedidos en curso e inténtalo de nuevo.</p>}
        {error.kind === 'noMaterial' && <p><Link to="../material">Ir a la pestaña Material</Link></p>}
        <PlanErrorDetails error={error} busy={submitting} onReload={onReloadPlan} onReplan={onReplan} onPlan={onPlan}
          onClose={onClosePlan} />
      </div>
    </div>
  );
}
