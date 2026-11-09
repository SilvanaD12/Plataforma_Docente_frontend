export const ALLOWED_EXTENSIONS = ['pdf', 'pptx', 'txt'] as const;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateUploadFile(file: File | null): string | null {
  if (!file) {
    return 'Selecciona un archivo antes de continuar.';
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return 'Formato no admitido. Selecciona un archivo PDF, PPTX o TXT.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'El archivo excede el tamaño máximo permitido de 25 MB.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}