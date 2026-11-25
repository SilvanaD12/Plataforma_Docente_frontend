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
    expect(html).toContain('15 páginas');
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

  it('no muestra el conteo de páginas cuando el material es de origen web', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument({
          status: 'procesado',
          documentType: 'Página web',
          pageCount: 23,
          origin: {
            source: 'Web',
            url: 'https://es.wikipedia.org/wiki/Modelo_OSI',
          },
        })}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).not.toContain('23 páginas');
    expect(html).not.toContain('páginas');
  });

  it('muestra el aviso no bloqueante de relevancia con opciones Conservar y Eliminar', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument({
          status: 'procesado',
          fragmentCount: 4,
          relevanceWarning: 'Este material parece no tener relación con tu unidad. ¿Deseas conservarlo?',
        })}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).toContain('Este material parece no tener relación con tu unidad. ¿Deseas conservarlo?');
    expect(html).toContain('Conservar');
    expect(html).toContain('Eliminar');
  });

  it('muestra el aviso no bloqueante de duplicado entre unidades', () => {
    const html = renderToStaticMarkup(
      <DocumentCard
        document={createMockDocument({
          status: 'procesado',
          fragmentCount: 6,
          duplicateWarning: 'Este material ya está en la unidad «Unidad 1: Fundamentos».',
        })}
        onProcess={() => {}}
        onDelete={() => {}}
        onDownload={() => {}}
        onViewChunks={() => {}}
        isProcessing={false}
      />,
    );

    expect(html).toContain('Este material ya está en la unidad «Unidad 1: Fundamentos».');
    expect(html).toContain('Entendido');
  });
});