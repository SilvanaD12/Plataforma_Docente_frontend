import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaterialPageContent } from './MaterialPage';

const mockUnit = {
  id: 'unidad-1',
  courseId: 'curso-1',
  number: 1,
  title: 'Unidad de Redes',
  outcomes: [],
};

describe('pestaña de material y evidencia', () => {
  it('renderiza el título y el estado de carga inicial', () => {
    const html = renderToStaticMarkup(
      <MaterialPageContent unit={mockUnit} token="token-test" onSessionExpired={() => {}} />,
    );
    expect(html).toContain('Material y Evidencia');
    expect(html).toContain('Cargando materiales…');
    expect(html).toContain('Cargar material didáctico');
  });

  it('incluye las secciones principales del módulo', () => {
    const html = renderToStaticMarkup(
      <MaterialPageContent unit={mockUnit} token="token-test" onSessionExpired={() => {}} />,
    );
    expect(html).toContain('Materiales registrados');
    expect(html).toContain('Búsqueda de evidencia en la unidad');
    expect(html).toContain('Importar de fuente abierta');
  });
});