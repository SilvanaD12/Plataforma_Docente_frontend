import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import { generationError, generationErrorKind, isSessionExpired } from './generationErrors';

describe('Errores de generación', () => {
  it('distingue los errores por código de estado', () => {
    expect(generationErrorKind(new ApiError(409, 'x'))).toBe('keyReused');
    expect(generationErrorKind(new ApiError(429, 'x'))).toBe('tooManyActive');
    expect(generationErrorKind(new ApiError(400, 'x'))).toBe('noMaterial');
    expect(generationErrorKind(new ApiError(404, 'x'))).toBe('notFound');
    expect(generationErrorKind(new ApiError(503, 'x'))).toBe('other');
    expect(generationErrorKind(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('muestra el message del servidor o el mensaje de conexión', () => {
    expect(generationError(new ApiError(429, 'Ya tienes 2 pedidos en curso.'))).toEqual({
      kind: 'tooManyActive', message: 'Ya tienes 2 pedidos en curso.',
    });
    expect(generationError(new TypeError('Failed to fetch')).message).toMatch(/No se pudo conectar/);
  });

  it('reconoce la sesión vencida', () => {
    expect(isSessionExpired(new ApiError(401, 'x'))).toBe(true);
    expect(isSessionExpired(new ApiError(403, 'x'))).toBe(false);
    expect(isSessionExpired(new Error('x'))).toBe(false);
  });
});
