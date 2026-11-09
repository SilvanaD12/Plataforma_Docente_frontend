import { DocumentItem } from '../model/types';

interface DocumentCardProps {
  document: DocumentItem;
  onProcess: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  onViewChunks: (id: string) => void;
  isProcessing: boolean;
}

export function DocumentCard({
  document,
  onProcess,
  onDelete,
  onDownload,
  onViewChunks,
  isProcessing,
}: DocumentCardProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isError = document.status === 'error';

  return (
    <article className={`mat-item ${isError ? 'mat-item--error' : ''}`}>
      <div className="mat-item__head">
        <div>
          <span className="overline">{document.kind}</span>
          <h4 className="mat-item__title">{document.fileName}</h4>
        </div>
        <span className={`mat-badge mat-badge--${document.status}`}>
          {document.status}
        </span>
      </div>

      <div className="mat-meta">
        <span><strong>Tamaño:</strong> {formatSize(document.sizeBytes)}</span>
        <span><strong>Tipo:</strong> {document.documentType}</span>
        {document.pageCount ? <span><strong>Páginas:</strong> {document.pageCount}</span> : null}
        {document.fragmentCount > 0 ? (
          <span><strong>Fragmentos:</strong> {document.fragmentCount}</span>
        ) : null}
        {document.origin && (
          <span className="muted">
            Fuente abierta: <em>{document.origin.topic}</em>
          </span>
        )}
      </div>

      {isError && document.errorMessage && (
        <p className="alert alert--warn" role="alert">{document.errorMessage}</p>
      )}

      <div className="mat-actions">
        {document.status === 'registrado' && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onProcess(document.id)}
            disabled={isProcessing}
            aria-busy={isProcessing}
          >
            {isProcessing ? 'Procesando…' : 'Procesar'}
          </button>
        )}

        {document.status === 'procesado' && (
          <button
            type="button"
            className="btn"
            onClick={() => onViewChunks(document.id)}
          >
            Ver fragmentos ({document.fragmentCount})
          </button>
        )}

        <button
          type="button"
          className="btn"
          onClick={() => onDownload(document.id, document.fileName)}
        >
          Descargar
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => onDelete(document.id)}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}