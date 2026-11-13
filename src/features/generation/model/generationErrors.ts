import { ApiError, errorMessage } from '../../../shared/api/httpClient';

export type GenerationErrorKind =
  | 'keyReused'
  | 'tooManyActive'
  | 'noMaterial'
  | 'invalidOutcome'
  | 'invalidSequence'
  | 'incompatibleModality'
  | 'unitNotFound'
  | 'requestNotFound'
  /** 404 sin `code`: no se sabe si falta la unidad o el pedido. */
  | 'notFound'
  | 'network'
  | 'other';

export interface GenerationError {
  kind: GenerationErrorKind;
  /** Siempre el `message` del servidor, o el mensaje de conexión si no hubo respuesta. */
  message: string;
}

export function isSessionExpired(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

const kindsByCode: Record<string, GenerationErrorKind> = {
  IDEMPOTENCY_KEY_REUSED: 'keyReused',
  TOO_MANY_ACTIVE_REQUESTS: 'tooManyActive',
  NO_PROCESSED_MATERIAL: 'noMaterial',
  INVALID_OUTCOME: 'invalidOutcome',
  INVALID_SEQUENCE: 'invalidSequence',
  RESOURCE_TYPE_NOT_IN_MODALITY: 'incompatibleModality',
  UNIT_NOT_FOUND: 'unitNotFound',
  GENERATION_REQUEST_NOT_FOUND: 'requestNotFound',
};

// Sin `code` solo se distinguen los estados inequívocos. Un 400 puede ser varias reglas de negocio,
// así que no se trata como falta de material.
const kindsByStatus: Record<number, GenerationErrorKind> = {
  404: 'notFound',
  409: 'keyReused',
  429: 'tooManyActive',
};

export function generationErrorKind(error: unknown): GenerationErrorKind {
  if (!(error instanceof ApiError)) return 'network';
  if (error.code) return kindsByCode[error.code] ?? 'other';
  return kindsByStatus[error.status] ?? 'other';
}

export function generationError(error: unknown): GenerationError {
  return { kind: generationErrorKind(error), message: errorMessage(error) };
}
