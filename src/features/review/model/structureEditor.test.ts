import { describe, expect, it } from 'vitest';
import type { Resource } from './resource';
import { canApprove, canSave, editDraft, startEditing, startRequest } from './reviewEditor';
import {
  addStructureItem,
  removeStructureItem,
  setStructureField,
  setStructureItem,
  structureProblem,
  structureSchema,
} from './structureEditor';

function resource(type: string, structure: Record<string, unknown> | null, overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1', unitId: 'unidad-1', outcomeId: null, stage: 'explain', type, title: 'Recurso', body: 'Texto del recurso.',
    bodyHtml: null, format: 'interactive', structure, media: null, options: null, citations: [], status: 'pendiente',
    edited: false, discardReason: null, createdAt: '2026-11-08T15:00:00+00:00', updatedAt: null, decidedAt: null,
    evidence: [], version: 1, verification: null, approvalBlockers: [], ...overrides,
  };
}

const steps = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    title: `Paso ${index + 1}`, instruction: 'Observa la captura.', question: '¿Qué ves?', fragmentIds: [`f${index}`],
  }));

describe('qué se edita en cada tipo', () => {
  it('los recursos de texto y las preguntas no tienen estructura', () => {
    expect(structureSchema('explicacion')).toBeNull();
    expect(structureSchema('item_opcion_multiple')).toBeNull();
  });

  it('el mapa conceptual tiene la idea central y al menos 3 conceptos', () => {
    const schema = structureSchema('mapa_conceptual');
    expect(schema?.fields.map((field) => field.key)).toEqual(['central']);
    expect(schema?.list).toMatchObject({ key: 'nodes', min: 3 });
  });

  it('la imagen se edita por su descripción y el audio por su guion', () => {
    expect(structureSchema('imagen_ilustrativa')?.fields.map((field) => field.key)).toEqual(['prompt', 'alt', 'caption']);
    expect(structureSchema('audio_detonante')?.fields.map((field) => field.key)).toEqual(['script']);
    expect(structureSchema('podcast_resumen')?.fields.map((field) => field.key)).toEqual(['script']);
  });
});

describe('editar la estructura', () => {
  it('cambiar un campo marca el borrador como editado sin tocar lo guardado', () => {
    const state = setStructureField(startEditing(resource('imagen_ilustrativa', { prompt: 'Una red', alt: '', caption: '' })), 'prompt', 'Dos routers');
    expect(state.draft.structure).toMatchObject({ prompt: 'Dos routers' });
    expect(state.draft.edited).toBe(true);
    expect(state.saved.structure).toMatchObject({ prompt: 'Una red' });
  });

  it('cambiar un elemento conserva los fragmentos que lo respaldan', () => {
    const state = setStructureItem(startEditing(resource('exploracion_guiada', { guidedSteps: steps(3) })), 'guidedSteps', 1, 'question', '¿Qué cambia?');
    const edited = (state.draft.structure?.guidedSteps as Record<string, unknown>[])[1];
    expect(edited).toMatchObject({ question: '¿Qué cambia?', fragmentIds: ['f1'], title: 'Paso 2' });
  });

  it('en ordenar pasos cada elemento es un texto', () => {
    const state = setStructureItem(startEditing(resource('ordenar_pasos', { sequence: ['A', 'B', 'C'] })), 'sequence', 2, null, 'Z');
    expect(state.draft.structure?.sequence).toEqual(['A', 'B', 'Z']);
  });

  it('agrega un elemento vacío y quita el elegido', () => {
    const start = startEditing(resource('emparejamiento', { pairs: [{ term: 'TCP', definition: 'Confiable' }] }));
    const added = addStructureItem(start, 'pairs');
    expect(added.draft.structure?.pairs).toEqual([{ term: 'TCP', definition: 'Confiable' }, { term: '', definition: '' }]);
    expect(removeStructureItem(added, 'pairs', 0).draft.structure?.pairs).toEqual([{ term: '', definition: '' }]);
  });

  it('un verdadero o falso nuevo empieza como falso', () => {
    const added = addStructureItem(startEditing(resource('verdadero_falso', { statements: [] })), 'statements');
    expect(added.draft.structure?.statements).toEqual([{ text: '', isTrue: false, feedback: '' }]);
  });

  it('no se edita con una solicitud en curso', () => {
    const pending = startRequest(startEditing(resource('ordenar_pasos', { sequence: ['A', 'B', 'C'] })));
    expect(setStructureItem(pending, 'sequence', 0, null, 'Z')).toBe(pending);
    expect(addStructureItem(pending, 'sequence')).toBe(pending);
  });
});

