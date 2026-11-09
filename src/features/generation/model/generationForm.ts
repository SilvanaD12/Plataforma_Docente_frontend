import {
  maxQuantity, maxSequenceTypes, minQuantity,
  type GenerationMode, type StartGenerationRequest,
} from './generationRequest';
import type { ResourceTypeInfo } from './resourceTypes';

export interface GenerationForm {
  mode: GenerationMode;
  resourceTypes: string[];
  quantity: number;
  outcomeId: string;
}

export const initialGenerationForm: GenerationForm = { mode: 'sequence', resourceTypes: [], quantity: 1, outcomeId: '' };

/** Al pasar a modo individual se conserva solo el primer tipo elegido. */
export function changeMode(form: GenerationForm, mode: GenerationMode): GenerationForm {
  return { ...form, mode, resourceTypes: mode === 'individual' ? form.resourceTypes.slice(0, 1) : form.resourceTypes };
}

export function toggleType(form: GenerationForm, id: string): GenerationForm {
  if (form.mode === 'individual') return { ...form, resourceTypes: [id] };
  if (form.resourceTypes.includes(id)) return { ...form, resourceTypes: form.resourceTypes.filter((type) => type !== id) };
  if (form.resourceTypes.length >= maxSequenceTypes) return form;
  return { ...form, resourceTypes: [...form.resourceTypes, id] };
}

/** Ordena los tipos elegidos como el catálogo, que ya viene en orden 5E, igual que los ejecutará el servidor. */
export function generationRequestBody(form: GenerationForm, unitId: string, catalog: ResourceTypeInfo[]): StartGenerationRequest {
  const order = (id: string) => {
    const index = catalog.findIndex((type) => type.id === id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return {
    mode: form.mode,
    unitId,
    resourceTypes: [...new Set(form.resourceTypes)].sort((a, b) => order(a) - order(b)),
    quantity: form.quantity,
    outcomeId: form.outcomeId || null,
  };
}

export function generationFormProblem(body: StartGenerationRequest): string | null {
  if (body.resourceTypes.length === 0) {
    return body.mode === 'individual' ? 'Elige el tipo de recurso que quieres generar.' : 'Elige al menos un tipo de recurso para la secuencia.';
  }
  if (body.mode === 'individual' && body.resourceTypes.length > 1) return 'En el modo individual se genera un solo tipo de recurso.';
  if (body.resourceTypes.length > maxSequenceTypes) return `Una secuencia admite hasta ${maxSequenceTypes} tipos de recurso.`;
  const quantity = body.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < minQuantity || quantity > maxQuantity) {
    return `La cantidad por tipo debe estar entre ${minQuantity} y ${maxQuantity}.`;
  }
  return null;
}
