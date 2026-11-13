import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaterialUploadForm } from './MaterialUploadForm';

const unitWithoutOutcomes = {
  id: 'unit-1',
  courseId: 'course-1',
  number: 1,
  title: 'Unidad de Redes',
  outcomes: [],
};

const unitWithOutcomes = {
  id: 'unit-2',
  courseId: 'course-1',
  number: 2,
  title: 'Unidad de Seguridad',
  outcomes: [
    { id: 'out-1', code: 'RA-01', text: 'Configurar políticas de firewall' },
    { id: 'out-2', code: null, text: 'Analizar tráfico de red con Wireshark' },
  ],
};

describe('MaterialUploadForm', () => {
  it('renderiza los campos de selección de archivo, tipo de documento y autorización', () => {
    const html = renderToStaticMarkup(
      <MaterialUploadForm
        unit={unitWithoutOutcomes}
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
    expect(html).not.toContain('Resultados de aprendizaje de la unidad');
  });

  it('renderiza el selector de resultados de aprendizaje cuando la unidad los tiene configurados', () => {
    const html = renderToStaticMarkup(
      <MaterialUploadForm
        unit={unitWithOutcomes}
        onUpload={async () => {}}
        isUploading={false}
      />,
    );

    expect(html).toContain('Resultados de aprendizaje de la unidad');
    expect(html).toContain('RA-01: Configurar políticas de firewall');
    expect(html).toContain('Analizar tráfico de red con Wireshark');
  });

  it('muestra estado deshabilitado/ocupado mientras se realiza la carga', () => {
    const html = renderToStaticMarkup(
      <MaterialUploadForm
        unit={unitWithoutOutcomes}
        onUpload={async () => {}}
        isUploading={true}
      />,
    );

    expect(html).toContain('Subiendo material…');
    expect(html).toContain('aria-busy="true"');
  });
});