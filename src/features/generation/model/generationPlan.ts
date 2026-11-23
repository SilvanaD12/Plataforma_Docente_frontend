// Plan de generación (GEN-P1 a GEN-P3). Tipos escritos a mano según
// specs/006-plan-de-generacion/contracts/generation-plans.openapi.yaml y docs/api/openapi.json del backend.

import {
  maxQuantity, minQuantity, stages,
  type Difficulty, type ResourceModality, type RetrievalMode, type Stage, type StartGenerationRequest,
} from './generationRequest';
import type { ResourceTypeInfo } from './resourceTypes';

export type PlanStatus = 'draft' | 'approved' | 'used';

export interface RequestedType {
  type: string;
  /** `null`: el planificador decide la cantidad. */
  quantity: number | null;
}

export interface CreateGenerationPlan {
  unitId: string;
  instructions?: string;
  audience?: string;
  competency?: string;
  outcomeId?: string | null;
  modality?: ResourceModality | null;
  resourceTypes: RequestedType[];
  difficulty?: Difficulty;
  optionCount?: number;
  evidenceThreshold?: number;
  topK?: number;
}

export interface PlanInputs {
  instructions: string;
  audience: string;
  competency: string;
  outcomeId: string | null;
  modality: ResourceModality | null;
  resourceTypes: RequestedType[];
  difficulty: string;
  optionCount: number;
  evidenceThreshold: number;
  topK: number;
}

export interface PlanFragment {
  id: string;
  documentId: string;
  documentName: string;
  location: string;
  text: string;
  relevance: number;
  sourceUrl?: string | null;
  license?: string | null;
}

export interface PlanItem {
  position: number;
  stage: Stage;
  resourceType: string;
  quantity: number;
  purpose: string;
  covers: string[];
  /** Solo lectura: los `covers` de los demás ítems, en orden. */
  doesNotCover: string[];
  fragmentIds: string[];
}

export type PlanProblemCode =
  | 'PLAN_EMPTY' | 'ITEM_WITHOUT_EVIDENCE' | 'FRAGMENT_NOT_IN_EVIDENCE' | 'CONCEPT_OWNED_TWICE'
  | 'NOT_ENOUGH_CONCEPTS' | 'TYPE_NOT_IN_CATALOG' | 'RESOURCE_TYPE_NOT_IN_MODALITY' | 'QUANTITY_OUT_OF_RANGE'
  | 'TOO_MANY_TYPES' | 'PURPOSE_REQUIRED' | 'CONCEPT_NOT_SHORT';

export interface PlanProblem {
  code: PlanProblemCode | string;
  /** En español, para mostrar junto al ítem. */
  message: string;
  itemPosition: number | null;
}

export interface Referent {
  name: string;
  description: string;
  fragmentIds: string[];
}

export interface PreviousTypology {
  sessionLabel: string;
  usedAt: string;
  resourceTypes: string[];
}

export interface PlanGenerator {
  description: string;
  usesAi: boolean;
  fallback: boolean;
  fallbackReason: string | null;
  attempts?: number;
}

export type PlanWarning = 'SAME_TYPOLOGY_AS_LAST_SESSION';

export interface GenerationPlan {
  id: string;
  version: number;
  status: PlanStatus;
  origin: 'teacher' | 'implicit';
  unitId: string;
  inputs: PlanInputs;
  evidence: { retrievalMode: RetrievalMode | null; retrievedAt: string; fragments: PlanFragment[] };
  referents: Referent[];
  sessionContext: { previousTypologies: PreviousTypology[] };
  items: PlanItem[];
  validation: { valid: boolean; problems: PlanProblem[] };
  warnings: (PlanWarning | string)[];
  generator: PlanGenerator;
  usedByRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  usedAt: string | null;
}

export interface EditablePlanItem {
  resourceType: string;
  quantity: number;
  purpose: string;
  covers: string[];
  fragmentIds: string[];
}

export interface UpdateGenerationPlan {
  expectedVersion: number;
  items: EditablePlanItem[];
}

/** Un documento afectado en `409 PLAN_EVIDENCE_STALE`. */
export interface StaleDocument {
  documentId: string;
  documentName: string;
  missingFragmentIds: string[];
}

