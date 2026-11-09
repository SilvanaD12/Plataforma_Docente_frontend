import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChunkListModal } from './ChunkListModal';

describe('ChunkListModal', () => {
  it('no renderiza nada si isOpen es false', () => {
    const html = renderToStaticMarkup(
      <ChunkListModal isOpen={false} onClose={() => {}} chunks={[]} isLoading={false} />,
    );
    expect(html).toBe('');
  });

  it('renderiza la lista de fragmentos indexados cuando está abierto', () => {
    const mockChunks = [
      { id: 'ch-1', documentId: 'doc-1', text: 'Texto de prueba del chunk', order: 0, location: 'Página 2' },
    ];
    const html = renderToStaticMarkup(
      <ChunkListModal isOpen={true} onClose={() => {}} chunks={mockChunks} isLoading={false} />,
    );
    expect(html).toContain('Fragmentos extraídos');
    expect(html).toContain('Fragmento #1');
    expect(html).toContain('Página 2');
    expect(html).toContain('Texto de prueba del chunk');
  });

  it('muestra aviso cuando no hay fragmentos disponibles', () => {
    const html = renderToStaticMarkup(
      <ChunkListModal isOpen={true} onClose={() => {}} chunks={[]} isLoading={false} />,
    );
    expect(html).toContain('No hay fragmentos disponibles.');
  });
});