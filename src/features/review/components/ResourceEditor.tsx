import { useEffect, useRef, useState } from 'react';
import {
  RESOURCE_DISCARD_REASONS,
  discardReasonLabel,
  formatApprovalDate,
  parsePlanWarning,
  reviewStatusLabel,
  type DiscardReason,
  type DistractorDecision,
  type Resource,
} from '../model/resource';
import {
  afterApprovalSuccess,
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
  type EditorState,
} from '../model/reviewEditor';
import {
  addStructureItem,
  removeStructureItem,
  setStructureField,
  setStructureItem,
  structureSchema,
} from '../model/structureEditor';
import { afterMediaResult, canGenerateMedia, mediaView } from '../model/mediaView';
import { canRegenerate, regenerationHint } from '../model/regenerationView';
import { RichTextEditor } from './RichTextEditor';
import { StructureEditor } from './StructureEditor';
import { VerificationBadge } from './VerificationBadge';
import '../review.css';

interface ResourceEditorProps {
  resource: Resource;
  onSave: (resource: Resource) => Promise<Resource>;
  onReload: () => Promise<Resource>;
  onRetry: (resource: Resource) => Promise<Resource>;
  /** «Generar de nuevo» la imagen o el audio invalidados (REV-C8). Sin ella no se ofrece el botón. */
  onGenerateMedia?: (resource: Resource) => Promise<Resource>;
  /**
   * «Regenerar» (REV-C12). Si termina bien, la revisión recarga la lista y vuelve a cargar este editor; si falla, el
   * editor muestra el motivo y el recurso queda como estaba (REV-C13). Sin ella no se ofrece el botón.
   */
  onRegenerate?: (resource: Resource) => Promise<void>;
  /** Estado inicial opcional, usado en pruebas para verificar vistas de error o conflicto. */
  initialState?: EditorState;
  /** Cuando vive dentro de `ResourceCard`, evita duplicar el marco de tarjeta exterior. */
  embedded?: boolean;
  /** Notifica al contenedor si el borrador tiene cambios sin guardar. */
  onDirtyChange?: (dirty: boolean) => void;
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
export function ResourceEditor({
  resource,
  onSave,
  onReload,
  onRetry,
  onGenerateMedia,
  onRegenerate,
  initialState,
  embedded = false,
  onDirtyChange,
}: ResourceEditorProps) {
  const [state, setState] = useState(() => initialState ?? startEditing(resource));
  const [reason, setReason] = useState<DiscardReason>('sin_sentido');
  const inFlight = useRef(false);
  const { draft, saved } = state;
  const dirty = isDirty(state);
  const locked = !canEdit(state);
  const schema = structureSchema(draft.type);
  const fieldId = (name: string) => `${saved.id}-${name}`;
  const media = mediaView(state);
  const planWarning = parsePlanWarning(saved.planWarning);
  const approvalDate = formatApprovalDate(saved.decidedAt);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

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

  async function regenerate(action: (current: Resource) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setState(startRequest);
    try {
      await action(saved);
      setState((current) => ({ ...current, pending: false }));
    } catch (error) {
      setState((current) => afterSaveFailure(current, error));
    } finally {
      inFlight.current = false;
    }
  }

  const Container = embedded ? 'div' : 'article';
  const containerClass = embedded ? 'stack' : 'card stack';

  return (
    <Container className={containerClass}>
      <p className="overline">{reviewStatusLabel(saved.status)}</p>
      {saved.status === 'descartado' && discardReasonLabel(saved.discardReason) && (
        <p className="muted">Motivo: {discardReasonLabel(saved.discardReason)}</p>
      )}
      {planWarning && (
        <div className="alert plan-warning" role="status" aria-label="Aviso pedagógico del plan">
          <div className="plan-warning__body">
            <p>
              {planWarning.kind === 'overlap'
                ? `Este recurso desarrolla conceptos asignados a otro recurso del plan: ${planWarning.developedConcepts.join(', ')}.`
                : `Este recurso no desarrolla los conceptos que le asignó el plan: ${planWarning.missingOwnConcepts.join(', ')}.`}
            </p>
            {planWarning.reason && <p className="muted">{planWarning.reason}</p>}
          </div>
        </div>
      )}
      {media && (
        <div className="verification verification--blocked" role="alert">
          <p><strong>{media.message}</strong></p>
          {media.hint && <p className="muted">{media.hint}</p>}
          {media.actionLabel && onGenerateMedia && (
            <button type="button" className="btn" disabled={!canGenerateMedia(state)}
              onClick={() => run(() => onGenerateMedia(saved), afterMediaResult)}>
              {media.actionLabel}
            </button>
          )}
        </div>
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
        <label id={fieldId('body-label')} htmlFor={fieldId('body')}>
          {draft.options ? 'Enunciado' : 'Contenido'}
        </label>
        <RichTextEditor
          id={fieldId('body')}
          labelId={fieldId('body-label')}
          valueHtml={draft.bodyHtml}
          valueText={draft.body}
          disabled={locked}
          onChange={(html, plainText) =>
            setState((current) => editDraft(current, { body: plainText, bodyHtml: html }))
          }
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

      {dirty && approvalHint(state) && <p className="muted">{approvalHint(state)}</p>}
      {!dirty && saved.approvalBlockers.length > 0 && (
        <ul className="muted">
          {saved.approvalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      )}
      {state.notice && <p className="alert" role="status">{state.notice}</p>}
      {state.error && (
        <div className="alert alert--warn" role="alert">
          {state.staleDocuments && state.staleDocuments.length > 0 ? (
            <div className="stale-documents">
              <p>{state.error}</p>
              <ul className="stale-documents-list">
                {state.staleDocuments.map((doc) => (
                  <li key={doc.documentId}>
                    {doc.documentName}: {doc.missingFragmentIds.length === 1 ? 'falta 1 fragmento' : `faltan ${doc.missingFragmentIds.length} fragmentos`}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>{state.error}</p>
          )}
        </div>
      )}

      <div className="stack">
        {state.conflict ? (
          <button type="button" className="btn btn--primary" disabled={state.pending} onClick={() => run(onReload, reloadLatest)}>
            Recargar el recurso
          </button>
        ) : (
          <>
            <button type="button" className="btn" disabled={!canSave(state) || !dirty}
              onClick={() => run(() => onSave(draft))}>
              Guardar cambios
            </button>
            {saved.status === 'aprobado' && !dirty ? (
              <p className="review-approved-stamp" role="status">
                {approvalDate ? `Aprobado el ${approvalDate}` : 'Aprobado'}
              </p>
            ) : (
              <button type="button" className="btn btn--primary" disabled={!canApprove(state)}
                onClick={() => run(() => onSave(withStatus(draft, 'aprobado')), afterApprovalSuccess)}>
                Aprobar
              </button>
            )}
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
            {onRegenerate && saved.status !== 'descartado' && (
              <div className="review-discard">
                <button type="button" className="btn" disabled={!canRegenerate(state)} onClick={() => regenerate(onRegenerate)}>
                  Regenerar
                </button>
                {regenerationHint(state) && <p className="muted">{regenerationHint(state)}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
