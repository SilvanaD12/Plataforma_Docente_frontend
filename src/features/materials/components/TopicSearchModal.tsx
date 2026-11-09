import { useState, FormEvent } from 'react';

interface TopicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (topic: string, maxResults: number) => Promise<void>;
}

export function TopicSearchModal({ isOpen, onClose, onImport }: TopicSearchModalProps) {
  const [topic, setTopic] = useState('');
  const [maxResults, setMaxResults] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      setError(err instanceof Error ? err.message : 'No se pudo obtener contenido de la fuente abierta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mat-modal-overlay">
      <div className="mat-modal-content">
        <div className="mat-modal-header">
          <h3>Importar material desde fuente abierta</h3>
          <button type="button" className="mat-close-btn" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="mat-modal-desc">
            Consulta artículos enciclopédicos con licencia libre (CC BY-SA 4.0) y los incorpora como
            material procesado para la unidad.
          </p>

          <div className="mat-form-group">
            <label htmlFor="topic-input">Tema o concepto:</label>
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. Protocolo de control de transmisión"
              disabled={isLoading}
            />
          </div>

          <div className="mat-form-group">
            <label htmlFor="max-results">Cantidad de artículos:</label>
            <select
              id="max-results"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              disabled={isLoading}
            >
              <option value={1}>1 artículo</option>
              <option value={2}>2 artículos</option>
              <option value={3}>3 artículos</option>
            </select>
          </div>

          {error && <div className="mat-form-error">{error}</div>}

          <div className="mat-modal-actions">
            <button type="button" className="mat-btn mat-btn-ghost" onClick={onClose} disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="mat-btn mat-btn-primary" disabled={isLoading}>
              {isLoading ? 'Consultando...' : 'Buscar e importar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}