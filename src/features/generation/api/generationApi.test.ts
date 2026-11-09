import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StartGenerationRequest } from '../model/generationRequest';
import { getGenerationRequest, listGenerationRequests, startGenerationRequest } from './generationApi';

const body: StartGenerationRequest = { mode: 'individual', unitId: 'unidad-1', resourceTypes: ['glosario'], quantity: 2, outcomeId: null };
const saved = { id: 'gen-req-1', mode: 'individual', unitId: 'unidad-1', status: 'queued', steps: [] };

afterEach(() => vi.unstubAllGlobals());

describe('API de pedidos de generación', () => {
  it('crea el pedido con la clave de idempotencia y la sesión, y lo marca como nuevo con 202', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(saved, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startGenerationRequest('token-docente', 'clave-12345678', body)).resolves.toEqual({ request: saved, created: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-requests', expect.objectContaining({
      method: 'POST', body: JSON.stringify(body),
    }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe('clave-12345678');
    expect(headers.get('Authorization')).toBe('Bearer token-docente');
  });

  it('devuelve el pedido existente sin marcarlo como nuevo con 200', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ...saved, status: 'running' })));

    await expect(startGenerationRequest('token-docente', 'clave-12345678', body)).resolves.toEqual({
      request: { ...saved, status: 'running' }, created: false,
    });
  });

  it('conserva el status y el message de una clave reutilizada con otros datos', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(
      { error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Esta clave ya se usó con otros datos.' } }, { status: 409 },
    )));

    await expect(startGenerationRequest('token-docente', 'clave-12345678', body)).rejects.toMatchObject({
      status: 409, message: 'Esta clave ya se usó con otros datos.',
    });
  });

  it('consulta un pedido por su identificador', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(saved));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getGenerationRequest('token-docente', 'gen/1')).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-requests/gen%2F1', expect.objectContaining({ method: 'GET' }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-docente');
  });

  it('lista los pedidos activos de la unidad', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([saved]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGenerationRequests('token-docente', 'unidad 1', true)).resolves.toEqual([saved]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/generation-requests?unitId=unidad+1&active=true', expect.objectContaining({ method: 'GET' }));
  });
});
