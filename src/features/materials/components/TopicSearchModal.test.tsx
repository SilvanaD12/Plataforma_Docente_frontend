import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TopicSearchModal } from './TopicSearchModal';

describe('TopicSearchModal', () => {
  it('no muestra el diálogo abierto si isOpen es false', () => {
    const html = renderToStaticMarkup(
      <TopicSearchModal isOpen={false} onClose={() => {}} onImport={async () => {}} />,
    );
    expect(html).not.toContain('open');
  });

  it('renderiza el formulario de búsqueda de fuente abierta cuando está abierto', () => {
    const html = renderToStaticMarkup(
      <TopicSearchModal isOpen={true} onClose={() => {}} onImport={async () => {}} />,
    );
    expect(html).toContain('Importar de fuente abierta');
    expect(html).toContain('Tema o concepto');
    expect(html).toContain('Cantidad de artículos');
    expect(html).toContain('Importar');
  });
});