import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request, requestFile } from './httpClient';

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

describe('descarga de archivos', () => {
  it('devuelve el archivo y el nombre que manda el servidor', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('contenido', {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="red-301-unidad-1-scorm.zip"' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const file = await requestFile('/units/u1/exports', { format: 'scorm_zip' }, 'token');
    expect(file.fileName).toBe('red-301-unidad-1-scorm.zip');
    expect(await file.blob.text()).toBe('contenido');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/units/u1/exports');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
  });

  it('sin Content-Disposition el nombre queda sin definir', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('x')));
    expect((await requestFile('/units/u1/exports', {}, 'token')).fileName).toBeNull();
  });

  it('un error trae el código y los detalles, como en las demás solicitudes', async () => {
    const details = [{ reason: 'not_approved', count: 3 }];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(
      { error: { code: 'NO_APPROVED_RESOURCES', message: 'Ningún recurso cumple.', details } }, { status: 422 },
    )));
    const error = await requestFile('/units/u1/exports', {}, 'token').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 422, code: 'NO_APPROVED_RESOURCES', details });
  });
});
