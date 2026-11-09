import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request, requestWithStatus } from './httpClient';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentHeaders = (fetchMock: ReturnType<typeof stubFetch>, call = 0) => new Headers(fetchMock.mock.calls[call][1]?.headers);

describe('Cliente HTTP compartido', () => {
  it('envía las cabeceras adicionales junto con Authorization y Content-Type', async () => {
    const fetchMock = stubFetch(Response.json({ id: 'gen-req-1' }, { status: 202 }));

    await request('/generation-requests', 'POST', { mode: 'individual' }, 'token-docente', { 'Idempotency-Key': 'clave-12345678' });

    const headers = sentHeaders(fetchMock);
    expect(headers.get('Idempotency-Key')).toBe('clave-12345678');
    expect(headers.get('Authorization')).toBe('Bearer token-docente');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-requests', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ mode: 'individual' }),
    }));
  });

  it('no deja que una cabecera adicional reemplace la sesión', async () => {
    const fetchMock = stubFetch(Response.json({}));

    await request('/courses', 'GET', undefined, 'token-docente', { Authorization: 'Bearer otro' });

    expect(sentHeaders(fetchMock).get('Authorization')).toBe('Bearer token-docente');
  });

  it('requestWithStatus distingue un pedido nuevo (202) de uno existente (200) y devuelve su cuerpo', async () => {
    stubFetch(
      Response.json({ id: 'gen-req-1', status: 'queued' }, { status: 202 }),
      Response.json({ id: 'gen-req-1', status: 'running' }, { status: 200 }),
    );

    await expect(requestWithStatus('/generation-requests', 'POST', {}, 'token-docente'))
      .resolves.toEqual({ status: 202, data: { id: 'gen-req-1', status: 'queued' } });
    await expect(requestWithStatus('/generation-requests', 'POST', {}, 'token-docente'))
      .resolves.toEqual({ status: 200, data: { id: 'gen-req-1', status: 'running' } });
  });

  it('requestWithStatus comparte el manejo de 204 y de errores', async () => {
    stubFetch(
      new Response(null, { status: 204 }),
      Response.json({ error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'La clave ya se usó con otros datos.' } }, { status: 409 }),
    );

    await expect(requestWithStatus('/courses/curso-1', 'DELETE')).resolves.toEqual({ status: 204, data: undefined });
    await expect(requestWithStatus('/generation-requests', 'POST', {})).rejects.toMatchObject({
      status: 409, message: 'La clave ya se usó con otros datos.',
    });
  });

  it('request sin cabeceras adicionales sigue igual: solo la sesión y sin Content-Type si no hay cuerpo', async () => {
    const fetchMock = stubFetch(Response.json([{ id: 'curso-1' }]));

    await expect(request('/courses', 'GET', undefined, 'token-docente')).resolves.toEqual([{ id: 'curso-1' }]);

    const headers = sentHeaders(fetchMock);
    expect([...headers.keys()]).toEqual(['authorization']);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses', expect.objectContaining({ method: 'GET', body: undefined }));
  });

  it('request devuelve undefined ante un 204 vacío', async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(request('/courses/curso-1', 'DELETE', undefined, 'token-docente')).resolves.toBeUndefined();
  });

  it('request lanza ApiError con el message del servidor o uno genérico si no lo hay', async () => {
    stubFetch(
      Response.json({ error: { message: 'La sesión venció.' } }, { status: 401 }),
      new Response('error interno', { status: 500 }),
    );

    const expired = request('/courses', 'GET', undefined, 'token-vencido');
    await expect(expired).rejects.toBeInstanceOf(ApiError);
    await expect(expired).rejects.toMatchObject({ status: 401, message: 'La sesión venció.' });
    await expect(request('/courses', 'GET')).rejects.toMatchObject({
      status: 500, message: 'No se pudo completar la solicitud. Inténtalo de nuevo.',
    });
  });
});
