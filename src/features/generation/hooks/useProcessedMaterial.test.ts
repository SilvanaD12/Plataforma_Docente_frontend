import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasProcessedMaterial } from './useProcessedMaterial';

afterEach(() => vi.unstubAllGlobals());

describe('Disponibilidad de material en Generación', () => {
  it.each([
    { documents: [], expected: false },
    { documents: [{ unitId: 'otra-unidad', status: 'procesado' }, { unitId: 'udp', status: 'registrado' }], expected: false },
    { documents: [{ unitId: 'udp', status: 'procesando' }], expected: false },
    { documents: [{ unitId: 'udp', status: 'procesado' }], expected: true },
  ])('consulta solo el estado de la unidad solicitada ($expected)', async ({ documents, expected }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(documents));
    vi.stubGlobal('fetch', fetchMock);

    await expect(hasProcessedMaterial('sesion-docente', 'udp')).resolves.toBe(expected);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/documents', expect.objectContaining({ method: 'GET' }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer sesion-docente');
  });

  it('distingue una consulta fallida de una unidad sin material', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('Sin conexión')));
    await expect(hasProcessedMaterial('sesion-docente', 'udp')).rejects.toThrow('Sin conexión');
  });
});
