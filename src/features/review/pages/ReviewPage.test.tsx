import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getDuplicationReport, type DuplicationReport } from '../api/reviewApi';
import type { Resource } from '../model/resource';
import { ReviewPageContent } from './ReviewPage';

function resource(id: string, title: string): Resource {
  return {
    id, unitId: 'unidad-1', outcomeId: null, stage: 'evaluate', type: 'item_opcion_multiple',
    title, body: 'Texto', bodyHtml: null, format: 'text', structure: null, media: null,
    options: [], citations: [], status: 'pendiente', edited: false, discardReason: null,
    createdAt: '2026-11-08T15:00:00+00:00', updatedAt: null, decidedAt: null, evidence: [],
    version: 1, verification: null, approvalBlockers: [],
  };
}

let capturedOnRegenerate: ((r: Resource) => Promise<void>) | null = null;

vi.mock('../components/ResourceEditor', () => ({
  ResourceEditor: (props: { resource: Resource; onRegenerate: (r: Resource) => Promise<void> }) => {
    capturedOnRegenerate = props.onRegenerate;
    return (
      <div className="resource-editor">
        <span>{props.resource.title}</span>
      </div>
    );
  },
}));

vi.mock('../api/reviewApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/reviewApi')>();
  return {
    ...actual,
    getDuplicationReport: vi.fn(async () => ({
      comparedPairs: 0,
      duplicatePairRate: 0,
      threshold: 0.7,
      flaggedPairs: [],
    })),
    regenerateResource: vi.fn(async () => ({
      previousResourceId: 'rec-1',
      previousDiscarded: true,
      newResourceIds: ['rec-new'],
      status: 'succeeded' as const,
    })),
    listResources: vi.fn(async () => [resource('rec-new', 'Nuevo recurso')]),
  };
});

