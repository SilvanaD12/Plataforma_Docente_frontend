// Datos de prueba de los planes de generación, con la forma del contrato de specs/006. Solo para pruebas.
import type { GenerationPlan, PlanItem } from '../model/generationPlan';
import type { ResourceTypeInfo } from '../model/resourceTypes';

export const planTypes: ResourceTypeInfo[] = [
  { id: 'pregunta_detonante', name: 'Pregunta detonante', singular: 'pregunta', count: ['pregunta', 'preguntas'], stage: 'engage', group: 'g', format: 'text', hasOptions: false },
  { id: 'explicacion', name: 'Explicación', singular: 'explicación', count: ['explicación', 'explicaciones'], stage: 'explain', group: 'g', format: 'text', hasOptions: false },
  { id: 'glosario', name: 'Glosario', singular: 'glosario', count: ['glosario', 'glosarios'], stage: 'explain', group: 'g', format: 'text', hasOptions: false },
  { id: 'item_opcion_multiple', name: 'Ítem de opción múltiple', singular: 'ítem', count: ['ítem', 'ítems'], stage: 'evaluate', group: 'g', format: 'text', hasOptions: true },
];

export function planItem(position: number, overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    position,
    stage: 'explain',
    resourceType: 'explicacion',
    quantity: 1,
    purpose: 'Explicar el tema',
    covers: [],
    doesNotCover: [],
    fragmentIds: ['frag-1'],
    ...overrides,
  };
}

export function generationPlan(overrides: Partial<GenerationPlan> = {}): GenerationPlan {
  const items = overrides.items ?? [
    planItem(1, {
      stage: 'engage', resourceType: 'pregunta_detonante', purpose: 'Despertar la curiosidad por la entrega fiable',
      covers: ['entrega fiable'], doesNotCover: ['control de flujo', 'datagrama UDP', 'puerto de origen'], fragmentIds: ['frag-1'],
    }),
    planItem(2, {
      stage: 'explain', resourceType: 'explicacion', quantity: 2, purpose: 'Explicar cómo TCP controla el flujo',
      covers: ['control de flujo', 'datagrama UDP'], doesNotCover: ['entrega fiable', 'puerto de origen'], fragmentIds: ['frag-1', 'frag-2'],
    }),
    planItem(3, {
      stage: 'evaluate', resourceType: 'item_opcion_multiple', purpose: 'Comprobar si distinguen los puertos',
      covers: ['puerto de origen'], doesNotCover: ['entrega fiable', 'control de flujo', 'datagrama UDP'], fragmentIds: ['frag-2'],
    }),
  ];
  return {
    id: 'gen-plan-1',
    version: 3,
    status: 'draft',
    origin: 'teacher',
    unitId: 'unidad-1',
    inputs: {
      instructions: 'Diferencias entre TCP y UDP',
      audience: 'Tercer ciclo',
      competency: 'Pensamiento crítico',
      outcomeId: 'ra-1',
      modality: 'Textual',
      resourceTypes: [
        { type: 'pregunta_detonante', quantity: 1 }, { type: 'explicacion', quantity: null }, { type: 'item_opcion_multiple', quantity: 1 },
      ],
      difficulty: 'intermedia',
      optionCount: 4,
      evidenceThreshold: 0.6,
      topK: 12,
    },
    evidence: {
      retrievalMode: 'hybrid',
      retrievedAt: '2026-11-22T10:00:00Z',
      fragments: [
        { id: 'frag-1', documentId: 'doc-1', documentName: 'protocolos.pdf', location: 'p. 3', text: 'TCP garantiza la entrega fiable con acuses de recibo.', relevance: 0.9 },
        { id: 'frag-2', documentId: 'doc-1', documentName: 'protocolos.pdf', location: 'p. 5', text: 'UDP envía datagramas sin conexión previa.', relevance: 0.8 },
      ],
    },
    referents: [{ name: 'Andrew Tanenbaum', description: 'Autor de Redes de computadoras', fragmentIds: ['frag-1'] }],
    sessionContext: { previousTypologies: [{ sessionLabel: 'Sesión 2', usedAt: '2026-11-15T12:00:00Z', resourceTypes: ['pregunta_detonante', 'glosario'] }] },
    items,
    validation: { valid: true, problems: [] },
    warnings: [],
    generator: { description: 'Planificador con IA', usesAi: true, fallback: false, fallbackReason: null, attempts: 1 },
    usedByRequestId: null,
    createdAt: '2026-11-22T10:00:00Z',
    updatedAt: '2026-11-22T10:05:00Z',
    approvedAt: null,
    usedAt: null,
    ...overrides,
  };
}
