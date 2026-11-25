import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Resource } from '../model/resource';
import { CitationList } from './CitationList';

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1',
    unitId: 'unidad-1',
    outcomeId: null,
    stage: 'explain',
    type: 'explicacion',
    title: 'Protocolo TCP',
    body: 'TCP garantiza la entrega.',
    options: null,
    citations: [],
    status: 'pendiente',
    edited: false,
    discardReason: null,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: null,
    decidedAt: null,
    evidence: [],
    version: 1,
    verification: null,
    approvalBlockers: [],
    ...overrides,
  };
}

describe('CitationList', () => {
  it('inicia cerrado por defecto con botón accesible aria-expanded="false"', () => {
    const html = renderToStaticMarkup(
      <CitationList
        resource={resource({
          citations: [{ claim: 'TCP', fragmentIds: ['f1'] }],
          evidence: [{ id: 'f1', text: 'Fragmento uno', location: 'p. 2', documentId: 'd1', documentName: 'Guía.pdf' }],
        })}
      />,
    );
    expect(html).toContain('Fuentes citadas (1)');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="rec-1-citations"');
    expect(html).toContain('<div id="rec-1-citations" hidden=""');
  });

  it('muestra la etiqueta F1, extracto hasta 300 caracteres, ubicación y enlace «Ver fuente»', () => {
    const html = renderToStaticMarkup(
      <CitationList
        defaultOpen
        resource={resource({
          citations: [{ claim: 'TCP', fragmentIds: ['f1'] }],
          evidence: [
            {
              id: 'f1',
              text: 'TCP establece una conexión confiable antes de transmitir.',
              location: 'p. 14',
              documentId: 'd1',
              documentName: 'Apuntes de redes.pdf',
              sourceUrl: 'https://redes.ejemplo.edu/cap3',
            },
          ],
        })}
      />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('F1');
    expect(html).toContain('Apuntes de redes.pdf');
    expect(html).toContain('p. 14');
    expect(html).toContain('TCP establece una conexión confiable antes de transmitir.');
    expect(html).toContain('href="https://redes.ejemplo.edu/cap3"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>Ver fuente</a>');
  });

  it('oculta «Wikipedia» en documentName mostrando el dominio o «Fuente web»', () => {
    const html = renderToStaticMarkup(
      <CitationList
        defaultOpen
        resource={resource({
          citations: [{ claim: 'Web', fragmentIds: ['f1', 'f2'] }],
          evidence: [
            {
              id: 'f1',
              text: 'Texto uno',
              location: 'sección A',
              documentId: 'd1',
              documentName: 'Wikipedia - Protocolo TCP',
              sourceUrl: 'https://es.wikipedia.org/wiki/TCP',
            },
            {
              id: 'f2',
              text: 'Texto dos',
              location: 'sección B',
              documentId: 'd2',
              documentName: 'Wikipedia: UDP',
              sourceUrl: null,
            },
          ],
        })}
      />,
    );
    expect(html).not.toContain('Wikipedia');
    expect(html).toContain('es.wikipedia.org');
    expect(html).toContain('Fuente web');
  });

  it('muestra aviso cuando el recurso no cita fragmentos del material', () => {
    const html = renderToStaticMarkup(<CitationList defaultOpen resource={resource()} />);
    expect(html).toContain('Fuentes citadas (0)');
    expect(html).toContain('Este recurso no cita fragmentos del material.');
  });
});