// Límites del contrato (EditablePlanItem y UpdateGenerationPlan). Pasarlos responde 422 INVALID_PARAMETERS
// y el docente perdería la edición, así que se comprueban antes de guardar.
export const maxPlanItems = 40;
export const maxPurposeLength = 300;
export const maxConceptsPerItem = 20;
export const maxConceptLength = 120;
export const maxFragmentsPerItem = 12;

const planStatusLabels: Record<PlanStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  used: 'Usado en una generación',
};

export function planStatusLabel(status: PlanStatus) {
  return planStatusLabels[status];
}

// ---------------------------------------------------------------------------------------------------------------
// Crear el plan desde el formulario (o el borrador del chat, que llena el formulario).

/**
 * Cuerpo de `POST /generation-plans` a partir del cuerpo que arma el formulario. Usa los mismos tipos ya filtrados por
 * modalidad, sin repetidos y en el orden de las etapas, así que el plan pide exactamente lo que se habría generado.
 */
export function planRequestFromGenerationBody(body: StartGenerationRequest): CreateGenerationPlan {
  const quantity = body.quantity ?? null;
  return {
    unitId: body.unitId,
    instructions: body.instructions ?? '',
    audience: body.audience ?? '',
    competency: body.competency ?? '',
    outcomeId: body.outcomeId ?? null,
    modality: body.modalities?.[0] ?? null,
    resourceTypes: body.resourceTypes.map((type) => ({ type, quantity })),
    ...(body.difficulty ? { difficulty: body.difficulty } : {}),
    ...(body.optionCount ? { optionCount: body.optionCount } : {}),
    ...(body.evidenceThreshold !== undefined ? { evidenceThreshold: body.evidenceThreshold } : {}),
  };
}

const difficulties: Difficulty[] = ['basica', 'intermedia', 'avanzada'];

/** Volver a planificar con lo que pidió el docente (por ejemplo, tras `PLAN_EVIDENCE_STALE`). */
export function planRequestFromInputs(unitId: string, inputs: PlanInputs): CreateGenerationPlan {
  const difficulty = difficulties.find((value) => value === inputs.difficulty);
  return {
    unitId,
    instructions: inputs.instructions,
    audience: inputs.audience,
    competency: inputs.competency,
    outcomeId: inputs.outcomeId,
    modality: inputs.modality,
    resourceTypes: inputs.resourceTypes.map(({ type, quantity }) => ({ type, quantity })),
    ...(difficulty ? { difficulty } : {}),
    optionCount: inputs.optionCount,
    evidenceThreshold: inputs.evidenceThreshold,
    topK: inputs.topK,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Edición local del plan.

/** Ítem en edición. `key` identifica el ítem en pantalla; `savedPosition` une los problemas del servidor al ítem. */
export interface DraftPlanItem extends EditablePlanItem {
  key: string;
  stage: Stage | null;
  savedPosition: number | null;
}

export function draftItems(plan: GenerationPlan): DraftPlanItem[] {
  return orderByStage(plan.items.map((item) => ({
    key: 'item-' + item.position,
    stage: item.stage,
    savedPosition: item.position,
    resourceType: item.resourceType,
    quantity: item.quantity,
    purpose: item.purpose,
    covers: [...item.covers],
    fragmentIds: [...item.fragmentIds],
  })));
}

const stageIndex = (stage: Stage | null) => (stage ? stages.indexOf(stage) : stages.length);

/** Orden de etapa y, dentro de cada etapa, el orden que dio el docente (orden estable). */
export function orderByStage<T extends { stage: Stage | null }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => stageIndex(a.item.stage) - stageIndex(b.item.stage) || a.index - b.index)
    .map(({ item }) => item);
}

export function groupItemsByStage<T extends { stage: Stage | null }>(items: T[]) {
  const ordered = orderByStage(items);
  const groups: { stage: Stage | null; items: T[] }[] = [];
  for (const item of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.stage === item.stage) last.items.push(item);
    else groups.push({ stage: item.stage, items: [item] });
  }
  return groups;
}

const normalizeConcept = (concept: string) => concept.trim().replace(/\s+/g, ' ');
const sameConcept = (a: string, b: string) => normalizeConcept(a).toLocaleLowerCase('es') === normalizeConcept(b).toLocaleLowerCase('es');

function updateItem(items: DraftPlanItem[], key: string, change: (item: DraftPlanItem) => DraftPlanItem) {
  return items.map((item) => (item.key === key ? change(item) : item));
}

