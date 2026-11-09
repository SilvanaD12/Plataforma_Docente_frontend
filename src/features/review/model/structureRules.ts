import type { Resource } from './resource';

/**
 * Qué se edita en la `structure` de cada tipo de recurso y cuándo está completa. Replica las reglas de
 * `normalize_structure` del backend (resource_formats.py) para avisar antes de guardar; el servidor sigue siendo quien
 * decide (422 INVALID_STRUCTURE), por ejemplo con dos predicciones iguales o una oración sin su respuesta.
 */
export type StructureFieldKind = 'text' | 'longText' | 'boolean';

export interface StructureField {
  key: string;
  label: string;
  kind: StructureFieldKind;
  required?: boolean;
}

export interface StructureList {
  key: string;
  label: string;
  /** Nombre de un elemento, para «Agregar …» y «Quitar … N». */
  itemLabel: string;
  /** Campos de cada elemento; vacío cuando cada elemento es un texto (ordenar pasos). */
  fields: StructureField[];
  min: number;
  /** El elemento cuenta si tiene alguno de sus campos (título o texto), no todos. */
  completeWithAny?: boolean;
}

export interface StructureSchema {
  fields: StructureField[];
  list: StructureList | null;
  /** Mínimo de palabras del guion (audio). */
  minWords?: number;
}

const text = (key: string, label: string, required = false): StructureField => ({ key, label, kind: 'text', required });
const longText = (key: string, label: string, required = false): StructureField => ({ key, label, kind: 'longText', required });

const titledPoints = (key: string, label: string, itemLabel: string): StructureList => ({
  key, label, itemLabel, min: 3, completeWithAny: true, fields: [text('title', 'Título'), longText('text', 'Texto')],
});

const SCHEMAS: Record<string, StructureSchema> = {
  mapa_conceptual: {
    fields: [text('central', 'Idea central', true)],
    list: { key: 'nodes', label: 'Conceptos', itemLabel: 'concepto', min: 3, fields: [text('label', 'Concepto', true), text('detail', 'Detalle')] },
  },
  infografia: { fields: [text('headline', 'Titular')], list: titledPoints('points', 'Puntos', 'punto') },
  diagrama_proceso: { fields: [], list: titledPoints('steps', 'Pasos', 'paso') },
  exploracion_guiada: {
    fields: [],
    list: {
      key: 'guidedSteps', label: 'Pasos', itemLabel: 'paso', min: 3,
      fields: [text('title', 'Título', true), longText('instruction', 'Indicación', true), longText('question', 'Pregunta', true)],
    },
  },
  reto_prediccion: {
    fields: [],
    list: {
      key: 'predictions', label: 'Predicciones', itemLabel: 'predicción', min: 3,
      fields: [
        longText('question', 'Pregunta', true), text('correctOption', 'Opción correcta', true),
        text('otherOption', 'Otra opción', true), text('extraOption', 'Tercera opción'), longText('reveal', 'Lo que dice el material', true),
      ],
    },
  },
  caso_aplicado: {
    fields: [longText('scenario', 'Situación', true), longText('task', 'Consigna', true)],
    list: { key: 'criteria', label: 'Criterios de logro', itemLabel: 'criterio', min: 3, fields: [longText('criterion', 'Criterio', true)] },
  },
  ordenar_pasos: { fields: [], list: { key: 'sequence', label: 'Pasos en orden', itemLabel: 'paso', min: 3, fields: [] } },
  emparejamiento: {
    fields: [],
    list: { key: 'pairs', label: 'Parejas', itemLabel: 'pareja', min: 3, fields: [text('term', 'Término', true), longText('definition', 'Definición', true)] },
  },
  verdadero_falso: {
    fields: [],
    list: {
      key: 'statements', label: 'Enunciados', itemLabel: 'enunciado', min: 3,
      fields: [longText('text', 'Enunciado', true), { key: 'isTrue', label: '¿Es verdadero?', kind: 'boolean' }, longText('feedback', 'Retroalimentación')],
    },
  },
  completar_espacios: {
    fields: [],
    list: {
      key: 'blanks', label: 'Oraciones', itemLabel: 'oración', min: 2,
      fields: [longText('sentence', 'Oración (marca el espacio con ____)', true), text('answer', 'Respuesta', true)],
    },
  },
  audio_detonante: { fields: [longText('script', 'Guion', true)], list: null, minWords: 15 },
  podcast_resumen: { fields: [longText('script', 'Guion', true)], list: null, minWords: 15 },
  imagen_ilustrativa: {
    fields: [longText('prompt', 'Descripción de la imagen', true), text('alt', 'Texto alternativo'), text('caption', 'Pie de imagen')],
    list: null,
  },
};

export function structureSchema(resourceType: string): StructureSchema | null {
  return SCHEMAS[resourceType] ?? null;
}

/** Elemento vacío de la lista: un texto, o sus campos vacíos (los de sí o no empiezan en falso). */
export function emptyItem(list: StructureList): unknown {
  if (list.fields.length === 0) return '';
  return Object.fromEntries(list.fields.map((field) => [field.key, field.kind === 'boolean' ? false : '']));
}

const filled = (value: unknown) => typeof value === 'string' && value.trim() !== '';

function itemComplete(list: StructureList, item: unknown): boolean {
  if (list.fields.length === 0) return filled(item);
  if (typeof item !== 'object' || item === null) return false;
  const record = item as Record<string, unknown>;
  const textFields = list.fields.filter((field) => field.kind !== 'boolean');
  if (list.completeWithAny) return textFields.some((field) => filled(record[field.key]));
  return textFields.filter((field) => field.required).every((field) => filled(record[field.key]));
}

export const CONTENT_PROBLEM = 'Completa el contenido del recurso para poder aprobarlo.';
export const TRUE_FALSE_PROBLEM = 'Incluye al menos un enunciado verdadero y uno falso.';
export const minimumProblem = (min: number) => `La actividad necesita al menos ${min} elementos completos para poder aprobarla.`;

/** Por qué la estructura del borrador no alcanza para guardarla ni aprobarla; null si está completa o no aplica. */
export function structureProblem(resource: Pick<Resource, 'type' | 'structure'>): string | null {
  const schema = structureSchema(resource.type);
  if (!schema) return null;
  const structure = (resource.structure ?? {}) as Record<string, unknown>;
  if (schema.fields.some((field) => field.required && !filled(structure[field.key]))) return CONTENT_PROBLEM;
  if (schema.minWords) {
    const words = String(structure.script ?? '').split(/\s+/).filter(Boolean).length;
    if (words < schema.minWords) return CONTENT_PROBLEM;
  }
  if (!schema.list) return null;
  const items = Array.isArray(structure[schema.list.key]) ? (structure[schema.list.key] as unknown[]) : [];
  const complete = items.filter((item) => itemComplete(schema.list as StructureList, item));
  if (complete.length < schema.list.min) return minimumProblem(schema.list.min);
  if (resource.type === 'verdadero_falso') {
    const answers = new Set(complete.map((item) => (item as Record<string, unknown>).isTrue === true));
    if (answers.size < 2) return TRUE_FALSE_PROBLEM;
  }
  return null;
}
