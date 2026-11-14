import type { Unit } from '../../../shared/types/courses';
import { generationRequestBody, orderResourceTypes, type GenerationForm } from './generationForm';
import { stageLabel, type GenerationMode, type ResourceModality, type Stage, type StartGenerationRequest } from './generationRequest';
import type { ResourceTypeInfo } from './resourceTypes';

export interface GenerationPreviewStep {
  /** Posición en la secuencia, desde 1. */
  position: number;
  resourceType: string;
  typeName: string;
  stage: Stage | null;
  stageLabel: string;
  quantity: number;
}

/** Lo que se va a pedir, en el mismo orden 5E en que el servidor ejecutará los pasos (HU-040). */
export interface GenerationPreview {
  unitTitle: string;
  unitNumber: number;
  mode: GenerationMode;
  modeLabel: string;
  modality: ResourceModality;
  steps: GenerationPreviewStep[];
  /** Texto del resultado de aprendizaje, o null si el pedido abarca toda la unidad. */
  outcome: string | null;
  audience: string | null;
  competency: string | null;
  instructions: string | null;
  /** Tipos × cantidad por tipo. */
  totalResources: number;
}

const modeLabels: Record<GenerationMode, string> = {
  individual: 'Recurso individual',
  sequence: 'Secuencia 5E',
};

const optionalText = (value: string | undefined) => value?.trim() || null;

function outcomeText(unit: Unit, outcomeId: string | null | undefined) {
  if (!outcomeId) return null;
  const outcome = unit.outcomes.find(({ id }) => id === outcomeId);
  if (!outcome) return outcomeId;
  return outcome.code ? `${outcome.code}: ${outcome.text}` : outcome.text;
}

/**
 * Vista previa de un cuerpo de pedido, sin importar cómo se armó (formulario o chat de HU-038).
 * Ordena con la misma función que el cuerpo del pedido, así que ambos siempre coinciden.
 */
export function previewFromRequest(body: StartGenerationRequest, unit: Unit, catalog: ResourceTypeInfo[]): GenerationPreview {
  const quantity = body.quantity ?? 1;
  const steps = orderResourceTypes(body.resourceTypes, catalog).map((id, index) => {
    const type = catalog.find((item) => item.id === id);
    return {
      position: index + 1,
      resourceType: id,
      typeName: type?.name ?? id,
      stage: type?.stage ?? null,
      stageLabel: type ? stageLabel(type.stage) : 'Sin etapa',
      quantity,
    };
  });
  return {
    unitTitle: unit.title,
    unitNumber: unit.number,
    mode: body.mode,
    modeLabel: modeLabels[body.mode],
    modality: body.modalities?.[0] ?? 'Textual',
    steps,
    outcome: outcomeText(unit, body.outcomeId),
    audience: optionalText(body.audience),
    competency: optionalText(body.competency),
    instructions: optionalText(body.instructions),
    totalResources: steps.length * quantity,
  };
}

/** Vista previa del estado del formulario: el mismo cuerpo que se enviaría al confirmar. */
export function generationPreview(form: GenerationForm, unit: Unit, catalog: ResourceTypeInfo[]) {
  return previewFromRequest(generationRequestBody(form, unit.id, catalog), unit, catalog);
}
