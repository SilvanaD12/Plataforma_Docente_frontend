import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { exportUnit, previewExport, saveFile, type ExportPreviewResult } from '../api/exportApi';
import { DownloadHistory } from '../components/DownloadHistory';
import { EXPORT_FORMATS, exportFailure, formatExclusionReason, type ExportFormatId } from '../model/exportView';
import '../export.css';

/** Pestaña Exportación de la unidad. Lee la unidad y la sesión del contexto de `UnitLayout`. */
export function ExportPage() {
  const { unit, token, onSessionExpired } = useOutletContext<UnitContext>();
  return <ExportPageContent key={unit.id} token={token} unitId={unit.id} onSessionExpired={onSessionExpired} />;
}

interface ExportPageContentProps {
  token: string;
  unitId: string;
  onSessionExpired: (token: string) => void;
  initialPreview?: ExportPreviewResult | null;
  initialPreviewPageIndex?: number;
}

type Outcome = { tone: 'ok'; message: string } | { tone: 'warn'; message: string; reasons: string[] };

export function ExportPageContent({
  token,
  unitId,
  onSessionExpired,
  initialPreview = null,
  initialPreviewPageIndex = 0,
}: ExportPageContentProps) {
  const [exporting, setExporting] = useState<ExportFormatId | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [downloads, setDownloads] = useState(0);
  const [preview, setPreview] = useState<ExportPreviewResult | null>(initialPreview);
  const [previewPageIndex, setPreviewPageIndex] = useState(initialPreviewPageIndex);
  const [previewing, setPreviewing] = useState(false);

  async function download(format: ExportFormatId) {
    if (exporting || previewing) return;
    setExporting(format);
    setOutcome(null);
    try {
      const file = await exportUnit(token, unitId, format);
      saveFile(file.blob, file.fileName);
      setOutcome({ tone: 'ok', message: `Se descargó «${file.fileName}».` });
      setDownloads((count) => count + 1);
    } catch (error) {
      const failure = exportFailure(error);
      if (failure.status === 'expired') onSessionExpired(token);
      else setOutcome({ tone: 'warn', message: failure.message, reasons: failure.reasons });
    } finally {
      setExporting(null);
    }
  }

  async function handlePreview(format: ExportFormatId) {
    if (previewing || exporting !== null) return;
    setPreviewing(true);
    setOutcome(null);
    try {
      const res = await previewExport(token, unitId, format);
      setPreview(res);
      setPreviewPageIndex(0);
    } catch (error) {
      const failure = exportFailure(error);
      if (failure.status === 'expired') onSessionExpired(token);
      else setOutcome({ tone: 'warn', message: failure.message, reasons: failure.reasons });
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <section className="stack stack--loose">
      <div className="stack">
        <h2 className="h2">Exportación</h2>
        <p className="muted">
          Solo se exportan los recursos aprobados con el respaldo vigente. Si cambiaste un recurso aprobado, vuelve a
          aprobarlo en Revisión.
        </p>
      </div>

      {outcome && (
        <div className={outcome.tone === 'ok' ? 'alert' : 'alert alert--warn'} role={outcome.tone === 'ok' ? 'status' : 'alert'}>
          <p>{outcome.message}</p>
          {outcome.tone === 'warn' && outcome.reasons.length > 0 && (
            <ul>{outcome.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          )}
        </div>
      )}

      <div className="export-formats">
        {EXPORT_FORMATS.map((format) => (
          <article key={format.id} className="card stack">
            <h3 className="title">{format.title}</h3>
            <p>{format.description}</p>
            <div className="export-actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={exporting !== null || previewing}
                aria-busy={exporting === format.id}
                onClick={() => void download(format.id)}
              >
                Descargar .{format.extension}
              </button>
              {format.id === 'scorm_zip' && (
                <button
                  type="button"
                  className="btn btn--subtle"
                  disabled={exporting !== null || previewing}
                  aria-busy={previewing}
                  onClick={() => void handlePreview(format.id)}
                >
                  Vista previa
                </button>
              )}
            </div>
            <p className="muted">{format.howTo}</p>
          </article>
        ))}
      </div>

      {preview && preview.pages.length > 0 && (
        <article className="export-preview" aria-label="Vista previa de exportación SCORM">
          <div className="export-preview__header">
            <h3 className="h3">
              Vista previa SCORM · Página {preview.pages[previewPageIndex]?.number} de {preview.pages.length}:{' '}
              {preview.pages[previewPageIndex]?.title}
            </h3>
            <div className="export-preview__controls">
              <button
                type="button"
                className="btn btn--sm btn--subtle"
                disabled={previewPageIndex <= 0}
                onClick={() => setPreviewPageIndex((i) => i - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn--sm btn--subtle"
                disabled={previewPageIndex >= preview.pages.length - 1}
                onClick={() => setPreviewPageIndex((i) => i + 1)}
              >
                Siguiente
              </button>
              <button
                type="button"
                className="btn btn--sm btn--subtle"
                onClick={() => setPreview(null)}
              >
                Cerrar
              </button>
            </div>
          </div>

          {/* El iframe usa sandbox="allow-scripts" (sin allow-same-origin) para ejecutar la interactividad de la actividad/cuestionario de forma aislada sin acceso a cookies, localStorage ni origen de la aplicación. */}
          <iframe
            sandbox="allow-scripts"
            srcDoc={preview.pages[previewPageIndex]?.html ?? ''}
            title="Vista previa SCORM"
            className="export-preview__iframe"
          />

          {preview.excluded.length > 0 && (
            <div className="export-preview__excluded">
              <p><strong>Recursos excluidos de la vista previa:</strong></p>
              <ul>
                {preview.excluded.map((item) => (
                  <li key={item.reason}>
                    {formatExclusionReason(item.reason, item.count)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}

      <DownloadHistory token={token} onSessionExpired={onSessionExpired} refreshKey={downloads} />
    </section>
  );
}
