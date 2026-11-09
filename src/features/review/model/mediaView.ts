import type { Resource } from './resource';
import { afterSaveSuccess, isDirty, type EditorState } from './reviewEditor';

export const INVALIDATED_MESSAGE =
  'Cambiaste el guion o la descripción: el archivo anterior ya no se usa. Genéralo de nuevo para poder aprobar y exportar el recurso.';
export const GENERATION_FAILED = 'No se pudo generar el archivo: sigue pendiente. Inténtalo de nuevo más tarde.';
const SAVE_FIRST = 'Guarda los cambios antes de generar el archivo.';
const BACK_TO_REVIEW = 'Vuelve el recurso a revisión para generar el archivo.';

export interface MediaView {
  message: string;
  /** Texto del botón; null si ahora no se puede generar. */
  actionLabel: string | null;
  /** Por qué no se puede generar ahora. */
  hint: string | null;
}

/**
 * «Generar de nuevo» usa la descripción o el guion guardados, y el servidor lo permite solo con el recurso pendiente:
 * por eso se pide guardar antes y volver a revisión un recurso aprobado o descartado.
 */
export function canGenerateMedia(state: EditorState): boolean {
  return Boolean(state.saved.media?.invalidated) && state.saved.status === 'pendiente'
    && !state.pending && !state.conflict && !isDirty(state);
}

/** Aviso de multimedia invalidada (REV-C8); null si el archivo vigente se puede usar. */
export function mediaView(state: EditorState): MediaView | null {
  if (!state.saved.media?.invalidated) return null;
  const hint = state.saved.status !== 'pendiente' ? BACK_TO_REVIEW : isDirty(state) ? SAVE_FIRST : null;
  return { message: INVALIDATED_MESSAGE, actionLabel: hint ? null : 'Generar de nuevo', hint };
}

/** Si el servicio no pudo generar el archivo, el recurso sigue invalidado: se toma igual y se informa. */
export function afterMediaResult(state: EditorState, resource: Resource): EditorState {
  const next = afterSaveSuccess(state, resource);
  return resource.media?.invalidated ? { ...next, error: GENERATION_FAILED } : next;
}
