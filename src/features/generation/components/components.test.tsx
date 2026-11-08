import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Unit } from '../../../shared/types/courses';
import type { GenerationRequestStatus, GenerationStep } from '../model/generationRequest';
import type { ResourceTypeInfo } from '../model/resourceTypes';
import { FallbackNotices } from './FallbackNotices';
import { GenerationForm } from './GenerationForm';
import { GenerationProgress } from './GenerationProgress';

const types: ResourceTypeInfo[] = [
  { id: 'pregunta_detonante', name: 'Pregunta detonante', singular: 'pregunta', count: ['pregunta', 'preguntas'], stage: 'engage', group: 'g', format: 'text', hasOptions: false },
  { id: 'item_opcion_multiple', name: 'Ítem de opción múltiple', singular: 'ítem', count: ['ítem', 'ítems'], stage: 'evaluate', group: 'g', format: 'text', hasOptions: true },
];

const unit: Unit = {
  id: 'unidad-1', courseId: 'curso-1', number: 1, title: 'Transporte',
  outcomes: [{ id: 'ra-1', code: 'RA1.1', text: 'Compara TCP y UDP.' }],
};

function step(position: number, overrides: Partial<GenerationStep> = {}): GenerationStep {
  return {
    position, stage: 'engage', resourceType: 'pregunta_detonante', agent: 'Agente de Enganchar',
    status: 'succeeded', resourceIds: [], rejections: [], ...overrides,
  };
}

function generationRequest(overrides: Partial<GenerationRequestStatus> = {}): GenerationRequestStatus {
  return {
    id: 'gen-req-1', mode: 'sequence', unitId: 'unidad-1', status: 'running',
    resourceTypes: ['pregunta_detonante', 'item_opcion_multiple'], createdAt: '2026-11-08T10:00:00Z',
    parameters: {
      resourceTypes: ['pregunta_detonante', 'item_opcion_multiple'], quantity: 1, difficulty: 'intermedia',
      optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '', audience: '', competency: '', modalities: ['Textual'],
    },
    retrievalMode: 'hybrid', failure: null, steps: [], ...overrides,
  };
}

const render = (element: JSX.Element) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const catalog = { types, loading: false, error: '', reload: () => undefined };

describe('Formulario de generación', () => {
  it('ofrece los tipos del catálogo por etapa, con casillas en modo secuencia', () => {
    const html = render(<GenerationForm unit={unit} catalog={catalog} onSubmit={() => undefined} />);
    expect(html).toContain('Secuencia 5E');
    expect(html).toContain('Enganchar');
    expect(html).toContain('Ítem de opción múltiple');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain('RA1.1: Compara TCP y UDP.');
    expect(html).toContain('Generar secuencia');
  });

  it('usa un solo tipo en modo individual y bloquea el resto al llegar a 8 en secuencia', () => {
    const individual = render(<GenerationForm unit={unit} catalog={catalog} onSubmit={() => undefined}
      initialValue={{ mode: 'individual', resourceTypes: [], quantity: 1, outcomeId: '' }} />);
    expect(individual).not.toContain('type="checkbox"');
    expect(individual).toContain('Generar recurso');

    const full = render(<GenerationForm unit={unit} catalog={catalog} onSubmit={() => undefined}
      initialValue={{ mode: 'sequence', resourceTypes: ['pregunta_detonante', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], quantity: 1, outcomeId: '' }} />);
    expect(full).toContain('Elegidos: 8 de 8');
    expect(full).toMatch(/<input type="checkbox" name="resourceTypes" disabled="" value="item_opcion_multiple"\/>/);
    expect(full).toMatch(/<input type="checkbox" name="resourceTypes" checked="" value="pregunta_detonante"\/>/);
  });

  it('avisa si el catálogo no cargó y no permite enviar', () => {
    const html = render(<GenerationForm unit={unit} catalog={{ ...catalog, types: [], error: 'Sin conexión.' }} onSubmit={() => undefined} />);
    expect(html).toContain('Sin conexión.');
    expect(html).toContain('Reintentar');
    expect(html).toMatch(/type="submit"[^>]*disabled=""/);
  });
});

