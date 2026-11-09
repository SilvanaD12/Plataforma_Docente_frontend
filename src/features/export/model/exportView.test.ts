import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import { EXPORT_FORMATS, exportFailure, historyMessage, historyRow, type Download } from './exportView';

function download(overrides: Partial<Download> = {}): Download {
  return {
    id: 'd1', unitId: 'u1', format: 'scorm_zip', fileName: 'red-301-unidad-1-scorm.zip', resourceCount: 4,
    createdAt: '2026-11-08T15:00:00+00:00', courseId: 'c1', courseName: 'Redes', unitName: 'Capa de transporte', unitNumber: 1,
    ...overrides,
  };
}

describe('formatos de exportación', () => {
  it('ofrece SCORM, Moodle y el documento de la unidad', () => {
    expect(EXPORT_FORMATS.map((format) => format.id)).toEqual(['scorm_zip', 'moodle_xml', 'documento']);
    expect(EXPORT_FORMATS.map((format) => format.extension)).toEqual(['zip', 'xml', 'html']);
  });
});

describe('motivo cuando no se puede exportar', () => {
  it('sin details muestra el message de la API (acordado con Silvana)', () => {
    const error = new ApiError(422, 'Aprueba al menos un recurso antes de exportar.', 'NO_APPROVED_RESOURCES');
    expect(exportFailure(error)).toEqual({ status: 'error', message: 'Aprueba al menos un recurso antes de exportar.', reasons: [] });
  });

  it('con details mal formados también usa solo el message', () => {
    const error = new ApiError(422, 'Ningún recurso cumple.', 'NO_APPROVED_RESOURCES', [{ motivo: 'x' }, 'texto']);
    expect(exportFailure(error)).toMatchObject({ message: 'Ningún recurso cumple.', reasons: [] });
  });

  it('nombra cada motivo del filtro común', () => {
    const details = [
      { reason: 'verification_missing', count: 1 }, { reason: 'verification_outdated', count: 2 },
      { reason: 'verification_insufficient', count: 1 }, { reason: 'media_invalidated', count: 1 },
      { reason: 'unsupported_format', count: 3 }, { reason: 'motivo_nuevo', count: 1 },
    ];
    expect(exportFailure(new ApiError(422, 'Ningún recurso cumple.', 'NO_APPROVED_RESOURCES', details))).toMatchObject({
      reasons: [
        '1 recurso sin comprobación del respaldo',
        '2 recursos cuyo texto cambió después de la última comprobación',
        '1 recurso con respaldo insuficiente en el material',
        '1 recurso con la imagen o el audio por generar de nuevo',
        '3 recursos que este formato no admite',
        '1 recurso por otro motivo',
      ],
    });
  });

  it('una sesión vencida devuelve al acceso', () => {
    expect(exportFailure(new ApiError(401, 'Inicia sesión.'))).toEqual({ status: 'expired' });
  });

  it('un fallo de conexión muestra el mensaje general', () => {
    expect(exportFailure(new Error('offline'))).toEqual({
      status: 'error', message: 'No se pudo conectar con el servidor. Inténtalo de nuevo.', reasons: [],
    });
  });
});

describe('historial de descargas', () => {
  it('cada fila tiene fecha, formato, archivo, curso y unidad (REV-C9)', () => {
    const row = historyRow(download());
    expect(row).toMatchObject({
      id: 'd1', format: 'SCORM (Chamilo o Canvas)', fileName: 'red-301-unidad-1-scorm.zip', course: 'Redes',
      unit: 'Unidad 1 · Capa de transporte',
    });
    expect(row.date).not.toBe('');
    expect(row.date).not.toContain('T15:00');
  });

  it('un curso borrado conserva su nombre en los registros nuevos', () => {
    expect(historyRow(download({ courseId: 'c-borrado' })).course).toBe('Redes');
  });

  it('sin datos del curso (registros antiguos de un curso borrado) dice «Curso eliminado»', () => {
    expect(historyRow(download({ courseId: null, courseName: null, unitName: null, unitNumber: null }))).toMatchObject({
      course: 'Curso eliminado', unit: 'Unidad sin datos',
    });
  });

  it('avisa mientras carga, si falla y si está vacío', () => {
    expect(historyMessage({ status: 'loading' })).toBe('Cargando tu historial de descargas…');
    expect(historyMessage({ status: 'error', message: 'Falló.' })).toBe('Falló.');
    expect(historyMessage({ status: 'ready', downloads: [] })).toBe('Todavía no descargaste archivos.');
    expect(historyMessage({ status: 'ready', downloads: [download()] })).toBeNull();
  });
});
