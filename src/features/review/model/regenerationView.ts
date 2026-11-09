import type { RegenerationResult, RegenerationStatusResult } from '../api/reviewApi';
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

/** D10: cada cuánto se consulta una regeneración en segundo plano y cuántas veces (unos 2 minutos). */
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 40;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Consulta el estado mientras la regeneración siga `running`. Devuelve el resultado al terminar (`succeeded` o
 * `failed`), o null si se agotan los intentos o si `stopped` indica que ya no hace falta (por ejemplo, al salir).
 */
export async function waitForRegeneration(
  check: () => Promise<RegenerationStatusResult>,
  wait: (ms: number) => Promise<void> = sleep,
  maxAttempts = MAX_POLL_ATTEMPTS,
  stopped: () => boolean = () => false,
): Promise<RegenerationStatusResult | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (stopped()) return null;
    await wait(POLL_INTERVAL_MS);
    if (stopped()) return null;
    const state = await check();
    if (state.status !== 'running') return state;
  }
  return null;
}

export function regenerationProgressNotice(): string {
  return 'Se está preparando el recurso nuevo. La revisión se actualizará sola cuando termine.';
}

export function regenerationFailureNotice(state: RegenerationStatusResult): string {
  return state.reason
    ? `No se pudo regenerar el recurso: ${state.reason} El recurso quedó como estaba.`
    : 'No se pudo regenerar el recurso. El recurso quedó como estaba.';
}
