import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import type { UnitContext } from '../../../shared/types/courses';
import { exportUnit, listDownloads, saveFile } from '../api/exportApi';
import {
  EXPORT_FORMATS,
  exportFailure,
  historyMessage,
  historyRow,
  type ExportFormatId,
  type HistoryState,
} from '../model/exportView';
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
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' });
  const [exporting, setExporting] = useState<ExportFormatId | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function loadHistory(active: () => boolean = () => true) {
    try {
      const downloads = await listDownloads(token);
      if (active()) setHistory({ status: 'ready', downloads });
    } catch (error) {
      if (!active()) return;
      if (error instanceof ApiError && error.status === 401) onSessionExpired(token);
      setHistory({ status: 'error', message: errorMessage(error) });
    }
  }

  useEffect(() => {
    let active = true;
    void loadHistory(() => active);
    return () => { active = false; };
  }, [token, unitId]); // se carga una vez por sesión y unidad

  async function download(format: ExportFormatId) {
    if (exporting) return;
    setExporting(format);
    setOutcome(null);
    try {
      const file = await exportUnit(token, unitId, format);
      saveFile(file.blob, file.fileName);
      setOutcome({ tone: 'ok', message: `Se descargó «${file.fileName}».` });
      await loadHistory();
    } catch (error) {
      const failure = exportFailure(error);
      if (failure.status === 'expired') onSessionExpired(token);
      else setOutcome({ tone: 'warn', message: failure.message, reasons: failure.reasons });
    } finally {
      setExporting(null);
    }
  }

  const message = historyMessage(history);
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

      <section className="card stack" aria-labelledby="export-history-title">
        <h3 id="export-history-title" className="title">Tus descargas</h3>
        {message && (
          <p className={history.status === 'error' ? 'alert alert--warn' : 'muted'} role={history.status === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        )}
        {history.status === 'ready' && history.downloads.length > 0 && (
          <div className="export-history">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Formato</th>
                  <th scope="col">Archivo</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {history.downloads.map(historyRow).map((row) => (
                  <tr key={row.id}>
                    <td data-label="Fecha">{row.date}</td>
                    <td data-label="Formato">{row.format}</td>
                    <td data-label="Archivo" className="export-history__file">{row.fileName}</td>
                    <td data-label="Curso">{row.course}</td>
                    <td data-label="Unidad">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
