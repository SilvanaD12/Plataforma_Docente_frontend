import {
  maxQuantity, maxSequenceTypes, minQuantity,
  type GenerationInterpretationDraft, type GenerationMode, type ResourceModality, type StartGenerationRequest,
} from './generationRequest';
import { hasModalityCatalog, typesForModality, type ResourceTypeInfo } from './resourceTypes';

export interface GenerationForm {
  mode: GenerationMode;
  modality: ResourceModality;
  resourceTypes: string[];
  quantity: number;
  outcomeId: string;
  audience: string;
  competency: string;
  instructions: string;
}

export const maxGenerationContextLength = 200;

export const initialGenerationForm: GenerationForm = {
  mode: 'sequence',
  modality: 'Textual',
  resourceTypes: [],
  quantity: 1,
  outcomeId: '',
  audience: '',
  competency: '',
  instructions: '',
};

export function applyInterpretationDraft(
  form: GenerationForm,
  draft: GenerationInterpretationDraft,
): GenerationForm {
  return {
    ...form,
    mode: draft.mode ?? form.mode,
    modality: draft.modalities?.[0] ?? form.modality,
    resourceTypes: draft.resourceTypes.length ? draft.resourceTypes : form.resourceTypes,
    quantity: draft.quantity ?? form.quantity,
    outcomeId: draft.outcomeId === undefined ? form.outcomeId : draft.outcomeId ?? '',
    audience: draft.audience ?? form.audience,
    competency: draft.competency ?? form.competency,
    instructions: draft.instructions ?? form.instructions,
  };
}

/** Al pasar a modo individual se conserva solo el primer tipo elegido. */
export function changeMode(form: GenerationForm, mode: GenerationMode): GenerationForm {
  return { ...form, mode, resourceTypes: mode === 'individual' ? form.resourceTypes.slice(0, 1) : form.resourceTypes };
}

export function changeModality(form: GenerationForm, modality: ResourceModality, catalog: ResourceTypeInfo[]): GenerationForm {
  const compatibleIds = new Set(typesForModality(catalog, modality).map((type) => type.id));
  return { ...form, modality, resourceTypes: form.resourceTypes.filter((id) => compatibleIds.has(id)) };
}

export function toggleType(form: GenerationForm, id: string): GenerationForm {
  if (form.mode === 'individual') return { ...form, resourceTypes: [id] };
  if (form.resourceTypes.includes(id)) return { ...form, resourceTypes: form.resourceTypes.filter((type) => type !== id) };
  if (form.resourceTypes.length >= maxSequenceTypes) return form;
  return { ...form, resourceTypes: [...form.resourceTypes, id] };
}

/**
 * Quita repetidos y ordena los tipos como el catálogo, que ya viene en orden 5E, igual que los ejecutará el servidor.
 * La usan el cuerpo del pedido y la vista previa, para que nunca muestren órdenes distintos.
 */
export function orderResourceTypes(ids: string[], catalog: ResourceTypeInfo[]) {
  const order = (id: string) => {
    const index = catalog.findIndex((type) => type.id === id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...new Set(ids)].sort((a, b) => order(a) - order(b));
}

/** Tipos elegidos que se envían: con catálogo de modalidades, solo los compatibles con la modalidad elegida. */
export function selectedResourceTypes(form: GenerationForm, catalog: ResourceTypeInfo[]) {
  if (!hasModalityCatalog(catalog)) return form.resourceTypes;
  const visibleIds = new Set(typesForModality(catalog, form.modality).map((type) => type.id));
  return form.resourceTypes.filter((id) => visibleIds.has(id));
}

/** Cuerpo y problema del pedido tal como se arman al pulsar «Generar». La vista previa muestra y confirma este cuerpo. */
export function generationSubmission(form: GenerationForm, unitId: string, catalog: ResourceTypeInfo[]) {
  const body = generationRequestBody({ ...form, resourceTypes: selectedResourceTypes(form, catalog) }, unitId, catalog);
  return { body, problem: generationFormProblem(body) };
}

export function generationRequestBody(form: GenerationForm, unitId: string, catalog: ResourceTypeInfo[]): StartGenerationRequest {
  return {
    mode: form.mode,
    unitId,
    resourceTypes: orderResourceTypes(form.resourceTypes, catalog),
    quantity: form.quantity,
    outcomeId: form.outcomeId || null,
    audience: form.audience.trim() || undefined,
    competency: form.competency.trim() || undefined,
    instructions: form.instructions.trim() || undefined,
    // Older catalog responses omit modalities. Keep their existing request shape.
    ...(hasModalityCatalog(catalog) ? { modalities: [form.modality] } : {}),
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
