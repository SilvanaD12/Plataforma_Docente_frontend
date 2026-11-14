import { describe, expect, it } from 'vitest';
import {
  applyInterpretationDraft,
  changeModality,
  changeMode,
  generationFormProblem,
  generationRequestBody,
  generationSubmission,
  initialGenerationForm,
  resourceModalityWarning,
  toggleType,
} from './generationForm';
import { typesByStage, typeName, type ResourceTypeInfo } from './resourceTypes';

function type(id: string, stage: ResourceTypeInfo['stage']): ResourceTypeInfo {
  return { id, name: 'Nombre ' + id, singular: id, count: [id, id + 's'], stage, group: 'g', format: 'text', hasOptions: false };
}

const catalog = [
  type('pregunta_detonante', 'engage'),
  type('guia_exploracion', 'explore'),
  type('glosario', 'explain'),
  type('item_opcion_multiple', 'evaluate'),
];

describe('Formulario de generación', () => {
  it('agrupa el catálogo por etapa 5E y omite las etapas vacías', () => {
    expect(typesByStage(catalog).map(({ stage }) => stage)).toEqual(['engage', 'explore', 'explain', 'evaluate']);
    expect(typeName(catalog, 'glosario')).toBe('Nombre glosario');
    expect(typeName(catalog, 'desconocido')).toBe('desconocido');
  });

  it('en modo individual reemplaza el tipo elegido y al cambiar de modo conserva solo el primero', () => {
    let form = { ...initialGenerationForm, resourceTypes: ['glosario', 'item_opcion_multiple'] };
    form = changeMode(form, 'individual');
    expect(form.resourceTypes).toEqual(['glosario']);
    expect(toggleType(form, 'pregunta_detonante').resourceTypes).toEqual(['pregunta_detonante']);
  });

  it('en secuencia agrega y quita tipos sin pasar de 8', () => {
    let form = initialGenerationForm;
    form = toggleType(form, 'glosario');
    form = toggleType(form, 'pregunta_detonante');
    expect(form.resourceTypes).toEqual(['glosario', 'pregunta_detonante']);
    expect(toggleType(form, 'glosario').resourceTypes).toEqual(['pregunta_detonante']);

    const full = { ...form, resourceTypes: Array.from({ length: 8 }, (_, index) => 't' + index) };
    expect(toggleType(full, 'otro')).toBe(full);
  });

  it('arma el cuerpo del pedido en orden 5E, sin repetidos y con el resultado opcional', () => {
    const form = {
      ...initialGenerationForm,
      resourceTypes: ['item_opcion_multiple', 'pregunta_detonante', 'glosario', 'glosario'],
      quantity: 3,
    };
    const body = generationRequestBody(form, 'unidad-1', catalog);
    expect(body).toEqual({
      mode: 'sequence', unitId: 'unidad-1', resourceTypes: ['pregunta_detonante', 'glosario', 'item_opcion_multiple'],
      quantity: 3, outcomeId: null,
    });
    expect(generationFormProblem(body)).toBeNull();
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('audience');
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('competency');
    expect(generationRequestBody({ ...form, outcomeId: 'ra-1' }, 'unidad-1', catalog).outcomeId).toBe('ra-1');
  });

  it('envía audiencia y competencia junto al resultado de aprendizaje', () => {
    const form = {
      ...initialGenerationForm,
      resourceTypes: ['glosario'],
      outcomeId: 'ra-1',
      audience: '  Estudiantes de tercer ciclo  ',
      competency: '  Compara protocolos de transporte  ',
    };
    expect(generationRequestBody(form, 'unidad-1', catalog)).toMatchObject({
      outcomeId: 'ra-1',
      audience: 'Estudiantes de tercer ciclo',
      competency: 'Compara protocolos de transporte',
    });
  });

  it('retains compatible types and sends the selected modality', () => {
    const modalitiesCatalog = catalog.map((item): ResourceTypeInfo => ({
      ...item, modalities: item.id === 'item_opcion_multiple' ? ['Textual', 'Gamificado'] : ['Textual'],
    }));
    const initial = { ...initialGenerationForm, resourceTypes: ['glosario', 'item_opcion_multiple'] };
    expect(generationRequestBody(initial, 'unidad-1', modalitiesCatalog).modalities).toEqual(['Textual']);
    const form = changeModality(initial, 'Gamificado', modalitiesCatalog);
    expect(form.resourceTypes).toEqual(['item_opcion_multiple']);
    expect(generationRequestBody(form, 'unidad-1', modalitiesCatalog)).toMatchObject({
      modalities: ['Gamificado'], resourceTypes: ['item_opcion_multiple'],
    });
    expect(changeModality(form, 'Multimedia', modalitiesCatalog).resourceTypes).toEqual([]);
    expect(generationRequestBody(initial, 'unidad-1', catalog).modalities).toBeUndefined();
  });

  it('explica qué falta antes de enviar', () => {
    const body = { mode: 'sequence' as const, unitId: 'unidad-1', resourceTypes: ['glosario'], quantity: 1 };
    expect(generationFormProblem({ ...body, resourceTypes: [] })).toMatch(/al menos un tipo/);
    expect(generationFormProblem({ ...body, mode: 'individual', resourceTypes: [] })).toMatch(/Elige el tipo/);
    expect(generationFormProblem({ ...body, mode: 'individual', resourceTypes: ['glosario', 'mapa_conceptual'] })).toMatch(/un solo tipo/);
    expect(generationFormProblem({ ...body, resourceTypes: Array.from({ length: 9 }, (_, index) => 't' + index) })).toMatch(/hasta 8/);
    expect(generationFormProblem({ ...body, quantity: 6 })).toMatch(/entre 1 y 5/);
    expect(generationFormProblem({ ...body, quantity: 0 })).toMatch(/entre 1 y 5/);
  });
});