/** Pasa un concepto propio de un ítem a otro. Si el destino ya lo tiene, solo lo quita del origen. */
export function moveConcept(items: DraftPlanItem[], fromKey: string, concept: string, toKey: string): DraftPlanItem[] {
  if (fromKey === toKey) return items;
  const source = items.find(({ key }) => key === fromKey);
  const target = items.find(({ key }) => key === toKey);
  if (!source || !target || !source.covers.includes(concept)) return items;
  return items.map((item) => {
    if (item.key === fromKey) return { ...item, covers: item.covers.filter((value) => value !== concept) };
    if (item.key === toKey) {
      return item.covers.some((value) => sameConcept(value, concept)) ? item : { ...item, covers: [...item.covers, concept] };
    }
    return item;
  });
}

export function addConcept(items: DraftPlanItem[], key: string, concept: string): DraftPlanItem[] {
  const value = normalizeConcept(concept);
  if (!value) return items;
  return updateItem(items, key, (item) => (
    item.covers.some((existing) => sameConcept(existing, value)) ? item : { ...item, covers: [...item.covers, value] }
  ));
}

export function removeConcept(items: DraftPlanItem[], key: string, concept: string): DraftPlanItem[] {
  return updateItem(items, key, (item) => ({ ...item, covers: item.covers.filter((value) => value !== concept) }));
}

export function setPurpose(items: DraftPlanItem[], key: string, purpose: string): DraftPlanItem[] {
  return updateItem(items, key, (item) => ({ ...item, purpose }));
}

export function setQuantity(items: DraftPlanItem[], key: string, quantity: number): DraftPlanItem[] {
  return updateItem(items, key, (item) => ({ ...item, quantity }));
}

export function toggleFragment(items: DraftPlanItem[], key: string, fragmentId: string): DraftPlanItem[] {
  return updateItem(items, key, (item) => ({
    ...item,
    fragmentIds: item.fragmentIds.includes(fragmentId)
      ? item.fragmentIds.filter((id) => id !== fragmentId)
      : [...item.fragmentIds, fragmentId],
  }));
}

/** Agrega un ítem al final de su etapa. Necesita propósito y conceptos antes de guardarse. */
export function addItem(items: DraftPlanItem[], resourceType: string, catalog: ResourceTypeInfo[], newKey: string): DraftPlanItem[] {
  const stage = catalog.find(({ id }) => id === resourceType)?.stage ?? null;
  return orderByStage([
    ...items,
    { key: newKey, stage, savedPosition: null, resourceType, quantity: 1, purpose: '', covers: [], fragmentIds: [] },
  ]);
}

export function removeItem(items: DraftPlanItem[], key: string): DraftPlanItem[] {
  return items.filter((item) => item.key !== key);
}

/** Conceptos de los demás ítems, en orden: lo que el servidor devuelve como `doesNotCover`, con la edición local. */
export function conceptsOfOtherItems(items: DraftPlanItem[], key: string) {
  return orderByStage(items).filter((item) => item.key !== key).flatMap((item) => item.covers);
}

/**
 * Conceptos citados entre «…» en el propósito que ya no son propios del ítem: los que el ítem tenía al guardarse o que
 * ahora tiene otro ítem (se movieron o se quitaron). Una cita que no es un concepto del plan no se señala.
 * No cambia el propósito: solo sirve para avisar al docente.
 */
export function staleConceptMentions(purpose: string, ownConcepts: string[], knownConcepts: string[]) {
  const mentions = [...purpose.matchAll(/«([^«»]+)»/g)].map(([, mention]) => normalizeConcept(mention)).filter(Boolean);
  const isKnown = (mention: string) => knownConcepts.some((concept) => sameConcept(concept, mention));
  const isOwn = (mention: string) => ownConcepts.some((concept) => sameConcept(concept, mention));
  return mentions
    .filter((mention) => isKnown(mention) && !isOwn(mention))
    .filter((mention, index, all) => all.findIndex((other) => sameConcept(other, mention)) === index);
}

/** Cuerpo de `PUT /generation-plans/{id}`: ítems en orden de etapa, sin `stage` ni `doesNotCover`. */
export function planUpdateBody(expectedVersion: number, items: DraftPlanItem[]): UpdateGenerationPlan {
  return {
    expectedVersion,
    items: orderByStage(items).map((item) => ({
      resourceType: item.resourceType,
      quantity: item.quantity,
      purpose: item.purpose.trim(),
      covers: item.covers.map(normalizeConcept).filter(Boolean),
      fragmentIds: [...item.fragmentIds],
    })),
  };
}

