import { ChunkItem } from '../model/types';

interface ChunkListModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunks: ChunkItem[];
  isLoading: boolean;
}

export function ChunkListModal({ isOpen, onClose, chunks, isLoading }: ChunkListModalProps) {
  if (!isOpen) return null;

  return (
    <div className="mat-modal-overlay">
      <div className="mat-modal-content mat-modal-lg">
        <div className="mat-modal-header">
          <h3>Fragmentos de evidencia procesados</h3>
          <button type="button" className="mat-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mat-chunks-container">
          {isLoading ? (
            <p className="mat-loading">Cargando fragmentos...</p>
          ) : chunks.length === 0 ? (
            <p className="mat-empty">No se encontraron fragmentos para este documento.</p>
          ) : (
            chunks.map((chunk) => (
              <div key={chunk.id} className="mat-chunk-card">
                <div className="mat-chunk-meta">
                  <span><strong>#{chunk.order + 1}</strong></span>
                  <span className="mat-chunk-loc">{chunk.location}</span>
                </div>
                <p className="mat-chunk-text">{chunk.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="mat-modal-actions">
          <button type="button" className="mat-btn mat-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}