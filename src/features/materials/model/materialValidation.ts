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

export function validateImportUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return 'Ingresa una URL pública antes de continuar.';
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Ingresa una URL válida que comience con http:// o https://.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Solo se admiten URLs con protocolo http:// o https://.';
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return 'No se permiten direcciones locales o privadas.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}