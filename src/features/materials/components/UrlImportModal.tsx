import { useState, useRef, useEffect, type FormEvent } from 'react';
import { validateImportUrl } from '../model/materialValidation';

interface UrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => Promise<void>;
}

export function UrlImportModal({ isOpen, onClose, onImport }: UrlImportModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      inputRef.current?.focus();
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isLoading) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateImportUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onImport(url.trim());
      setUrl('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la página web.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="card mat-dialog stack"
      aria-labelledby="modal-url-title"
      onCancel={handleCancel}
    >
      <header className="mat-dialog__head">
        <h2 className="h2" id="modal-url-title">Importar desde URL</h2>
        <button
          type="button"
          className="mat-dialog__close"
          onClick={onClose}
          aria-label="Cerrar ventana"
          disabled={isLoading}
        >
          ×
        </button>
      </header>

      <p className="field__hint">
        Ingresa el enlace de una página web pública para extraer su contenido limpio e indexarlo en esta unidad.
      </p>

      {error && <p className="alert alert--warn" role="alert">{error}</p>}

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">URL de la página web</span>
          <input
            ref={inputRef}
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://es.wikipedia.org/wiki/Modelo_OSI"
            disabled={isLoading}
          />
        </label>

        <footer className="mat-dialog__footer">
          <button type="button" className="btn" onClick={onClose} disabled={isLoading}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Importando…' : 'Importar URL'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}