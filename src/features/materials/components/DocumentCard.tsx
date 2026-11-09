import type { DocumentItem } from '../model/types';
import { formatFileSize } from '../model/materialValidation';

interface DocumentCardProps {
  document: DocumentItem;
  onProcess: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  onViewChunks: (id: string, triggerElement: HTMLElement) => void;
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
  const isError = document.status === 'error';
  const isProcessed = document.status === 'procesado';

  return (
    <article className={`mat-item ${isError ? 'mat-item--error' : ''}`}>
      <div className="mat-item__head">
        <h4 className="mat-item__title">{document.fileName}</h4>
        <span className={`mat-badge mat-badge--${document.status}`}>
          {document.status}
        </span>
      </div>

      <div className="mat-meta">
        <span>{document.documentType}</span>
        <span>{formatFileSize(document.sizeBytes)}</span>
        {document.pageCount ? <span>{document.pageCount} páginas</span> : null}
      </div>

      {isError && document.errorMessage && (
        <p className="alert alert--warn" role="alert">
          {document.errorMessage}
        </p>
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

        {isProcessed && (
          <button
            type="button"
            className="btn"
            onClick={(e) => onViewChunks(document.id, e.currentTarget)}
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
          className="btn btn--danger"
          onClick={() => onDelete(document.id)}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}