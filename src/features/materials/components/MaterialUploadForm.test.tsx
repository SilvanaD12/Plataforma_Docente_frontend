import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaterialUploadForm } from './MaterialUploadForm';

describe('MaterialUploadForm', () => {
  it('renderiza los campos de selección de archivo, tipo de documento y autorización', () => {
    const html = renderToStaticMarkup(
      <MaterialUploadForm
        unitId="unit-1"
        onUpload={async () => {}}
        isUploading={false}
      />,
    );

    expect(html).toContain('Cargar material didáctico');
    expect(html).toContain('Archivo (PDF, PPTX o TXT hasta 25 MB)');
    expect(html).toContain('Tipo de documento');
    expect(html).toContain('Separata o apuntes de clase');
    expect(html).toContain('Autorizo el procesamiento de este material');
    expect(html).toContain('Subir material');
  });

  it('muestra estado deshabilitado/ocupado mientras se realiza la carga', () => {
    const html = renderToStaticMarkup(
      <MaterialUploadForm
        unitId="unit-1"
        onUpload={async () => {}}
        isUploading={true}
      />,
    );

    expect(html).toContain('Subiendo material…');
    expect(html).toContain('aria-busy="true"');
  });
});