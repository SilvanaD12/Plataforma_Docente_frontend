import { describe, expect, it } from 'vitest';
import { extractCitedFragments } from './citations';

describe('extractCitedFragments', () => {
  it('asigna etiquetas F1, F2… según el orden de citas y recorta extractos a 300 caracteres', () => {
    const longText = 'A'.repeat(350);
    const result = extractCitedFragments({
      citations: [
        { claim: 'Afirmación 1', fragmentIds: ['frag-1', 'frag-2'] },
        { claim: 'Afirmación 2', fragmentIds: ['frag-2'] },
      ],
      evidence: [
        {
          id: 'frag-1',
          text: longText,
          location: 'p. 4',
          documentId: 'doc-1',
          documentName: 'Apuntes.pdf',
          sourceUrl: 'https://campus.ejemplo.edu/apuntes',
        },
        {
          id: 'frag-2',
          text: 'Texto breve del segundo fragmento.',
          location: 'p. 8',
          documentId: 'doc-1',
          documentName: 'Apuntes.pdf',
          sourceUrl: null,
        },
        {
          id: 'frag-unused',
          text: 'Fragmento no citado',
          location: 'p. 9',
          documentId: 'doc-1',
          documentName: 'Apuntes.pdf',
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].tag).toBe('F1');
    expect(result[0].excerpt.length).toBe(300);
    expect(result[0].excerpt.endsWith('…')).toBe(true);
    expect(result[0].sourceLabel).toBe('Apuntes.pdf');
    expect(result[0].sourceUrl).toBe('https://campus.ejemplo.edu/apuntes');
    expect(result[0].location).toBe('p. 4');

    expect(result[1].tag).toBe('F2');
    expect(result[1].excerpt).toBe('Texto breve del segundo fragmento.');
    expect(result[1].sourceUrl).toBeNull();
  });

  it('oculta documentName cuando contiene Wikipedia y usa el dominio o «Fuente web»', () => {
    const result = extractCitedFragments({
      citations: [{ claim: 'Cita', fragmentIds: ['f-wiki-url', 'f-wiki-no-url'] }],
      evidence: [
        {
          id: 'f-wiki-url',
          text: 'Definición de TCP',
          location: 'sección 1',
          documentId: 'd1',
          documentName: 'Wikipedia - Protocolo TCP',
          sourceUrl: 'https://es.wikipedia.org/wiki/Protocolo_TCP',
        },
        {
          id: 'f-wiki-no-url',
          text: 'Definición de UDP',
          location: 'sección 2',
          documentId: 'd2',
          documentName: 'Wikipedia: UDP',
          sourceUrl: null,
        },
      ],
    });

    expect(result[0].sourceLabel).toBe('es.wikipedia.org');
    expect(result[0].sourceLabel).not.toContain('Wikipedia');
    expect(result[1].sourceLabel).toBe('Fuente web');
    expect(result[1].sourceLabel).not.toContain('Wikipedia');
  });

  it('ignora URLs no http/https', () => {
    const result = extractCitedFragments({
      citations: [{ claim: 'Cita', fragmentIds: ['f1'] }],
      evidence: [
        {
          id: 'f1',
          text: 'Contenido',
          location: 'p. 1',
          documentId: 'd1',
          documentName: 'Archivo',
          sourceUrl: 'javascript:alert(1)',
        },
      ],
    });

    expect(result[0].sourceUrl).toBeNull();
  });
});
