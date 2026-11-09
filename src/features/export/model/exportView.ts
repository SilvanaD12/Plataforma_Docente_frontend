import { ApiError, errorMessage } from '../../../shared/api/httpClient';

export type ExportFormatId = 'scorm_zip' | 'moodle_xml' | 'documento';

export interface ExportFormat {
  id: ExportFormatId;
  title: string;
  description: string;
  extension: 'zip' | 'xml' | 'html';
  howTo: string;
}

/** Los tres formatos del backend. Todos usan el mismo filtro: aprobados con el respaldo vigente (REV-C7). */
export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'scorm_zip',
    title: 'SCORM (Chamilo o Canvas)',
    description: 'Paquete SCORM 1.2: una página por recurso, con sus gráficos, audios y preguntas calificadas.',
    extension: 'zip',
    howTo: 'En Chamilo: Lecciones › Importar AICC, SCORM y Chamilo. En Canvas: la herramienta SCORM del curso.',
  },
  {
    id: 'moodle_xml',
    title: 'Moodle',
    description: 'Banco de preguntas con los ítems de opción múltiple.',
    extension: 'xml',
    howTo: 'En Moodle: Banco de preguntas › Importar › Formato Moodle XML.',
  },
  {
    id: 'documento',
    title: 'Documento de la unidad',
    description: 'Página para imprimir o compartir, con la evidencia de cada recurso.',
    extension: 'html',
    howTo: 'Se abre en cualquier navegador y se puede guardar como PDF.',
  },
];

export function exportFormat(id: string): ExportFormat | undefined {
  return EXPORT_FORMATS.find((format) => format.id === id);
}

export interface Download {
  id: string;
  unitId: string;
  format: string;
  fileName: string;
  resourceCount: number;
  createdAt: string;
  courseId: string | null;
  courseName: string | null;
  unitName: string | null;
  unitNumber: number | null;
}

/** Motivos de `details` del 422 NO_APPROVED_RESOURCES, en el orden del filtro común del backend. */
const REASONS: Record<string, string> = {
  not_approved: 'sin aprobar',
  verification_missing: 'sin comprobación del respaldo',
  verification_outdated: 'cuyo texto cambió después de la última comprobación',
  verification_insufficient: 'con respaldo insuficiente en el material',
  verification_pending: 'con la comprobación del respaldo pendiente',
  media_invalidated: 'con la imagen o el audio por generar de nuevo',
  unsupported_format: 'que este formato no admite',
};

export type ExportFailure = { status: 'expired' } | { status: 'error'; message: string; reasons: string[] };

function reasonLines(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((detail) => {
    if (typeof detail?.reason !== 'string' || typeof detail?.count !== 'number') return [];
    const count: number = detail.count;
    return [`${count} ${count === 1 ? 'recurso' : 'recursos'} ${REASONS[detail.reason] ?? 'por otro motivo'}`];
  });
}

/**
 * Qué mostrar cuando la exportación falla. Con el 422 se listan los motivos de `details`; si no vienen, queda solo el
 * `message` de la API (acordado con Silvana el 2026-11-08). Un 401 devuelve al acceso.
 */
export function exportFailure(error: unknown): ExportFailure {
  if (error instanceof ApiError && error.status === 401) return { status: 'expired' };
  const reasons = error instanceof ApiError && error.code === 'NO_APPROVED_RESOURCES' ? reasonLines(error.details) : [];
  return { status: 'error', message: errorMessage(error), reasons };
}

export interface HistoryRow {
  id: string;
  date: string;
  format: string;
  fileName: string;
  course: string;
  unit: string;
}

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Una fila del historial del docente (REV-C9). Los registros nuevos guardan el curso y la unidad al exportar y los
 * conservan aunque se borre el curso; solo los antiguos de un curso borrado llegan sin nombre.
 */
export function historyRow(download: Download): HistoryRow {
  const date = new Date(download.createdAt);
  const unit = download.unitNumber !== null && download.unitName
    ? `Unidad ${download.unitNumber} · ${download.unitName}`
    : download.unitName ?? 'Unidad sin datos';
  return {
    id: download.id,
    date: Number.isNaN(date.getTime()) ? download.createdAt : dateFormat.format(date),
    format: exportFormat(download.format)?.title ?? download.format,
    fileName: download.fileName,
    course: download.courseName ?? 'Curso eliminado',
    unit,
  };
}

export type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; downloads: Download[] }
  | { status: 'error'; message: string };

export function historyMessage(state: HistoryState): string | null {
  if (state.status === 'loading') return 'Cargando tu historial de descargas…';
  if (state.status === 'error') return state.message;
  return state.downloads.length === 0 ? 'Todavía no descargaste archivos.' : null;
}