describe('Progreso de la generación', () => {
  it('muestra los pasos en orden 5E con su estado, recursos verificados y rechazos', () => {
    const html = render(<GenerationProgress resourceTypes={types} request={generationRequest({
      status: 'partially_succeeded',
      steps: [
        step(1, { stage: 'evaluate', resourceType: 'item_opcion_multiple', agent: 'Agente de Evaluar', status: 'rejected',
          rejections: [{ title: 'Ítem 1', reason: 'Menos de la mitad de las afirmaciones tiene respaldo.', kind: 'grounding' }] }),
        step(0, { resourceIds: ['rec-1', 'rec-2'], resources: [
          { id: 'rec-1', title: '¿Por qué TCP retransmite?', verificationStatus: 'current' },
          { id: 'rec-2', title: '¿Y UDP?', verificationStatus: 'pending' },
        ] }),
      ],
    })} />);

    expect(html.indexOf('Pregunta detonante')).toBeLessThan(html.indexOf('Ítem de opción múltiple'));
    expect(html).toContain('Terminado con resultados parciales');
    expect(html).toContain('2 de 2 pasos terminados');
    expect(html).toContain('href="/review?resource=rec-1"');
    expect(html).toContain('Verificación: Vigente');
    expect(html).toContain('Verificación: Pendiente');
    expect(html).toContain('Rechazado');
    expect(html).toContain('Menos de la mitad de las afirmaciones tiene respaldo.');
  });

  it('muestra el motivo del fallo del pedido', () => {
    const html = render(<GenerationProgress resourceTypes={types} request={generationRequest({
      status: 'failed', failure: { code: 'DEADLINE_EXCEEDED', message: 'El pedido superó el tiempo máximo.' },
      steps: [step(0, { status: 'failed', error: { code: 'LLM_ERROR', message: 'No se pudo redactar el recurso.' } })],
    })} />);
    expect(html).toContain('El pedido superó el tiempo máximo.');
    expect(html).toContain('No se pudo redactar el recurso.');
    expect(html).not.toContain('Crear un pedido nuevo');
  });

  it('ofrece crear un pedido nuevo cuando el pedido se interrumpió', () => {
    const html = render(<GenerationProgress resourceTypes={types} onStartNew={() => undefined}
      request={generationRequest({ status: 'interrupted', steps: [step(0, { status: 'interrupted' })] })} />);
    expect(html).toContain('El pedido se interrumpió');
    expect(html).toContain('Crear un pedido nuevo');
  });
});

describe('Avisos de respaldo', () => {
  const ruleStep = step(1, { stage: 'evaluate', resourceType: 'item_opcion_multiple', generator: { description: 'Reglas', usesAi: false, fallback: true } });
  const aiStep = step(0, { generator: { description: 'Gemini', usesAi: true, fallback: false } });

  it('no muestra nada sin respaldo o con retrievalMode nulo', () => {
    expect(render(<FallbackNotices retrievalMode="hybrid" steps={[aiStep]} resourceTypes={types} />)).toBe('');
    expect(render(<FallbackNotices retrievalMode={null} steps={[aiStep]} resourceTypes={types} />)).toBe('');
  });

  it('distingue el respaldo de búsqueda del respaldo de redacción', () => {
    const search = render(<FallbackNotices retrievalMode="bm25_fallback" steps={[aiStep]} resourceTypes={types} />);
    expect(search).toContain('data-notice="retrieval"');
    expect(search).not.toContain('data-notice="generator"');

    const drafting = render(<FallbackNotices retrievalMode={null} steps={[aiStep, ruleStep]} resourceTypes={types} />);
    expect(drafting).toContain('data-notice="generator"');
    expect(drafting).not.toContain('data-notice="retrieval"');
    expect(drafting).toContain('Evaluar: Ítem de opción múltiple');
    expect(drafting).not.toContain('Enganchar: Pregunta detonante');

    const both = render(<FallbackNotices retrievalMode="bm25_fallback" steps={[ruleStep]} resourceTypes={types} />);
    expect(both).toContain('data-notice="retrieval"');
    expect(both).toContain('data-notice="generator"');
  });
});
