import type { RegenerationResult } from '../api/reviewApi';
import { isDirty, type EditorState } from './reviewEditor';

const SAVE_FIRST = 'Guarda o deshaz tus cambios antes de regenerar el recurso.';

/**
 * «Regenerar» pide un recurso nuevo desde la versión guardada (REV-C12). Con cambios sin guardar no se ofrece: si el
 * anterior se descarta, lo escrito se perdería. Un recurso descartado no se regenera.
 */
export function canRegenerate(state: EditorState): boolean {
  return state.saved.status !== 'descartado' && !state.pending && !state.conflict && !isDirty(state);
}

export function regenerationHint(state: EditorState): string | null {
  return state.saved.status !== 'descartado' && isDirty(state) ? SAVE_FIRST : null;
}

/** Aviso del resultado, para la lista de la revisión: el editor del recurso anterior se vuelve a cargar. */
export function regenerationNotice(result: RegenerationResult): string {
  if (result.status === 'running') {
    return 'La regeneración de este recurso sigue en curso. Vuelve a cargar la revisión en unos momentos.';
  }
  return result.previousDiscarded
    ? 'Se generó un recurso nuevo para revisar. El anterior pasó a Descartados con el motivo «regenerado».'
    : 'Se generó un recurso nuevo para revisar. El anterior cambió mientras tanto, así que se conservan los dos: elige con cuál te quedas.';
}
