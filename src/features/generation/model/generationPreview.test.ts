import { describe, expect, it } from 'vitest';
import type { Unit } from '../../../shared/types/courses';
import {
  generationRequestBody, generationSubmission, initialGenerationForm, type GenerationForm,
} from './generationForm';
import { generationPreview, previewFromRequest } from './generationPreview';
import type { StartGenerationRequest } from './generationRequest';
import { hasModalityCatalog, typesForModality, type ResourceTypeInfo } from './resourceTypes';

function type(id: string, name: string, stage: ResourceTypeInfo['stage'], modalities?: ResourceTypeInfo['modalities']): ResourceTypeInfo {
  return { id, name, singular: id, count: [id, id + 's'], stage, group: 'g', format: 'text', hasOptions: false, modalities };
}

// El catálogo llega en orden de enseñanza: así lo devuelve GET /resource-types.
const catalog = [
  type('pregunta_detonante', 'Pregunta detonante', 'engage'),
  type('sondeo_diagnostico', 'Sondeo diagnóstico', 'engage'),
  type('guia_exploracion', 'Guía de exploración', 'explore'),
  type('explicacion', 'Explicación', 'explain'),
  type('glosario', 'Glosario', 'explain'),
  type('caso_aplicado', 'Caso aplicado', 'elaborate'),
  type('item_opcion_multiple', 'Ítem de opción múltiple', 'evaluate'),
  type('verdadero_falso', 'Verdadero o falso', 'evaluate'),
];

const unit: Unit = {
  id: 'unidad-1', courseId: 'curso-1', number: 3, title: 'Capa de transporte',
  outcomes: [
    { id: 'ra-1', code: 'RA1.1', text: 'Compara TCP y UDP.' },
    { id: 'ra-2', code: null, text: 'Explica el control de flujo.' },
  ],
};

const form = (overrides: Partial<GenerationForm>): GenerationForm => ({ ...initialGenerationForm, ...overrides });