describe('estructura incompleta (la misma regla del servidor)', () => {
  const minimum = 'La actividad necesita al menos 3 elementos completos para poder aprobarla.';

  it('pide el mínimo de elementos completos', () => {
    expect(structureProblem(resource('exploracion_guiada', { guidedSteps: steps(3) }))).toBeNull();
    expect(structureProblem(resource('exploracion_guiada', { guidedSteps: steps(2) }))).toBe(minimum);
    const incomplete = [...steps(2), { title: 'Paso 3', instruction: '', question: '¿Qué ves?' }];
    expect(structureProblem(resource('exploracion_guiada', { guidedSteps: incomplete }))).toBe(minimum);
  });

  it('completar espacios pide 2 oraciones con su respuesta', () => {
    const blanks = [{ sentence: 'TCP es ____.', answer: 'confiable' }, { sentence: 'UDP es ____.', answer: 'rápido' }];
    expect(structureProblem(resource('completar_espacios', { blanks }))).toBeNull();
    expect(structureProblem(resource('completar_espacios', { blanks: blanks.slice(0, 1) })))
      .toBe('La actividad necesita al menos 2 elementos completos para poder aprobarla.');
  });

  it('verdadero o falso necesita enunciados de los dos tipos', () => {
    const allTrue = [1, 2, 3].map((n) => ({ text: `Enunciado ${n}`, isTrue: true, feedback: '' }));
    expect(structureProblem(resource('verdadero_falso', { statements: allTrue })))
      .toBe('Incluye al menos un enunciado verdadero y uno falso.');
    const mixed = [...allTrue.slice(0, 2), { text: 'Enunciado 3', isTrue: false, feedback: '' }];
    expect(structureProblem(resource('verdadero_falso', { statements: mixed }))).toBeNull();
  });

  it('el mapa y el caso necesitan sus campos principales', () => {
    const nodes = [{ label: 'TCP' }, { label: 'UDP' }, { label: 'IP' }];
    expect(structureProblem(resource('mapa_conceptual', { central: '', nodes }))).toBe('Completa el contenido del recurso para poder aprobarlo.');
    expect(structureProblem(resource('mapa_conceptual', { central: 'Transporte', nodes }))).toBeNull();
    const criteria = [{ criterion: 'A' }, { criterion: 'B' }, { criterion: 'C' }];
    expect(structureProblem(resource('caso_aplicado', { scenario: 'Una empresa', task: '', criteria })))
      .toBe('Completa el contenido del recurso para poder aprobarlo.');
  });

  it('el guion necesita al menos 15 palabras y la imagen su descripción', () => {
    const short = { script: 'Hola a todos.' };
    const long = { script: 'Hoy vamos a escuchar cómo viajan los datos por la red y por qué algunos llegan antes que otros.' };
    expect(structureProblem(resource('audio_detonante', short, { format: 'audio' }))).toBe('Completa el contenido del recurso para poder aprobarlo.');
    expect(structureProblem(resource('audio_detonante', long, { format: 'audio' }))).toBeNull();
    expect(structureProblem(resource('imagen_ilustrativa', { prompt: '', alt: '', caption: '' }, { format: 'image' })))
      .toBe('Completa el contenido del recurso para poder aprobarlo.');
  });

  it('con la estructura incompleta no se guarda ni se aprueba; un recurso de texto no tiene esta regla', () => {
    const incomplete = removeStructureItem(startEditing(resource('ordenar_pasos', { sequence: ['A', 'B', 'C'] })), 'sequence', 0);
    expect(canSave(incomplete)).toBe(false);
    expect(canApprove(incomplete)).toBe(false);
    const text = editDraft(startEditing(resource('explicacion', null, { format: 'text' })), { body: 'Otro texto.' });
    expect(canSave(text)).toBe(true);
  });
});
