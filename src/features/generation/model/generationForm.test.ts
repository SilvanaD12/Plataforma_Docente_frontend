import { describe, expect, it } from 'vitest';
import {
  changeMode, generationFormProblem, generationRequestBody, initialGenerationForm, toggleType,
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
