import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportFailure, historyRow } from '../model/exportView';
import { exportUnit, listDownloads } from './exportApi';

afterEach(() => vi.unstubAllGlobals());

describe('API de exportación', () => {
  it('pide el archivo del formato elegido con todos los recursos que cumplen (REV-C7)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('xml', {
      headers: { 'Content-Disposition': 'attachment; filename="red-301-unidad-1-moodle.xml"' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const file = await exportUnit('token-docente', 'unidad/1', 'moodle_xml');
    expect(file.fileName).toBe('red-301-unidad-1-moodle.xml');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/units/unidad%2F1/exports');
    expect(JSON.parse(String(init?.body))).toEqual({ format: 'moodle_xml', resourceIds: [] });
  });

  it('si el servidor no manda el nombre, usa uno con la extensión del formato', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('zip')));
    expect((await exportUnit('token', 'u1', 'scorm_zip')).fileName).toBe('exportacion.zip');
  });

  it('el 422 NO_APPROVED_RESOURCES expone los motivos de details (REV-C7)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      error: {
        code: 'NO_APPROVED_RESOURCES',
        message: 'Ningún recurso cumple las condiciones para exportar.',
        details: [{ reason: 'verification_pending', count: 2 }, { reason: 'not_approved', count: 1 }],
      },
    }, { status: 422 })));

    const failure = exportFailure(await exportUnit('token', 'u1', 'scorm_zip').catch((e: unknown) => e));
    expect(failure).toEqual({
      status: 'error',
      message: 'Ningún recurso cumple las condiciones para exportar.',
      reasons: ['2 recursos con la comprobación del respaldo pendiente', '1 recurso sin aprobar'],
    });
  });

  it('lee el historial del docente y muestra «Curso eliminado» cuando courseName es null (REV-C9)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([
      { id: 'd1', unitId: 'u9', format: 'documento', fileName: 'unidad.html', resourceCount: 3,
        createdAt: '2026-11-08T15:00:00+00:00', courseId: null, courseName: null, unitName: null, unitNumber: null },
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const [record] = await listDownloads('token-docente');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/downloads');
    expect(historyRow(record)).toMatchObject({ course: 'Curso eliminado', unit: 'Unidad sin datos', format: 'Documento de la unidad' });
  });
});