describe('pestaña de revisión', () => {
  it('mientras carga muestra el aviso de carga', () => {
    const html = renderToStaticMarkup(<ReviewPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);
    expect(html).toContain('Revisión');
    expect(html).toContain('Cargando los recursos de la unidad…');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    const html = renderToStaticMarkup(<ReviewPageContent token="token" unitId="unidad-1" onSessionExpired={() => {}} />);
    expect(html).not.toMatch(/5E|Gemini|Wikipedia/);
  });

  it('muestra el banner de duplicados cuando el reporte incluye pares señalados', () => {
    const report: DuplicationReport = {
      comparedPairs: 3,
      duplicatePairRate: 0.333,
      threshold: 0.70,
      flaggedPairs: [
        {
          resourceIdA: 'rec-1',
          resourceIdB: 'rec-2',
          scope: 'resource',
          score: 0.85,
          excerptA: '¿Cómo funciona el protocolo TCP?',
          excerptB: '¿Cómo funciona TCP en redes?',
        },
      ],
    };

    const resources = [
      resource('rec-1', 'Protocolo TCP'),
      resource('rec-2', 'Funcionamiento de TCP'),
    ];

    const html = renderToStaticMarkup(
      <ReviewPageContent
        token="token"
        unitId="unidad-1"
        onSessionExpired={() => {}}
        initialReport={report}
        initialState={{ status: 'ready', resources }}
      />,
    );

    expect(html).toContain('Aviso: posible contenido repetido');
    expect(html).toContain('«Protocolo TCP»');
    expect(html).toContain('«Funcionamiento de TCP»');
    expect(html).toContain('85 %');
    expect(html).toContain('Ir a «Protocolo TCP»');
    expect(html).toContain('href="#rec-1"');
    expect(html).toContain('Ir a «Funcionamiento de TCP»');
    expect(html).toContain('href="#rec-2"');
    expect(html).not.toContain('Posible contenido repetido en otras unidades');
  });

  it('muestra el bloque entre unidades cuando hay pares con crossUnit=true (REV-P4)', () => {
    const report: DuplicationReport = {
      comparedPairs: 2,
      duplicatePairRate: 0.5,
      threshold: 0.70,
      flaggedPairs: [
        {
          resourceIdA: 'rec-1',
          resourceIdB: 'rec-u2',
          scope: 'resource',
          score: 0.91,
          excerptA: 'TCP garantiza la entrega ordenada de los segmentos.',
          excerptB: 'El protocolo TCP asegura una entrega confiable y en orden.',
          crossUnit: true,
          unitIdB: 'unidad-2',
          unitTitleB: 'Unidad 2: Redes avanzadas',
        },
      ],
    };

    const resources = [resource('rec-1', 'Protocolo TCP')];

    const html = renderToStaticMarkup(
      <ReviewPageContent
        token="token"
        unitId="unidad-1"
        onSessionExpired={() => {}}
        initialReport={report}
        initialState={{ status: 'ready', resources }}
      />,
    );

    expect(html).not.toContain('Aviso: posible contenido repetido');
    expect(html).toContain('aria-label="Aviso de contenido repetido en otras unidades"');
    expect(html).toContain('Posible contenido repetido en otras unidades');
    expect(html).toContain('Se parece a un recurso de la unidad «Unidad 2: Redes avanzadas» (91 %)');
    expect(html).toContain('Extracto A: TCP garantiza la entrega ordenada de los segmentos.');
    expect(html).toContain('Extracto B: El protocolo TCP asegura una entrega confiable y en orden.');
    expect(html).toContain('href="#rec-1"');
    expect(html).not.toMatch(/5E|Gemini|Wikipedia/);
  });

  it('muestra ambos bloques si hay duplicados internos y entre unidades a la vez', () => {
    const report: DuplicationReport = {
      comparedPairs: 3,
      duplicatePairRate: 0.667,
      threshold: 0.7,
      flaggedPairs: [
        {
          resourceIdA: 'rec-1',
          resourceIdB: 'rec-u2',
          scope: 'resource',
          score: 0.92,
          excerptA: 'A1',
          excerptB: 'B2',
          crossUnit: true,
          unitIdB: 'unidad-2',
          unitTitleB: 'Unidad 2',
        },
        {
          resourceIdA: 'rec-1',
          resourceIdB: 'rec-2',
          scope: 'resource',
          score: 0.85,
          excerptA: 'A1',
          excerptB: 'A2',
          crossUnit: false,
          unitIdB: null,
          unitTitleB: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ReviewPageContent
        token="token"
        unitId="unidad-1"
        onSessionExpired={() => {}}
        initialReport={report}
        initialState={{ status: 'ready', resources: [resource('rec-1', 'R1'), resource('rec-2', 'R2')] }}
      />,
    );

    expect(html).toContain('Aviso: posible contenido repetido');
    expect(html).toContain('Posible contenido repetido en otras unidades');
    expect(html).toContain('Se parece a un recurso de la unidad «Unidad 2» (92 %)');
  });

  it('si falla la comprobación de duplicados muestra aviso discreto sin bloquear los recursos', () => {
    const resources = [resource('rec-1', 'Recurso A')];
    const html = renderToStaticMarkup(
      <ReviewPageContent
        token="token"
        unitId="unidad-1"
        onSessionExpired={() => {}}
        initialNotice={{ text: 'No se pudo comprobar si hay contenido repetido.', warn: true }}
        initialState={{ status: 'ready', resources }}
      />,
    );

    expect(html).toContain('No se pudo comprobar si hay contenido repetido.');
    expect(html).toContain('Recurso A');
  });

  it('después de regenerar, getDuplicationReport se vuelve a llamar', async () => {
    const resources = [resource('rec-1', 'Recurso A')];
    renderToStaticMarkup(
      <ReviewPageContent
        token="token"
        unitId="unidad-1"
        onSessionExpired={() => {}}
        initialState={{ status: 'ready', resources }}
      />,
    );

    expect(capturedOnRegenerate).toBeTypeOf('function');
    vi.mocked(getDuplicationReport).mockClear();

    await capturedOnRegenerate!(resources[0]);

    expect(getDuplicationReport).toHaveBeenCalledTimes(1);
    expect(getDuplicationReport).toHaveBeenCalledWith('token', 'unidad-1');
  });
});
