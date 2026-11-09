import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExportPageContent } from './ExportPage';

const render = () => renderToStaticMarkup(<ExportPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);

describe('pestaña de exportación', () => {
  it('ofrece un botón por formato y carga el historial', () => {
    const html = render();
    expect(html).toContain('Exportación');
    expect(html).toContain('Descargar .zip');
    expect(html).toContain('Descargar .xml');
    expect(html).toContain('Descargar .html');
    expect(html).toContain('Cargando tu historial de descargas…');
  });

  it('explica qué recursos entran en el archivo', () => {
    expect(render()).toContain('Solo se exportan los recursos aprobados con el respaldo vigente.');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    expect(render()).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});
