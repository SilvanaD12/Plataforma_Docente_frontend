import { useRef, useState } from 'react';
import { reviewStatusLabel, type DistractorDecision, type Resource } from '../model/resource';
import {
  afterSaveFailure,
  afterSaveSuccess,
  approvalHint,
  canApprove,
  canEdit,
  canSave,
  editDraft,
  editOption,
  isDirty,
  reloadLatest,
  startEditing,
  startRequest,
  withStatus,
} from '../model/reviewEditor';
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
  const inFlight = useRef(false);
  const { draft, saved } = state;
  const locked = !canEdit(state);
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
      <VerificationBadge
        verification={saved.verification}
        retrying={state.pending}
        onRetry={() => run(() => onRetry(saved))}
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
          </>
        )}
      </div>
    </article>
  );
}
