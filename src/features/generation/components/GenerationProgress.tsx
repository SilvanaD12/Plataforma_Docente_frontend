import { Link } from 'react-router-dom';
import {
  finishedStepCount, isTerminal, orderedSteps, requestLabel, reviewPath, stageLabel, stepLabel, verificationLabel,
  type GenerationRequestStatus, type GenerationStep, type VerificationStatus,
} from '../model/generationRequest';
import { typeName, type ResourceTypeInfo } from '../model/resourceTypes';
import '../generation.css';

interface GenerationProgressProps {
  request: GenerationRequestStatus;
  resourceTypes: ResourceTypeInfo[];
  onStartNew?: () => void;
}

export function GenerationProgress({ request, resourceTypes, onStartNew }: GenerationProgressProps) {
  const steps = orderedSteps(request.steps);
  const finished = finishedStepCount(steps);
  const done = isTerminal(request.status);

  return (
    <section className="card" aria-labelledby="generation-progress-title" aria-busy={!done}>
      <header className="generation-progress__head">
        <h2 className="h2" id="generation-progress-title">
          {request.mode === 'individual' ? 'Generación individual' : 'Secuencia 5E'}
        </h2>
        <span className={'generation-badge generation-badge--' + request.status} role="status">
          {requestLabel(request.status)}
        </span>
      </header>
      {steps.length > 0 && (
        <div className="field">
          <span className="field__hint" id="generation-progress-count">{finished} de {steps.length} pasos terminados</span>
          <progress className="generation-progress__bar" max={steps.length} value={finished}
            aria-labelledby="generation-progress-count" />
        </div>
      )}
      {request.failure && <p className="alert alert--warn" role="alert">{request.failure.message}</p>}
      {request.status === 'interrupted' && (
        <div className="alert alert--warn" role="alert">
          <span>El pedido se interrumpió antes de terminar. Lo ya generado se conserva en Revisión.</span>
          {onStartNew && <button className="btn" type="button" onClick={onStartNew}>Crear un pedido nuevo</button>}
        </div>
      )}
      <ol className="generation-steps">
        {steps.map((step) => <StepItem key={step.position} step={step} resourceTypes={resourceTypes} />)}
      </ol>
    </section>
  );
}

function StepItem({ step, resourceTypes }: { step: GenerationStep; resourceTypes: ResourceTypeInfo[] }) {
  // `resources` es opcional en el contrato; sin él solo se conocen los ids, no la verificación.
  const resources: { id: string; title: string; verificationStatus: VerificationStatus | null }[] = step.resources?.length
    ? step.resources
    : step.resourceIds.map((id) => ({ id, title: 'Recurso ' + id, verificationStatus: null }));

  return (
    <li className="generation-step">
      <div className="generation-step__head">
        <div>
          <p className="overline">{stageLabel(step.stage)} · {step.agent}</p>
          <h3 className="title">{typeName(resourceTypes, step.resourceType)}</h3>
        </div>
        <span className={'generation-badge generation-badge--' + step.status}>{stepLabel(step.status)}</span>
      </div>
      {step.error && <p className="alert alert--warn">{step.error.message}</p>}
      {resources.length > 0 && (
        <ul className="generation-list" aria-label="Recursos enviados a Revisión">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Link to={reviewPath(resource.id)}>{resource.title}</Link>
              {resource.verificationStatus && (
                <span className={'generation-badge generation-badge--verification-' + resource.verificationStatus}>
                  Verificación: {verificationLabel(resource.verificationStatus)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {step.rejections.length > 0 && (
        <ul className="generation-list" aria-label="Recursos rechazados">
          {step.rejections.map((rejection, index) => (
            <li key={index}>
              <span><strong>{rejection.title}</strong> no pasó a Revisión: {rejection.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
