import { useEffect, useRef } from 'react';
import type { ChunkItem } from '../model/types';

interface ChunkListModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunks: ChunkItem[];
  isLoading: boolean;
  error?: string | null;
}

export function ChunkListModal({ isOpen, onClose, chunks, isLoading, error }: ChunkListModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      closeButtonRef.current?.focus();
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="card mat-dialog mat-dialog--wide stack"
      aria-labelledby="modal-chunks-title"
      onCancel={handleCancel}
    >
      <header className="mat-dialog__head">
        <div>
          <span className="overline">Evidencia indexada</span>
          <h2 className="h2" id="modal-chunks-title">Fragmentos extraídos</h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="mat-dialog__close"
          onClick={onClose}
          aria-label="Cerrar visor"
        >
          ×
        </button>
      </header>

      {error ? (
        <p className="alert alert--warn" role="alert">
          {error}
        </p>
      ) : (
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
      )}

      <footer className="mat-dialog__footer">
        <button type="button" className="btn" onClick={onClose}>
          Cerrar
        </button>
      </footer>
    </dialog>
  );
}