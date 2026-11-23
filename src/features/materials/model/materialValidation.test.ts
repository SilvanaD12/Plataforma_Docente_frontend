import { describe, expect, it } from 'vitest';
import { formatFileSize, validateImportUrl, validateUploadFile } from './materialValidation';

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

  it('valida URLs públicas para importación web', () => {
    expect(validateImportUrl('')).toBe('Ingresa una URL pública antes de continuar.');
    expect(validateImportUrl('no-es-url')).toBe('Ingresa una URL válida que comience con http:// o https://.');
    expect(validateImportUrl('ftp://ejemplo.com/archivo.txt')).toBe('Solo se admiten URLs con protocolo http:// o https://.');
    expect(validateImportUrl('http://localhost:8000')).toBe('No se permiten direcciones locales o privadas.');
    expect(validateImportUrl('https://es.wikipedia.org/wiki/Modelo_OSI')).toBeNull();
  });

  it('formatea correctamente los tamaños en bytes, KB y MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });
});