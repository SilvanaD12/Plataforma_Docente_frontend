import { ApiError, errorMessage } from '../../../shared/api/httpClient';

export type GenerationErrorKind = 'keyReused' | 'tooManyActive' | 'noMaterial' | 'notFound' | 'network' | 'other';

export interface GenerationError {
  kind: GenerationErrorKind;
  /** Siempre el `message` del servidor, o el mensaje de conexión si no hubo respuesta. */
  message: string;
}

export function isSessionExpired(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

// TODO(GEN-01): distinguir por `error.code` cuando ApiError lo incluya (PR #4):
// IDEMPOTENCY_KEY_REUSED, TOO_MANY_ACTIVE_REQUESTS, NO_PROCESSED_MATERIAL, UNIT_NOT_FOUND y
// GENERATION_REQUEST_NOT_FOUND. Hoy un 400 también puede ser INVALID_OUTCOME, INVALID_SEQUENCE o
// IDEMPOTENCY_KEY_REQUIRED; se muestra el message del servidor en todos los casos.
export function generationErrorKind(error: unknown): GenerationErrorKind {
  if (!(error instanceof ApiError)) return 'network';
  switch (error.status) {
    case 409: return 'keyReused';
    case 429: return 'tooManyActive';
    case 400: return 'noMaterial';
    case 404: return 'notFound';
    default: return 'other';
  }
}

export function generationError(error: unknown): GenerationError {
  return { kind: generationErrorKind(error), message: errorMessage(error) };
}
