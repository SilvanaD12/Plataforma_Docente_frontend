import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentCard } from './DocumentCard';
import type { DocumentItem } from '../model/types';

function createMockDocument(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc-123',
    unitId: 'unit-1',
    fileName: 'diapositivas_redes.pdf',
    kind: 'pdf',
    outcomeIds: [],
    documentType: 'Diapositivas de clase',
    sizeBytes: 2097152,
    status: 'registrado',
    registeredAt: '2026-11-09T04:00:00+00:00',
    fragmentCount: 0,
    pageCount: 15,
    ...overrides,
  };
}

describe('DocumentCard', () => {
  it('renderiza la información del documento en estado registrado', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument()}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).toContain('diapositivas_redes.pdf');
    expect(html).toContain('2.0 MB');
    expect(html).toContain('Diapositivas de clase');
    expect(html).toContain('registrado');
    expect(html).toContain('Procesar');
  });

  it('muestra el botón para ver fragmentos cuando el estado es procesado', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument({ status: 'procesado', fragmentCount: 12 })}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).toContain('procesado');
    expect(html).toContain('Ver fragmentos (12)');
  });

  it('muestra el mensaje de alerta si el documento está en estado de error', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument({
          status: 'error',
          errorMessage: 'El archivo está dañado o protegido con contraseña.',
        })}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).toContain('alert--warn');
    expect(html).toContain('El archivo está dañado o protegido con contraseña.');
  });
});