describe('Borrador del chat de Generación', () => {
  const form = {
    ...initialGenerationForm,
    resourceTypes: ['glosario'],
    quantity: 3,
    outcomeId: 'ra-1',
    audience: 'Tercer ciclo',
    competency: 'Compara protocolos',
    instructions: 'Usa ejemplos breves',
  };

  const modalitiesCatalog: ResourceTypeInfo[] = [
    { ...type('glosario', 'explain'), name: 'Glosario', modalities: ['Textual'] },
    { ...type('imagen_ilustrativa', 'explore'), name: 'Imagen ilustrativa', modalities: ['Multimedia'] },
  ];

  it('conserva los campos omitidos', () => {
    const draft = { unitId: 'unidad-1', resourceTypes: ['glosario'], quantity: 2 };
    expect(applyInterpretationDraft(form, draft)).toEqual({ ...form, quantity: 2 });
  });

  it('limpia el resultado cuando outcomeId es null', () => {
    const draft = { unitId: 'unidad-1', resourceTypes: ['glosario'], outcomeId: null };
    expect(applyInterpretationDraft(form, draft).outcomeId).toBe('');
  });

  it('conserva los tipos seleccionados cuando el borrador no identifica ninguno', () => {
    const draft = { unitId: 'unidad-1', resourceTypes: [] };
    expect(applyInterpretationDraft(form, draft).resourceTypes).toEqual(['glosario']);
  });

  it('avisa qué tipo queda fuera y bloquea la vista previa de un pedido parcial', () => {
    const draft = { unitId: 'unidad-1', resourceTypes: ['glosario', 'imagen_ilustrativa'] };
    const mixed = applyInterpretationDraft(form, draft);
    const warning = resourceModalityWarning(mixed, modalitiesCatalog);

    expect(warning).toContain('Textual: Imagen ilustrativa');
    expect(generationSubmission(mixed, 'unidad-1', modalitiesCatalog).problem).toBe(warning);
    expect(generationSubmission(form, 'unidad-1', modalitiesCatalog).problem).toBeNull();
  });

  it('muestra la incompatibilidad de una imagen sola y la resuelve al elegir Multimedia', () => {
    const draft = { unitId: 'unidad-1', resourceTypes: ['imagen_ilustrativa'] };
    const image = applyInterpretationDraft(form, draft);

    expect(generationSubmission(image, 'unidad-1', modalitiesCatalog).problem)
      .toContain('Textual: Imagen ilustrativa');

    const corrected = generationSubmission({ ...image, modality: 'Multimedia' }, 'unidad-1', modalitiesCatalog);
    expect(corrected.problem).toBeNull();
    expect(corrected.body.resourceTypes).toEqual(['imagen_ilustrativa']);
  });
});
