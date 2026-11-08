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
}

export const CONFLICT_MESSAGE =
  'Este recurso cambió en otra pestaña. Recárgalo para ver la versión vigente; lo que escribiste se conserva hasta que recargues.';
export const RESET_NOTICE =
  'El recurso estaba aprobado y cambió su contenido: volvió a revisión y necesita una nueva aprobación.';

export function startEditing(resource: Resource): EditorState {
  return { saved: resource, draft: resource, notice: null, error: null, conflict: false };
}

export function editDraft(state: EditorState, changes: Partial<Pick<Resource, 'title' | 'body'>>): EditorState {
  return { ...state, draft: { ...state.draft, ...changes, edited: true } };
}

export function editOption(
  state: EditorState,
  optionId: string,
  changes: { text?: string; decision?: DistractorDecision },
): EditorState {
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
  return !state.conflict;
}

/**
 * Sin cambios, se aprueba solo si el servidor no informa bloqueos. Con cambios se puede intentar: el servidor verifica
 * la versión editada antes de aprobar y, si hay un bloqueo, responde con su motivo.
 */
export function canApprove(state: EditorState): boolean {
  if (state.conflict) return false;
  return isDirty(state) || state.saved.approvalBlockers.length === 0;
}

export function afterSaveSuccess(state: EditorState, saved: Resource): EditorState {
  return { saved, draft: saved, notice: saved.reviewReset ? RESET_NOTICE : null, error: null, conflict: false };
}

/** Un error al guardar nunca descarta el borrador del docente. */
export function afterSaveFailure(state: EditorState, error: unknown): EditorState {
  if (isVersionConflict(error)) return { ...state, notice: null, error: CONFLICT_MESSAGE, conflict: true };
  const message = error instanceof ApiError ? error.message : errorMessage(error);
  return { ...state, notice: null, error: message, conflict: false };
}

export function reloadLatest(_state: EditorState, latest: Resource): EditorState {
  return startEditing(latest);
}
