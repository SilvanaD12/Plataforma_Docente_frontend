import { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { listDownloads } from '../api/exportApi';
import { historyMessage, historyRow, type HistoryState } from '../model/exportView';
import '../export.css';

interface DownloadHistoryProps {
  token: string;
  onSessionExpired: (token: string) => void;
  /** Cambia después de cada descarga, para volver a pedir el historial. */
  refreshKey?: number;
  title?: string;
}

/**
 * «Tus descargas»: el historial del docente en todas sus unidades (REV-C9). Se usa en la pestaña Exportación y en
 * «Mis descargas», que no depende de ningún curso.
 */
export function DownloadHistory({ token, onSessionExpired, refreshKey = 0, title = 'Tus descargas' }: DownloadHistoryProps) {
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    listDownloads(token)
      .then((downloads) => { if (active) setHistory({ status: 'ready', downloads }); })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired(token);
        setHistory({ status: 'error', message: errorMessage(error) });
      });
    return () => { active = false; };
  }, [token, onSessionExpired, refreshKey]);

  const message = historyMessage(history);
  return (
    <section className="card stack" aria-labelledby="export-history-title">
      <h3 id="export-history-title" className="title">{title}</h3>
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
  );
}
