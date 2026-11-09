import { useState, useRef, useEffect, type FormEvent } from 'react';

interface TopicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (topic: string, maxResults: number) => Promise<void>;
}

export function TopicSearchModal({ isOpen, onClose, onImport }: TopicSearchModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [topic, setTopic] = useState('');
  const [maxResults, setMaxResults] = useState(1);
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
    if (topic.trim().length < 3) {
      setError('El tema debe contener al menos 3 caracteres.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onImport(topic.trim(), maxResults);
      setTopic('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo importar contenido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="card mat-dialog stack"
      aria-labelledby="modal-topic-title"
      onCancel={handleCancel}
    >
      <header className="mat-dialog__head">
        <h2 className="h2" id="modal-topic-title">Importar de fuente abierta</h2>
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
        Consulta artículos bajo licencia CC BY-SA 4.0 y agrégalos como material procesado a esta unidad.
      </p>

      {error && <p className="alert alert--warn" role="alert">{error}</p>}

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Tema o concepto</span>
          <input
            ref={inputRef}
            className="input"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej. Arquitectura cliente-servidor"
            disabled={isLoading}
          />
        </label>

        <label className="field">
          <span className="field__label">Cantidad de artículos</span>
          <select
            className="input"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={isLoading}
          >
            <option value={1}>1 artículo</option>
            <option value={2}>2 artículos</option>
            <option value={3}>3 artículos</option>
          </select>
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
            {isLoading ? 'Importando…' : 'Importar'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}