describe('Vista previa del pedido (HU-040)', () => {
  it('muestra los pasos en el mismo orden que el cuerpo del pedido para una selección desordenada', () => {
    const value = form({ resourceTypes: ['item_opcion_multiple', 'glosario', 'pregunta_detonante', 'glosario'], quantity: 2 });
    const body = generationRequestBody(value, unit.id, catalog);
    const preview = generationPreview(value, unit, catalog);

    expect(preview.steps.map(({ resourceType }) => resourceType)).toEqual(body.resourceTypes);
    expect(body.resourceTypes).toEqual(['pregunta_detonante', 'glosario', 'item_opcion_multiple']);
    expect(preview.steps).toEqual([
      { position: 1, resourceType: 'pregunta_detonante', typeName: 'Pregunta detonante', stage: 'engage', stageLabel: 'Enganchar', quantity: 2 },
      { position: 2, resourceType: 'glosario', typeName: 'Glosario', stage: 'explain', stageLabel: 'Explicar', quantity: 2 },
      { position: 3, resourceType: 'item_opcion_multiple', typeName: 'Ítem de opción múltiple', stage: 'evaluate', stageLabel: 'Evaluar', quantity: 2 },
    ]);
  });

  it('ordena una secuencia que recorre las 5 etapas como el cuerpo del pedido', () => {
    const value = form({
      resourceTypes: ['verdadero_falso', 'caso_aplicado', 'explicacion', 'guia_exploracion', 'sondeo_diagnostico', 'item_opcion_multiple', 'pregunta_detonante'],
    });
    const body = generationRequestBody(value, unit.id, catalog);
    const preview = generationPreview(value, unit, catalog);

    expect(preview.steps.map(({ resourceType }) => resourceType)).toEqual(body.resourceTypes);
    expect(preview.steps.map(({ stageLabel }) => stageLabel)).toEqual([
      'Enganchar', 'Enganchar', 'Explorar', 'Explicar', 'Elaborar', 'Evaluar', 'Evaluar',
    ]);
    expect(preview.steps.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('ordena también un cuerpo armado fuera del formulario, sin cambiarlo', () => {
    const body: StartGenerationRequest = {
      mode: 'sequence', unitId: unit.id, resourceTypes: ['verdadero_falso', 'tipo_desconocido', 'guia_exploracion'], quantity: 1,
    };
    const copy = structuredClone(body);
    const preview = previewFromRequest(body, unit, catalog);

    expect(preview.steps.map(({ resourceType }) => resourceType)).toEqual(['guia_exploracion', 'verdadero_falso', 'tipo_desconocido']);
    expect(preview.steps[2]).toMatchObject({ typeName: 'tipo_desconocido', stage: null, stageLabel: 'Sin etapa' });
    expect(body).toEqual(copy);
  });

  it('calcula el total como tipos por cantidad', () => {
    expect(generationPreview(form({ resourceTypes: ['glosario', 'caso_aplicado', 'verdadero_falso'], quantity: 4 }), unit, catalog).totalResources).toBe(12);
    expect(generationPreview(form({ mode: 'individual', resourceTypes: ['glosario'], quantity: 1 }), unit, catalog).totalResources).toBe(1);
    expect(previewFromRequest({ mode: 'individual', unitId: unit.id, resourceTypes: ['glosario'] }, unit, catalog).totalResources).toBe(1);
  });

  it('muestra la unidad, el modo y la modalidad', () => {
    const preview = generationPreview(form({ mode: 'individual', resourceTypes: ['glosario'] }), unit, catalog);
    expect(preview).toMatchObject({ unitTitle: 'Capa de transporte', unitNumber: 3, mode: 'individual', modeLabel: 'Recurso individual', modality: 'Textual' });
    expect(generationPreview(form({ resourceTypes: ['glosario'] }), unit, catalog).modeLabel).toBe('Secuencia 5E');

    const gamified = catalog.map((item) => ({ ...item, modalities: ['Textual', 'Gamificado'] as ResourceTypeInfo['modalities'] }));
    expect(generationPreview(form({ modality: 'Gamificado', resourceTypes: ['glosario'] }), unit, gamified).modality).toBe('Gamificado');
  });

  it('incluye el contexto opcional solo cuando tiene valor', () => {
    const empty = generationPreview(form({ resourceTypes: ['glosario'], audience: '   ', competency: '' }), unit, catalog);
    expect(empty).toMatchObject({ outcome: null, audience: null, competency: null, instructions: null });

    const full = previewFromRequest({
      mode: 'sequence', unitId: unit.id, resourceTypes: ['glosario'], outcomeId: 'ra-1',
      audience: ' Tercer ciclo ', competency: 'Compara protocolos', instructions: ' Usa ejemplos de la vida diaria. ',
    }, unit, catalog);
    expect(full).toMatchObject({
      outcome: 'RA1.1: Compara TCP y UDP.', audience: 'Tercer ciclo', competency: 'Compara protocolos',
      instructions: 'Usa ejemplos de la vida diaria.',
    });
    expect(generationPreview(form({ resourceTypes: ['glosario'], outcomeId: 'ra-2' }), unit, catalog).outcome).toBe('Explica el control de flujo.');
  });
});

describe('Confirmación desde la vista previa', () => {
  it('el cuerpo confirmado es idéntico al que se armaba sin vista previa', () => {
    const modalities = catalog.map((item) => ({
      ...item, modalities: (item.stage === 'evaluate' ? ['Textual', 'Gamificado'] : ['Textual']) as ResourceTypeInfo['modalities'],
    }));
    const cases: [GenerationForm, ResourceTypeInfo[]][] = [
      [form({ resourceTypes: ['verdadero_falso', 'pregunta_detonante', 'glosario'], quantity: 3, outcomeId: 'ra-1', audience: ' Tercer ciclo ' }), catalog],
      [form({ mode: 'individual', resourceTypes: ['caso_aplicado'], competency: 'Analiza casos' }), catalog],
      // Con modalidad, los tipos incompatibles que quedaron marcados no se envían.
      [form({ modality: 'Gamificado', resourceTypes: ['glosario', 'verdadero_falso', 'item_opcion_multiple'] }), modalities],
    ];

    for (const [value, types] of cases) {
      // Lo que hacía «Generar» antes de HU-040, copiado tal cual del formulario.
      const visibleIds = new Set(typesForModality(types, value.modality).map(({ id }) => id));
      const selection = hasModalityCatalog(types) ? value.resourceTypes.filter((id) => visibleIds.has(id)) : value.resourceTypes;
      const withoutPreview = generationRequestBody({ ...value, resourceTypes: selection }, unit.id, types);
      const { body: confirmed, problem } = generationSubmission(value, unit.id, types);

      expect(problem).toBeNull();
      expect(JSON.stringify(confirmed)).toBe(JSON.stringify(withoutPreview));
      expect(previewFromRequest(confirmed, unit, types).steps.map(({ resourceType }) => resourceType)).toEqual(confirmed.resourceTypes);
    }
  });

  it('no abre la vista previa si el pedido tiene un problema', () => {
    expect(generationSubmission(form({ resourceTypes: [] }), unit.id, catalog).problem).toMatch(/al menos un tipo/);
  });
});