export function sameItems(a: DraftPlanItem[], b: DraftPlanItem[]) {
  const body = (items: DraftPlanItem[]) => JSON.stringify(planUpdateBody(1, items).items);
  return body(a) === body(b);
}

/**
 * Problemas que el servidor no guardaría (422 INVALID_PARAMETERS por el esquema), por clave de ítem.
 * Las demás reglas (evidencia, conceptos repetidos, etc.) las valida el servidor al guardar y se muestran junto al ítem.
 */
export function localItemProblems(items: DraftPlanItem[]): Map<string, string[]> {
  const problems = new Map<string, string[]>();
  for (const item of items) {
    const found: string[] = [];
    const purpose = item.purpose.trim();
    if (!purpose) found.push('Escribe el propósito del ítem.');
    else if (purpose.length > maxPurposeLength) found.push(`El propósito admite hasta ${maxPurposeLength} caracteres.`);
    if (item.covers.length === 0) found.push('El ítem necesita al menos un concepto propio.');
    if (item.covers.length > maxConceptsPerItem) found.push(`Un ítem admite hasta ${maxConceptsPerItem} conceptos.`);
    if (item.covers.some((concept) => concept.length > maxConceptLength)) {
      found.push(`Cada concepto admite hasta ${maxConceptLength} caracteres.`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < minQuantity || item.quantity > maxQuantity) {
      found.push(`La cantidad debe estar entre ${minQuantity} y ${maxQuantity}.`);
    }
    if (item.fragmentIds.length > maxFragmentsPerItem) found.push(`Un ítem admite hasta ${maxFragmentsPerItem} fragmentos.`);
    if (found.length) problems.set(item.key, found);
  }
  return problems;
}

export function planLevelLocalProblem(items: DraftPlanItem[]) {
  return items.length > maxPlanItems ? `El plan admite hasta ${maxPlanItems} ítems.` : null;
}

/** Problemas del servidor agrupados: los del plan (`itemPosition` nulo) y los de cada ítem guardado. */
export function problemsByItem(problems: PlanProblem[], items: DraftPlanItem[]) {
  const byKey = new Map<string, PlanProblem[]>();
  const general: PlanProblem[] = [];
  for (const problem of problems) {
    const item = problem.itemPosition === null ? undefined : items.find(({ savedPosition }) => savedPosition === problem.itemPosition);
    if (!item) {
      general.push(problem);
      continue;
    }
    byKey.set(item.key, [...(byKey.get(item.key) ?? []), problem]);
  }
  return { general, byKey };
}

export interface PlanActionState {
  /** Hay cambios sin guardar. */
  dirty: boolean;
  /** Se está guardando, aprobando, generando o creando. */
  busy: boolean;
  /** Problemas locales que impiden guardar. */
  blocked: boolean;
}

/** Qué acciones se habilitan según el estado del plan y la edición en curso. */
export function planActions(plan: GenerationPlan, { dirty, busy, blocked }: PlanActionState) {
  const editable = plan.status !== 'used';
  return {
    canEdit: editable && !busy,
    canSave: editable && dirty && !busy && !blocked,
    canApprove: plan.status === 'draft' && !dirty && !busy && plan.validation.valid,
    canGenerate: plan.status === 'approved' && !dirty && !busy,
  };
}

/** El último plan que el docente puede seguir editando o usar: el más reciente de la lista, si no está usado. */
export function latestOpenPlan(plans: GenerationPlan[]) {
  const [latest] = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return latest && latest.status !== 'used' && latest.origin === 'teacher' ? latest : null;
}

export function isPlanProblem(value: unknown): value is PlanProblem {
  if (!value || typeof value !== 'object') return false;
  const problem = value as Record<string, unknown>;
  return typeof problem.code === 'string' && typeof problem.message === 'string'
    && (problem.itemPosition === null || typeof problem.itemPosition === 'number');
}

export function isStaleDocument(value: unknown): value is StaleDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return typeof document.documentId === 'string' && typeof document.documentName === 'string'
    && Array.isArray(document.missingFragmentIds);
}
