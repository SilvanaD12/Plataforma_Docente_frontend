import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { exportUnit, saveFile } from '../api/exportApi';
import { DownloadHistory } from '../components/DownloadHistory';
import { EXPORT_FORMATS, exportFailure, type ExportFormatId } from '../model/exportView';
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
}

type Outcome = { tone: 'ok'; message: string } | { tone: 'warn'; message: string; reasons: string[] };

export function ExportPageContent({ token, unitId, onSessionExpired }: ExportPageContentProps) {
  const [exporting, setExporting] = useState<ExportFormatId | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [downloads, setDownloads] = useState(0);

  async function download(format: ExportFormatId) {
    if (exporting) return;
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
            <button
              type="button"
              className="btn btn--primary"
              disabled={exporting !== null}
              aria-busy={exporting === format.id}
              onClick={() => void download(format.id)}
            >
              Descargar .{format.extension}
            </button>
            <p className="muted">{format.howTo}</p>
          </article>
        ))}
      </div>

      <DownloadHistory token={token} onSessionExpired={onSessionExpired} refreshKey={downloads} />
    </section>
  );
}
