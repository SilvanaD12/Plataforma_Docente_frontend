import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EvidenceSearchPanel } from './EvidenceSearchPanel';

describe('EvidenceSearchPanel', () => {
  it('renderiza el formulario de consulta de evidencias', () => {
    const html = renderToStaticMarkup(
      <EvidenceSearchPanel onSearch={async () => []} />,
    );

    expect(html).toContain('Búsqueda de evidencia en la unidad');
    expect(html).toContain('Términos de búsqueda');
    expect(html).toContain('Buscar evidencias');
  });
});