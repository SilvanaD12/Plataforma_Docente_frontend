import { DownloadHistory } from '../components/DownloadHistory';

interface DownloadsPageProps {
  token: string;
  onSessionExpired: (token: string) => void;
}

/**
 * «Mis descargas»: el historial del docente fuera de cualquier curso, para verlo aunque ya no tenga cursos
 * (revisión de Silvana en el PR #7 · REV-C9).
 */
export function DownloadsPage({ token, onSessionExpired }: DownloadsPageProps) {
  return (
    <div className="stack stack--loose">
      <header className="stack course-heading">
        <h1>Mis descargas</h1>
        <p className="muted">
          Los archivos que exportaste desde tus unidades. Los registros se conservan aunque borres el curso; el archivo
          no se guarda, así que para tenerlo otra vez expórtalo de nuevo desde su unidad.
        </p>
      </header>
      <DownloadHistory token={token} onSessionExpired={onSessionExpired} title="Historial" />
    </div>
  );
}
