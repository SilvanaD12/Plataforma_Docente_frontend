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

  return (
    <div className={`mat-document-card mat-status-${document.status}`}>
      <div className="mat-card-header">
        <div className="mat-file-info">
          <span className="mat-kind-badge">{document.kind.toUpperCase()}</span>
          <h4 className="mat-file-name" title={document.fileName}>
            {document.fileName}
          </h4>
        </div>
        <span className={`mat-status-tag mat-tag-${document.status}`}>
          {document.status}
        </span>
      </div>

      <div className="mat-card-body">
        <p className="mat-metadata">
          <span><strong>Tamaño:</strong> {formatSize(document.sizeBytes)}</span>
          <span><strong>Tipo:</strong> {document.documentType}</span>
          {document.pageCount ? <span><strong>Páginas:</strong> {document.pageCount}</span> : null}
          {document.fragmentCount > 0 ? (
            <span><strong>Fragmentos:</strong> {document.fragmentCount} (~220 palabras)</span>
          ) : null}
        </p>

        {/* Motivo visible del error en caso de fallo */}
        {document.status === 'error' && document.errorMessage && (
          <div className="mat-error-banner" role="alert">
            <strong>Motivo del fallo:</strong> {document.errorMessage}
          </div>
        )}

        {document.origin && (
          <div className="mat-origin-badge">
            Fuente abierta: <em>{document.origin.topic}</em> ({document.origin.source})
          </div>
        )}
      </div>

      <div className="mat-card-actions">
        {document.status === 'registrado' && (
          <button
            type="button"
            className="mat-btn mat-btn-primary"
            onClick={() => onProcess(document.id)}
            disabled={isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Procesar material'}
          </button>
        )}

        {document.status === 'procesado' && (
          <button
            type="button"
            className="mat-btn mat-btn-secondary"
            onClick={() => onViewChunks(document.id)}
          >
            Ver fragmentos ({document.fragmentCount})
          </button>
        )}

        <button
          type="button"
          className="mat-btn mat-btn-ghost"
          onClick={() => onDownload(document.id, document.fileName)}
        >
          Descargar
        </button>

        <button
          type="button"
          className="mat-btn mat-btn-danger-ghost"
          onClick={() => onDelete(document.id)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}