import { describe, expect, it } from 'vitest';
import { formatFileSize, validateUploadFile } from './materialValidation';

describe('materialValidation model', () => {
  it('rechaza archivos nulos', () => {
    expect(validateUploadFile(null)).toBe('Selecciona un archivo antes de continuar.');
  });

  it('rechaza extensiones no soportadas como .docx o .exe', () => {
    const fakeFile = new File(['dummy'], 'tarea.docx', { type: 'application/docx' });
    expect(validateUploadFile(fakeFile)).toBe('Formato no admitido. Selecciona un archivo PDF, PPTX o TXT.');
  });

  it('rechaza archivos que superen los 25 MB', () => {
    const largeFile = new File([''], 'grande.pdf');
    Object.defineProperty(largeFile, 'size', { value: 26 * 1024 * 1024 });
    expect(validateUploadFile(largeFile)).toBe('El archivo excede el tamaño máximo permitido de 25 MB.');
  });

  it('acepta archivos PDF, PPTX y TXT dentro del límite', () => {
    const validFile = new File(['contenido'], 'clase.pdf');
    expect(validateUploadFile(validFile)).toBeNull();
  });

  it('formatea correctamente los tamaños en bytes, KB y MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });
});