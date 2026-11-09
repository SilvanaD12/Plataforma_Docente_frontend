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
      setError('Debes confirmar la autorización de uso del material.');
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
    <form className="mat-upload-form" onSubmit={handleSubmit}>
      <h3>Subir nuevo material docente</h3>

      <div className="mat-form-group">
        <label htmlFor="material-file-input">Archivo (PDF, PPTX o TXT hasta 25 MB):</label>
        <input
          id="material-file-input"
          type="file"
          accept=".pdf,.pptx,.txt"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      <div className="mat-form-group">
        <label htmlFor="document-type-select">Tipo de documento:</label>
        <select
          id="document-type-select"
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
      </div>

      <div className="mat-checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={usePermission}
            onChange={(e) => setUsePermission(e.target.checked)}
            disabled={isUploading}
          />
          Autorizo el procesamiento de este material para la generación de recursos didácticos 5E.
        </label>
      </div>

      {error && <div className="mat-form-error">{error}</div>}

      <button type="submit" className="mat-btn mat-btn-primary" disabled={!file || isUploading}>
        {isUploading ? 'Subiendo archivo...' : 'Cargar material'}
      </button>
    </form>
  );
}