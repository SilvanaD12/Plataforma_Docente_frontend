import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { isVersionConflict } from '../api/reviewApi';
import type { DiscardReason, DistractorDecision, Resource, ReviewStatus } from './resource';

/** Estado de la edición de un recurso: lo guardado en el servidor y el borrador del docente. */
export interface EditorState {
  saved: Resource;
  draft: Resource;
  notice: string | null;
  error: string | null;
  /** El recurso cambió en otra pestaña: hay que recargar antes de volver a guardar (REV-C14). */
  conflict: boolean;
  /**
   * Hay una solicitud en curso (guardar, aprobar, reintentar o recargar). Mientras tanto no se edita: la respuesta
   * reemplaza el borrador y lo escrito en ese momento se perdería.
   */
  pending: boolean;
}

export const CONFLICT_MESSAGE =
  'Este recurso cambió en otra pestaña. Recárgalo para ver la versión vigente; lo que escribiste se conserva hasta que recargues.';
export const RESET_NOTICE =
  'El recurso estaba aprobado y cambió su contenido: volvió a revisión y necesita una nueva aprobación.';

export function startEditing(resource: Resource): EditorState {
  return { saved: resource, draft: resource, notice: null, error: null, conflict: false, pending: false };
}

export function startRequest(state: EditorState): EditorState {
  return { ...state, pending: true };
}

export function canEdit(state: EditorState): boolean {
  return !state.pending;
}

/**
 * El editor es de texto plano: si el cuerpo cambia, el HTML con formato guardado ya no corresponde y no se envía, para
 * que el servidor y los exportadores usen el cuerpo nuevo. Si el docente vuelve al texto guardado, recupera el formato.
 */
export function editDraft(state: EditorState, changes: Partial<Pick<Resource, 'title' | 'body'>>): EditorState {
  if (!canEdit(state)) return state;
  const draft: Resource = { ...state.draft, ...changes, edited: true };
  if (draft.body === state.saved.body) draft.bodyHtml = state.saved.bodyHtml;
  else delete draft.bodyHtml;
  return { ...state, draft };
}

export function editOption(
  state: EditorState,
  optionId: string,
  changes: { text?: string; decision?: DistractorDecision },
): EditorState {
  if (!canEdit(state)) return state;
  const options = state.draft.options?.map((option) => {
    if (option.id !== optionId) return option;
    const textChanged = changes.text !== undefined && changes.text !== option.text;
    return { ...option, ...changes, edited: option.edited || textChanged };
  }) ?? null;
  return { ...state, draft: { ...state.draft, options } };
}

export function withStatus(resource: Resource, status: ReviewStatus, discardReason: DiscardReason | null = null): Resource {
  return { ...resource, status, discardReason: status === 'descartado' ? discardReason : null };
}

export function isDirty(state: EditorState): boolean {
  return JSON.stringify(state.draft) !== JSON.stringify(state.saved);
}

/** Mientras haya un conflicto de versión no se vuelve a guardar: primero hay que recargar. */
export function canSave(state: EditorState): boolean {
  return !state.conflict && !state.pending;
}

/** Mínimo de distractores aceptados para aprobar; es el mismo que exige el servidor (`MIN_ACCEPTED_DISTRACTORS`). */
export const MIN_ACCEPTED_DISTRACTORS = 2;

/**
 * La regla de los distractores del servidor, aplicada al borrador: decidir todos y aceptar al menos dos. Devuelve el
 * motivo con el mismo texto que el servidor, o null si se cumple. Un recurso sin alternativas no tiene esta regla.
 */
export function distractorProblem(resource: Resource): string | null {
  const distractors = resource.options?.filter((option) => !option.isCorrect) ?? [];
  if (!resource.options) return null;
  const pending = distractors.filter((option) => option.decision === 'pendiente').length;
  if (pending > 0) {
    return pending === 1
      ? 'Decide el distractor pendiente para poder aprobar.'
      : `Decide los ${pending} distractores pendientes para poder aprobar.`;
  }
  const accepted = distractors.filter((option) => option.decision === 'aceptado').length;
  if (accepted < MIN_ACCEPTED_DISTRACTORS) {
    return `Acepta al menos ${MIN_ACCEPTED_DISTRACTORS} distractores para poder aprobar.`;
  }
  return null;
}

/**
 * «Aprobar» se ofrece solo si el borrador cumple la regla de los distractores, para no activar el botón cuando el
 * servidor lo va a rechazar. Las demás reglas (respuesta correcta, verificación y multimedia) las aplica el servidor al
 * guardar la versión editada; sin cambios, se usan los bloqueos que él ya informó.
 */
export function canApprove(state: EditorState): boolean {
  if (state.conflict || state.pending || distractorProblem(state.draft) !== null) return false;
  return isDirty(state) || state.saved.approvalBlockers.length === 0;
}

/** Aviso junto al botón de aprobar mientras el borrador no cumpla la regla de los distractores. */
export function approvalHint(state: EditorState): string | null {
  return distractorProblem(state.draft);
}

export function afterSaveSuccess(state: EditorState, saved: Resource): EditorState {
  return { saved, draft: saved, notice: saved.reviewReset ? RESET_NOTICE : null, error: null, conflict: false, pending: false };
}

/** Un error al guardar nunca descarta el borrador del docente. */
export function afterSaveFailure(state: EditorState, error: unknown): EditorState {
  if (isVersionConflict(error)) return { ...state, notice: null, error: CONFLICT_MESSAGE, conflict: true, pending: false };
  const message = error instanceof ApiError ? error.message : errorMessage(error);
  return { ...state, notice: null, error: message, conflict: false, pending: false };
}

export function reloadLatest(_state: EditorState, latest: Resource): EditorState {
  return startEditing(latest);
}
