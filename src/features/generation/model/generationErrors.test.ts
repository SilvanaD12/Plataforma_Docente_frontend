import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import { generationError, generationErrorKind, isSessionExpired } from './generationErrors';

describe('Errores de generación', () => {
  it('distingue los errores por el code de la API', () => {
    const kind = (status: number, code: string) => generationErrorKind(new ApiError(status, 'x', code));
    expect(kind(409, 'IDEMPOTENCY_KEY_REUSED')).toBe('keyReused');
    expect(kind(429, 'TOO_MANY_ACTIVE_REQUESTS')).toBe('tooManyActive');
    expect(kind(400, 'NO_PROCESSED_MATERIAL')).toBe('noMaterial');
    expect(kind(400, 'INVALID_OUTCOME')).toBe('invalidOutcome');
    expect(kind(400, 'INVALID_SEQUENCE')).toBe('invalidSequence');
    expect(kind(404, 'UNIT_NOT_FOUND')).toBe('unitNotFound');
    expect(kind(404, 'GENERATION_REQUEST_NOT_FOUND')).toBe('requestNotFound');
  });

  it('con code, el status no decide: un code desconocido es un error general', () => {
    expect(generationErrorKind(new ApiError(400, 'x', 'IDEMPOTENCY_KEY_REQUIRED'))).toBe('other');
    expect(generationErrorKind(new ApiError(409, 'x', 'OTRO_CONFLICTO'))).toBe('other');
    expect(generationErrorKind(new ApiError(503, 'x', 'EVIDENCE_UNAVAILABLE'))).toBe('other');
  });

  it('sin code, usa el status solo cuando es inequívoco', () => {
    expect(generationErrorKind(new ApiError(409, 'x'))).toBe('keyReused');
    expect(generationErrorKind(new ApiError(429, 'x'))).toBe('tooManyActive');
    expect(generationErrorKind(new ApiError(404, 'x'))).toBe('notFound');
    expect(generationErrorKind(new ApiError(400, 'x'))).toBe('other');
    expect(generationErrorKind(new ApiError(503, 'x'))).toBe('other');
    expect(generationErrorKind(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('muestra el message del servidor o el mensaje de conexión', () => {
    expect(generationError(new ApiError(429, 'Ya tienes 2 pedidos en curso.', 'TOO_MANY_ACTIVE_REQUESTS'))).toEqual({
      kind: 'tooManyActive', message: 'Ya tienes 2 pedidos en curso.',
    });
    expect(generationError(new TypeError('Failed to fetch')).message).toMatch(/No se pudo conectar/);
  });

  it('reconoce la sesión vencida', () => {
    expect(isSessionExpired(new ApiError(401, 'x', 'UNAUTHORIZED'))).toBe(true);
    expect(isSessionExpired(new ApiError(401, 'x'))).toBe(true);
    expect(isSessionExpired(new ApiError(403, 'x'))).toBe(false);
    expect(isSessionExpired(new Error('x'))).toBe(false);
  });

  it('distingue los errores del plan por su code', () => {
    const kind = (status: number, code: string) => generationErrorKind(new ApiError(status, 'x', code));
    expect(kind(422, 'PLAN_REQUIRED')).toBe('planRequired');
    expect(kind(422, 'PLAN_NOT_APPROVED')).toBe('planNotApproved');
    expect(kind(422, 'PLAN_INVALID')).toBe('planInvalid');
    expect(kind(409, 'PLAN_VERSION_CONFLICT')).toBe('planVersionConflict');
    expect(kind(409, 'PLAN_ALREADY_USED')).toBe('planAlreadyUsed');
    expect(kind(409, 'PLAN_EVIDENCE_STALE')).toBe('planEvidenceStale');
    expect(kind(404, 'PLAN_NOT_FOUND')).toBe('planNotFound');
    expect(kind(422, 'INSUFFICIENT_EVIDENCE')).toBe('insufficientEvidence');
  });

  it('lee los problemas de PLAN_INVALID y los documentos de PLAN_EVIDENCE_STALE, e ignora detalles con otra forma', () => {
    const problem = { code: 'ITEM_WITHOUT_EVIDENCE', message: 'El ítem 2 no cita fragmentos.', itemPosition: 2 };
    expect(generationError(new ApiError(422, 'El plan tiene problemas.', 'PLAN_INVALID', [problem, { code: 1 }]))).toEqual({
      kind: 'planInvalid', message: 'El plan tiene problemas.', problems: [problem],
    });

    const stale = { documentId: 'doc-1', documentName: 'protocolos.pdf', missingFragmentIds: ['frag-1'] };
    expect(generationError(new ApiError(409, 'El material cambió.', 'PLAN_EVIDENCE_STALE', [stale, 'x']))).toEqual({
      kind: 'planEvidenceStale', message: 'El material cambió.', staleDocuments: [stale],
    });
    expect(generationError(new ApiError(409, 'x', 'PLAN_EVIDENCE_STALE')).staleDocuments).toEqual([]);
    expect(generationError(new ApiError(429, 'x', 'TOO_MANY_ACTIVE_REQUESTS'))).not.toHaveProperty('problems');
  });
});
