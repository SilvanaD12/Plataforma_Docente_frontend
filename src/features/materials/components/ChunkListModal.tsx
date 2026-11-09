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
    <div className="mat-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-chunks-title">
      <div className="card mat-dialog mat-dialog--wide stack">
        <header className="mat-dialog__head">
          <div>
            <span className="overline">Evidencia indexada</span>
            <h2 className="h2" id="modal-chunks-title">Fragmentos extraídos</h2>
          </div>
          <button
            type="button"
            className="mat-dialog__close"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>

        <div className="mat-chunk-list">
          {isLoading ? (
            <p className="muted" role="status">Cargando fragmentos…</p>
          ) : chunks.length === 0 ? (
            <p className="muted">No hay fragmentos disponibles.</p>
          ) : (
            chunks.map((chunk) => (
              <article key={chunk.id} className="mat-chunk-card">
                <div className="mat-chunk-meta">
                  <strong>Fragmento #{chunk.order + 1}</strong>
                  <span>{chunk.location}</span>
                </div>
                <p>{chunk.text}</p>
              </article>
            ))
          )}
        </div>

        <footer className="mat-dialog__footer">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}