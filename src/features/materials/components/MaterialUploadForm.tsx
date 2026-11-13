import { useState, ChangeEvent, FormEvent } from 'react';
import type { Unit } from '../../../shared/types/courses';
import { UploadContextPayload } from '../model/types';

interface MaterialUploadFormProps {
  unit: Unit;
  onUpload: (file: File, context: UploadContextPayload) => Promise<void>;
  isUploading: boolean;
}

const DOCUMENT_TYPES = [
  'Separata o apuntes de clase',
  'Diapositivas de clase',
  'Guía de laboratorio o práctica',
  'Lectura académica o artículo',
  'Otro material didáctico',
];

export function MaterialUploadForm({ unit, onUpload, isUploading }: MaterialUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [usePermission, setUsePermission] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasOutcomes = unit.outcomes.length > 0;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'pptx', 'txt'].includes(ext || '')) {
      setError('Formato no admitido. Selecciona un archivo PDF, PPTX o TXT.');
      setFile(null);
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setError('El archivo excede el tamaño máximo permitido de 25 MB.');
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleToggleOutcome = (outcomeId: string) => {
    setError(null);
    setSelectedOutcomeIds((prev) =>
      prev.includes(outcomeId)
        ? prev.filter((id) => id !== outcomeId)
        : [...prev, outcomeId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Selecciona un archivo antes de continuar.');
      return;
    }
    if (hasOutcomes && selectedOutcomeIds.length === 0) {
      setError('Selecciona resultados de aprendizaje de esta unidad.');
      return;
    }
    if (!usePermission) {
      setError('Debes autorizar el uso del material.');
      return;
    }

    try {
      setError(null);
      await onUpload(file, {
        unitId: unit.id,
        outcomeIds: hasOutcomes ? selectedOutcomeIds : [],
        documentType,
        usePermission: true,
      });
      setFile(null);
      setSelectedOutcomeIds([]);
      const input = document.getElementById('material-file-input') as HTMLInputElement;
      if (input) input.value = '';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir el material.');
    }
  };

  return (
    <section className="card" aria-labelledby="form-upload-title">
      <h3 className="title" id="form-upload-title">Cargar material didáctico</h3>
      {error && <p className="alert alert--warn" role="alert">{error}</p>}

      <form className="stack" onSubmit={handleSubmit}>
        <div className="course-form-grid">
          <label className="field">
            <span className="field__label">Archivo (PDF, PPTX o TXT hasta 25 MB)</span>
            <input
              id="material-file-input"
              className="input"
              type="file"
              accept=".pdf,.pptx,.txt"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>

          <label className="field">
            <span className="field__label">Tipo de documento</span>
            <select
              className="input"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              disabled={isUploading}
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasOutcomes && (
          <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }} disabled={isUploading}>
            <legend className="field__label">Resultados de aprendizaje de la unidad</legend>
            {unit.outcomes.map((outcome) => (
              <label key={outcome.id} className="mat-checkbox">
                <input
                  type="checkbox"
                  checked={selectedOutcomeIds.includes(outcome.id)}
                  onChange={() => handleToggleOutcome(outcome.id)}
                />
                <span>{outcome.code ? `${outcome.code}: ${outcome.text}` : outcome.text}</span>
              </label>
            ))}
          </fieldset>
        )}

        <label className="mat-checkbox">
          <input
            type="checkbox"
            checked={usePermission}
            onChange={(e) => setUsePermission(e.target.checked)}
            disabled={isUploading}
          />
          <span>Autorizo el procesamiento de este material para la generación de recursos 5E.</span>
        </label>

        <div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!file || isUploading || (hasOutcomes && selectedOutcomeIds.length === 0)}
            aria-busy={isUploading}
          >
            {isUploading ? 'Subiendo material…' : 'Subir material'}
          </button>
        </div>
      </form>
    </section>
  );
}