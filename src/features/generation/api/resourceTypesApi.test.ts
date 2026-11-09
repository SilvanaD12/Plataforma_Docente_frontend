import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResourceTypeInfo } from '../model/resourceTypes';
import { listResourceTypes } from './resourceTypesApi';

afterEach(() => vi.unstubAllGlobals());

describe('API de tipos de recurso', () => {
  it('carga el catálogo público sin enviar la sesión', async () => {
    const types: ResourceTypeInfo[] = [{
      id: 'glosario', name: 'Glosario', singular: 'glosario', count: ['término', 'términos'],
      stage: 'explain', group: 'Conceptos', format: 'text', hasOptions: false,
    }];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(types));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listResourceTypes()).resolves.toEqual(types);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/resource-types', expect.objectContaining({ method: 'GET', body: undefined }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });

  it('conserva el mensaje del servidor si el catálogo no está disponible', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ error: { code: 'UNAVAILABLE', message: 'El catálogo no está disponible.' } }, { status: 503 }),
    ));

    await expect(listResourceTypes()).rejects.toMatchObject({ status: 503, message: 'El catálogo no está disponible.' });
  });
});
