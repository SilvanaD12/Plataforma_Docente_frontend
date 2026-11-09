import { useRef, useState } from 'react';
import {
  RESOURCE_DISCARD_REASONS,
  discardReasonLabel,
  reviewStatusLabel,
  type DiscardReason,
  type DistractorDecision,
  type Resource,
} from '../model/resource';
import {
  afterRetrySuccess,
  afterSaveFailure,
  afterSaveSuccess,
  approvalHint,
  canApprove,
  canDiscard,
  canEdit,
  canRestore,
  canRetry,
  canSave,
  editDraft,
  editOption,
  isDirty,
  reloadLatest,
  retryHint,
  startEditing,
  startRequest,
  withStatus,
} from '../model/reviewEditor';
import {
  addStructureItem,
  removeStructureItem,
  setStructureField,
  setStructureItem,
  structureSchema,
} from '../model/structureEditor';
import { StructureEditor } from './StructureEditor';
import { VerificationBadge } from './VerificationBadge';
import '../review.css';

interface ResourceEditorProps {
  resource: Resource;
  onSave: (resource: Resource) => Promise<Resource>;
  onReload: () => Promise<Resource>;
  onRetry: (resource: Resource) => Promise<Resource>;
}

const DECISIONS: { value: DistractorDecision; label: string }[] = [
  { value: 'pendiente', label: 'Por decidir' },
  { value: 'aceptado', label: 'Aceptar' },
  { value: 'descartado', label: 'Descartar' },
];

/**
 * Edición y aprobación de un recurso. Las reglas de qué hacer con cada resultado (conflicto de versión, aprobación
 * bloqueada, vuelta a revisión) están en `model/reviewEditor`; aquí solo se usan.
 */
export function ResourceEditor({ resource, onSave, onReload, onRetry }: ResourceEditorProps) {
  const [state, setState] = useState(() => startEditing(resource));
  const [reason, setReason] = useState<DiscardReason>('sin_sentido');
  const inFlight = useRef(false);
  const { draft, saved } = state;
  const locked = !canEdit(state);
  const schema = structureSchema(draft.type);
  const fieldId = (name: string) => `${saved.id}-${name}`;

  async function run(action: () => Promise<Resource>, onSuccess = afterSaveSuccess) {
    if (inFlight.current) return;
    inFlight.current = true;
    setState(startRequest);
    try {
      const result = await action();
      setState((current) => onSuccess(current, result));
    } catch (error) {
      setState((current) => afterSaveFailure(current, error));
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <article className="card stack">
      <p className="overline">{reviewStatusLabel(saved.status)}</p>
      {saved.status === 'descartado' && discardReasonLabel(saved.discardReason) && (
        <p className="muted">Motivo: {discardReasonLabel(saved.discardReason)}</p>
      )}
      <VerificationBadge
        verification={saved.verification}
        retryDisabled={!canRetry(state)}
        retryHint={retryHint(state)}
        onRetry={() => run(() => onRetry(saved), afterRetrySuccess)}
      />

      <div className="field">
        <label htmlFor={fieldId('title')}>Título</label>
        <input
          id={fieldId('title')}
          className="input"
          value={draft.title}
          disabled={locked}
          onChange={(event) => setState((current) => editDraft(current, { title: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId('body')}>{draft.options ? 'Enunciado' : 'Contenido'}</label>
        <textarea
          id={fieldId('body')}
          className="input"
          rows={5}
          value={draft.body}
          disabled={locked}
          onChange={(event) => setState((current) => editDraft(current, { body: event.target.value }))}
        />
      </div>

      {schema && (
        <StructureEditor
          idPrefix={fieldId('structure')}
          schema={schema}
          structure={(draft.structure ?? {}) as Record<string, unknown>}
          disabled={locked}
          onField={(key, value) => setState((current) => setStructureField(current, key, value))}
          onItem={(listKey, index, field, value) => setState((current) => setStructureItem(current, listKey, index, field, value))}
          onAdd={(listKey) => setState((current) => addStructureItem(current, listKey))}
          onRemove={(listKey, index) => setState((current) => removeStructureItem(current, listKey, index))}
        />
      )}

      {draft.options?.map((option) => (
        <fieldset key={option.id} className="review-option">
          <legend>{option.isCorrect ? 'Respuesta correcta' : 'Distractor'}</legend>
          <input
            className="input"
            aria-label={option.isCorrect ? 'Texto de la respuesta correcta' : 'Texto del distractor'}
            value={option.text}
            disabled={locked}
            onChange={(event) => setState((current) => editOption(current, option.id, { text: event.target.value }))}
          />
          {!option.isCorrect && (
            <select
              className="input"
              aria-label="Decisión sobre el distractor"
              value={option.decision}
              disabled={locked}
              onChange={(event) => setState((current) =>
                editOption(current, option.id, { decision: event.target.value as DistractorDecision }))}
            >
              {DECISIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
          {option.reliabilityWarning && <p className="muted">{option.reliabilityWarning}</p>}
        </fieldset>
      ))}

      {isDirty(state) && approvalHint(state) && <p className="muted">{approvalHint(state)}</p>}
      {!isDirty(state) && saved.approvalBlockers.length > 0 && (
        <ul className="muted">
          {saved.approvalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      )}
      {state.notice && <p className="alert" role="status">{state.notice}</p>}
      {state.error && <p className="alert alert--warn" role="alert">{state.error}</p>}

      <div className="stack">
        {state.conflict ? (
          <button type="button" className="btn btn--primary" disabled={state.pending} onClick={() => run(onReload, reloadLatest)}>
            Recargar el recurso
          </button>
        ) : (
          <>
            <button type="button" className="btn" disabled={!canSave(state) || !isDirty(state)}
              onClick={() => run(() => onSave(draft))}>
              Guardar cambios
            </button>
            <button type="button" className="btn btn--primary" disabled={!canApprove(state)}
              onClick={() => run(() => onSave(withStatus(draft, 'aprobado')))}>
              Aprobar
            </button>
            {saved.status === 'descartado' ? (
              <button type="button" className="btn" disabled={!canRestore(state)}
                onClick={() => run(() => onSave(withStatus(draft, 'pendiente')))}>
                Volver a revisión
              </button>
            ) : (
              <div className="review-discard">
                <div className="field">
                  <label htmlFor={fieldId('discard-reason')}>Motivo del descarte</label>
                  <select
                    id={fieldId('discard-reason')}
                    className="input"
                    value={reason}
                    disabled={!canDiscard(state)}
                    onChange={(event) => setReason(event.target.value as DiscardReason)}
                  >
                    {RESOURCE_DISCARD_REASONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <button type="button" className="btn" disabled={!canDiscard(state)}
                  onClick={() => run(() => onSave(withStatus(draft, 'descartado', reason)))}>
                  Descartar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
