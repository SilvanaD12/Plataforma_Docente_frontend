import {
  discardReasonLabel,
  resourceTypeLabel,
  stageLabel,
  type Resource,
} from '../model/resource';
import { CitationList } from './CitationList';
import { ResourceEditor } from './ResourceEditor';
import { VerificationBadge } from './VerificationBadge';
import '../review.css';

interface ResourceCardProps {
  resource: Resource;
  isOpen: boolean;
  isDirty?: boolean;
  closeBlockedWarning?: boolean;
  headerButtonRef?: (element: HTMLButtonElement | null) => void;
  onToggle: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (resource: Resource) => Promise<Resource>;
  onReload: () => Promise<Resource>;
  onRetry: (resource: Resource) => Promise<Resource>;
  onGenerateMedia?: (resource: Resource) => Promise<Resource>;
  onRegenerate?: (resource: Resource) => Promise<void>;
}

/**
 * Tarjeta plegable de un recurso en revisión: cerrada muestra solo la cabecera con su estado e insignia compacta;
 * abierta despliega `ResourceEditor` y la lista plegable `CitationList`.
 */
export function ResourceCard({
  resource,
  isOpen,
  isDirty = false,
  closeBlockedWarning = false,
  headerButtonRef,
  onToggle,
  onDirtyChange,
  onSave,
  onReload,
  onRetry,
  onGenerateMedia,
  onRegenerate,
}: ResourceCardProps) {
  const bodyId = `${resource.id}-panel`;
  const reason = resource.status === 'descartado' ? discardReasonLabel(resource.discardReason) : null;

  return (
    <article id={resource.id} className="card resource-card">
      <div className="resource-card__header">
        <button
          ref={headerButtonRef}
          type="button"
          className="resource-card__toggle"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="resource-card__chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          {' '}
          <span className="resource-card__title">{resource.title}</span>
          {' '}
          <span className="resource-card__meta">
            <span className="review-pill">{resourceTypeLabel(resource.type)}</span>
            {' '}
            <span className="review-pill">{stageLabel(resource.stage)}</span>
            {' '}
            <VerificationBadge verification={resource.verification} compact />
            {reason && (
              <>
                {' '}
                <span className="review-pill review-pill--muted">{reason}</span>
              </>
            )}
            {isDirty && (
              <>
                {' '}
                <span className="review-pill review-pill--warn">Cambios sin guardar</span>
              </>
            )}
          </span>
        </button>
        {closeBlockedWarning && isDirty && (
          <p className="alert alert--warn resource-card__dirty-notice" role="alert">
            Este recurso tiene cambios sin guardar. Guárdalos antes de cerrar la tarjeta.
          </p>
        )}
      </div>

      <div id={bodyId} hidden={!isOpen}>
        {isOpen && (
          <div className="resource-card__body stack">
            <ResourceEditor
              embedded
              resource={resource}
              onDirtyChange={onDirtyChange}
              onSave={onSave}
              onReload={onReload}
              onRetry={onRetry}
              onGenerateMedia={onGenerateMedia}
              onRegenerate={onRegenerate}
            />
            <CitationList resource={resource} />
          </div>
        )}
      </div>
    </article>
  );
}
