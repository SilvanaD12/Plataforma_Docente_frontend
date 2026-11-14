import { Link, useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { FallbackNotices } from '../components/FallbackNotices';
import { GenerationForm } from '../components/GenerationForm';
import { GenerationProgress } from '../components/GenerationProgress';
import { useGenerationRequest } from '../hooks/useGenerationRequest';
import { useProcessedMaterial } from '../hooks/useProcessedMaterial';
import { useResourceTypes } from '../hooks/useResourceTypes';
import { useStartGeneration } from '../hooks/useStartGeneration';
import type { GenerationError } from '../model/generationErrors';
import { isTerminal } from '../model/generationRequest';
import '../generation.css';

export function GenerationPage() {
  const context = useOutletContext<UnitContext>();
  // Con otra unidad, el estado y la consulta empiezan de cero.
  return <GenerationView key={context.unit.id} {...context} />;
}

function GenerationView({ course, unit, token, onSessionExpired }: UnitContext) {
  const catalog = useResourceTypes();
  const processedMaterial = useProcessedMaterial(token, unit.id, onSessionExpired);
  const tracking = useGenerationRequest({ unitId: unit.id, token, onSessionExpired });
  const starting = useStartGeneration({ unitId: unit.id, token, onSessionExpired, onStarted: tracking.track });
  const { request } = tracking;
  const running = !!request && !isTerminal(request.status);

  function startNew() {
    starting.clearError();
    tracking.reset();
  }

  return (
    <div className="stack stack--loose">
      <p className="muted">
        Genera recursos 5E para «{unit.title}» de {course.name} a partir del material procesado de la unidad.
        Lo generado pasa a Revisión.
      </p>

      {tracking.recovering && !request && <p className="muted" role="status">Buscando pedidos en curso…</p>}

      {!running && !tracking.recovering && processedMaterial === false && starting.error?.kind !== 'noMaterial' && (
        <div className="alert alert--warn" role="status">
          <p>Esta unidad todavía no tiene material procesado.</p>
          <p><Link to="../material">Ir a la pestaña Material</Link></p>
        </div>
      )}

      {!running && !tracking.recovering && (
        <GenerationForm unit={unit} catalog={catalog} token={token} onSessionExpired={onSessionExpired} submitting={starting.submitting} onSubmit={(body) => void starting.start(body)} />
      )}

      {starting.error && (
        <StartErrorNotice error={starting.error} submitting={starting.submitting}
          onRetry={starting.retry} onStartFresh={starting.startFresh} />
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
}

export function StartErrorNotice({ error, submitting, onRetry, onStartFresh }: StartErrorNoticeProps) {
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
      </div>
    </div>
  );
}
