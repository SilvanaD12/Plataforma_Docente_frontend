import { useState, ChangeEvent, FormEvent } from 'react';
import { UploadContextPayload } from '../model/types';

interface MaterialUploadFormProps {
  unitId: string;
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

export function MaterialUploadForm({ unitId, onUpload, isUploading }: MaterialUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [usePermission, setUsePermission] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Selecciona un archivo antes de continuar.');
      return;
    }
    if (!usePermission) {
      setError('Debes autorizar el uso del material.');
      return;
    }

    try {
      setError(null);
      await onUpload(file, {
        unitId,
        outcomeIds: [],
        documentType,
        usePermission: true,
      });
      setFile(null);
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
            disabled={!file || isUploading}
            aria-busy={isUploading}
          >
            {isUploading ? 'Subiendo material…' : 'Subir material'}
          </button>
        </div>
      </form>
    </section>
  );
}