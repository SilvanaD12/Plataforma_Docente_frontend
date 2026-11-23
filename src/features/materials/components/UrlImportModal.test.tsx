import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UrlImportModal } from './UrlImportModal';

describe('UrlImportModal', () => {
  it('no muestra el diálogo abierto si isOpen es false', () => {
    const html = renderToStaticMarkup(
      <UrlImportModal isOpen={false} onClose={() => {}} onImport={async () => {}} />,
    );
    expect(html).not.toContain('open');
  });

  it('renderiza el formulario de importación desde URL cuando está abierto', () => {
    const html = renderToStaticMarkup(
      <UrlImportModal isOpen={true} onClose={() => {}} onImport={async () => {}} />,
    );
    expect(html).toContain('Importar desde URL');
    expect(html).toContain('URL de la página web');
    expect(html).toContain('Importar URL');
  });
});