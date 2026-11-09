import { request, requestFile } from '../../../shared/api/httpClient';
import { exportFormat, type Download, type ExportFormatId } from '../model/exportView';

/**
 * Pide el archivo de la unidad. Con `resourceIds` vacío el backend incluye todo lo que cumple el filtro común
 * (aprobado, con el respaldo vigente y multimedia válida) y que el formato admite; también registra la descarga.
 */
export async function exportUnit(token: string, unitId: string, format: ExportFormatId) {
  const file = await requestFile(
    '/units/' + encodeURIComponent(unitId) + '/exports',
    { format, resourceIds: [] },
    token,
  );
  return { blob: file.blob, fileName: file.fileName ?? 'exportacion.' + (exportFormat(format)?.extension ?? 'bin') };
}

/** Historial del docente en todas sus unidades, del más reciente al más antiguo (REV-C9). */
export function listDownloads(token: string) {
  return request<Download[]>('/downloads', 'GET', undefined, token);
}

/** Entrega el archivo al navegador para que lo guarde con el nombre del servidor. */
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
