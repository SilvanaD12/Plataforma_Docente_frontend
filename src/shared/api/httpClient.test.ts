import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './httpClient';

afterEach(() => vi.unstubAllGlobals());

describe('cliente HTTP compartido', () => {
  it('guarda el código y los detalles del error de la API', async () => {
    const details = [{ reason: 'verification_pending', count: 2 }];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(
      { error: { code: 'NO_APPROVED_RESOURCES', message: 'Ningún recurso cumple.', details } }, { status: 422 },
    )));

    const error = await request('/units/u1/exports', 'POST', { format: 'scorm_zip' }, 'token').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, message: 'Ningún recurso cumple.', code: 'NO_APPROVED_RESOURCES', details });
  });

  it('sin código ni detalles en la respuesta, quedan sin definir', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('falla', { status: 500 })));

    const error = await request('/courses', 'GET').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 500, message: 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
    expect((error as ApiError).code).toBeUndefined();
    expect((error as ApiError).details).toBeUndefined();
  });

  it('se sigue pudiendo crear con estado y mensaje, como hasta ahora', () => {
    const error = new ApiError(401, 'La sesión venció.');
    expect(error).toMatchObject({ status: 401, message: 'La sesión venció.' });
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});
