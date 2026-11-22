import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ExportPreviewResult } from '../api/exportApi';
import { ExportPageContent } from './ExportPage';

const render = (overrides?: { initialPreview?: ExportPreviewResult | null; initialPreviewPageIndex?: number }) =>
  renderToStaticMarkup(
    <ExportPageContent
      token="token"
      unitId="unidad-1"
      onSessionExpired={() => {}}
      initialPreview={overrides?.initialPreview}
      initialPreviewPageIndex={overrides?.initialPreviewPageIndex}
    />,
  );

describe('pestaña de exportación', () => {
  it('ofrece un botón por formato y carga el historial', () => {
    const html = render();
    expect(html).toContain('Exportación');
    expect(html).toContain('Descargar .zip');
    expect(html).toContain('Descargar .xml');
    expect(html).toContain('Descargar .html');
    expect(html).toContain('Vista previa');
    expect(html).toContain('Cargando tu historial de descargas…');
  });

  it('explica qué recursos entran en el archivo', () => {
    expect(render()).toContain('Solo se exportan los recursos aprobados con el respaldo vigente.');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    expect(render()).not.toMatch(/5E|Gemini|Wikipedia/);
  });

  it('renderiza la vista previa SCORM con sandbox="allow-scripts" y recursos excluidos formateados', () => {
    const previewData: ExportPreviewResult = {
      pages: [
        {
          number: 1,
          title: 'Introducción a Redes',
          html: '<html><body><h1>Introducción</h1></body></html>',
        },
        {
          number: 2,
          title: 'Cuestionario de Transporte',
          html: '<html><body><h1>Cuestionario</h1></body></html>',
        },
      ],
      excluded: [
        { reason: 'not_approved', count: 1 },
      ],
    };

    const htmlPage1 = render({ initialPreview: previewData, initialPreviewPageIndex: 0 });
    expect(htmlPage1).toContain('Vista previa SCORM · Página 1 de 2: Introducción a Redes');
    expect(htmlPage1).toContain('sandbox="allow-scripts"');
    expect(htmlPage1).toContain('1 recurso sin aprobar');
    expect(htmlPage1).toContain('Siguiente');
    expect(htmlPage1).toContain('Cerrar');

    const htmlPage2 = render({ initialPreview: previewData, initialPreviewPageIndex: 1 });
    expect(htmlPage2).toContain('Vista previa SCORM · Página 2 de 2: Cuestionario de Transporte');
  });

  it('no muestra el modal de vista previa cuando initialPreview es null', () => {
    const html = render({ initialPreview: null });
    expect(html).not.toContain('export-preview__iframe');
    expect(html).not.toContain('Vista previa SCORM · Página');
  });
});
