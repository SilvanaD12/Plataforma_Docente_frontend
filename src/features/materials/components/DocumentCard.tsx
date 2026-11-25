import { useState } from 'react';
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

const WEB_DOCUMENT_TYPES = new Set(['Página web', 'Artículo de fuente abierta']);

export function DocumentCard({
  document,
  onProcess,
  onDelete,
  onDownload,
  onViewChunks,
  isProcessing,
}: DocumentCardProps) {
  const [dismissedRelevance, setDismissedRelevance] = useState(false);
  const [dismissedDuplicate, setDismissedDuplicate] = useState(false);

  const isError = document.status === 'error';
  const isProcessed = document.status === 'procesado';
  const isWebMaterial =
    Boolean(document.origin?.url) || WEB_DOCUMENT_TYPES.has(document.documentType);

  const showRelevanceWarning = Boolean(document.relevanceWarning) && !dismissedRelevance;
  const showDuplicateWarning = Boolean(document.duplicateWarning) && !dismissedDuplicate;

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
        {!isWebMaterial && document.pageCount ? <span>{document.pageCount} páginas</span> : null}
      </div>

      {isError && document.errorMessage && (
        <p className="alert alert--warn" role="alert">
          {document.errorMessage}
        </p>
      )}

      {showDuplicateWarning && (
        <div className="alert alert--warn" role="status">
          <p style={{ margin: 0 }}>{document.duplicateWarning}</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setDismissedDuplicate(true)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {showRelevanceWarning && (
        <div className="alert alert--warn" role="alert">
          <p style={{ margin: 0 }}>{document.relevanceWarning}</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setDismissedRelevance(true)}
            >
              Conservar
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(document.id)}
            >
              Eliminar
            </button>
          </div>
        </div>
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