// Tipos escritos a mano según contracts/generation-requests.openapi.yaml (GEN-01).
// Si el contrato cambia, se actualizan en el mismo PR (research.md, R10).

export const stages = ['engage', 'explore', 'explain', 'elaborate', 'evaluate'] as const;
export type Stage = typeof stages[number];

export type RequestStatus = 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed' | 'interrupted';
export type StepStatus = 'pending' | 'running' | 'succeeded' | 'rejected' | 'failed' | 'interrupted';
export const resourceModalities = ['Textual', 'Gamificado', 'Multimedia', 'Kinestésico'] as const;
export type ResourceModality = typeof resourceModalities[number];

export type GenerationMode = 'individual' | 'sequence';
export type RequestMode = GenerationMode | 'regeneration';
export type RetrievalMode = 'hybrid' | 'bm25_fallback';
/** Mismos valores que `verification.status` de REV-01. */
export type VerificationStatus = 'current' | 'insufficient' | 'pending';
export type Difficulty = 'basica' | 'intermedia' | 'avanzada';
export type RejectionKind = 'grounding' | 'repetition' | 'structure' | 'distractor';

export const maxSequenceTypes = 8;
export const minQuantity = 1;
export const maxQuantity = 5;

export interface StartGenerationRequest {
  mode: GenerationMode;
  unitId: string;
  resourceTypes: string[];
  quantity?: number;
  outcomeId?: string | null;
  difficulty?: Difficulty;
  optionCount?: number;
  topK?: number;
  evidenceThreshold?: number;
  instructions?: string;
  audience?: string;
  competency?: string;
  modalities?: [ResourceModality];
}

export interface GenerationInterpretationDraft {
  unitId: string;
  resourceTypes: string[];
  mode?: GenerationMode | null;
  quantity?: number | null;
  modalities?: [ResourceModality] | null;
  outcomeId?: string | null;
  audience?: string | null;
  competency?: string | null;
  instructions?: string | null;
}

export interface GenerationInterpretationIssue {
  field: keyof Omit<GenerationInterpretationDraft, 'mode'>;
  kind: 'missing' | 'ambiguous' | 'not_allowed';
  message: string;
  options: { value: string | number; label: string }[];
}

export interface GenerationInterpretation {
  draft: GenerationInterpretationDraft;
  stages: { resourceType: string; stage: Stage }[];
  issues: GenerationInterpretationIssue[];
  suggestedUnit?: { unitId: string; label: string } | null;
}

export interface Problem {
  code: string;
  message: string;
}

export interface StepResource {
  id: string;
  title: string;
  verificationStatus: VerificationStatus;
}

export interface StepRejection {
  title: string;
  reason: string;
  kind: RejectionKind;
}

export interface StepGenerator {
  description: string;
  usesAi: boolean;
  fallback: boolean;
}

export interface GroundingReport {
  checkedClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
  hallucinationRate: number | null;
  unsupportedParagraphs?: number;
  rejectedResources?: { title: string; reason: string }[];
}

export interface DistractorReliability {
  evaluatedDistractors: number;
  discardedAsCorrect: number;
  reliabilityErrorRate?: number | null;
}

export interface GenerationStep {
  position: number;
  stage: Stage;
  resourceType: string;
  agent: string;
  status: StepStatus;
  resourceIds: string[];
  resources?: StepResource[];
  rejections: StepRejection[];
  generator?: StepGenerator | null;
  grounding?: GroundingReport | null;
  distractorReliability?: DistractorReliability | null;
  error?: Problem | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface GenerationParametersView {
  resourceTypes: string[];
  quantity: number;
  outcomeId?: string | null;
  difficulty: Difficulty;
  optionCount: number;
  topK: number;
  evidenceThreshold: number;
  instructions: string;
  audience: string;
  competency: string;
  modalities: string[];
}

export interface GenerationRequestSummary {
  id: string;
  mode: RequestMode;
  unitId: string;
  status: RequestStatus;
  resourceTypes: string[];
  createdAt: string;
  finishedAt?: string | null;
}

export interface GenerationRequestStatus extends GenerationRequestSummary {
  parameters: GenerationParametersView;
  retrievalMode?: RetrievalMode | null;
  regeneration?: { resourceId: string; resourceVersion: number } | null;
  failure?: Problem | null;
  startedAt?: string | null;
  steps: GenerationStep[];
}

const terminalStatuses: ReadonlySet<RequestStatus> = new Set(['succeeded', 'partially_succeeded', 'failed', 'interrupted']);

export function isTerminal(status: RequestStatus) {
  return terminalStatuses.has(status);
}

const requestLabels: Record<RequestStatus, string> = {
  queued: 'En cola',
  running: 'En curso',
  succeeded: 'Terminado',
  partially_succeeded: 'Terminado con resultados parciales',
  failed: 'No se pudo completar',
  interrupted: 'Interrumpido',
};

export function requestLabel(status: RequestStatus) {
  return requestLabels[status];
}

const stepLabels: Record<StepStatus, string> = {
  pending: 'En espera',
  running: 'Generando',
  succeeded: 'Listo',
  rejected: 'Rechazado',
  failed: 'Con error',
  interrupted: 'Interrumpido',
};

export function stepLabel(status: StepStatus) {
  return stepLabels[status];
}

const stageLabels: Record<Stage, string> = {
  engage: 'Enganchar',
  explore: 'Explorar',
  explain: 'Explicar',
  elaborate: 'Elaborar',
  evaluate: 'Evaluar',
};

export function stageLabel(stage: Stage) {
  return stageLabels[stage];
}

// Mismos textos que Revisión (src/features/review), sin importar desde allí.
const verificationLabels: Record<VerificationStatus, string> = {
  current: 'Vigente',
  insufficient: 'Insuficiente',
  pending: 'Pendiente',
};

export function verificationLabel(status: VerificationStatus) {
  return verificationLabels[status];
}

export function orderedSteps(steps: GenerationStep[]) {
  return [...steps].sort((a, b) => a.position - b.position);
}

export function finishedStepCount(steps: GenerationStep[]) {
  return steps.filter(({ status }) => status !== 'pending' && status !== 'running').length;
}

export function fallbackSteps(steps: GenerationStep[]) {
  return orderedSteps(steps).filter(({ generator }) => generator?.fallback === true);
}

/** Ruta relativa a la pestaña Generación. Ajustar cuando REV-01 publique su ruta de detalle. */
export function reviewPath(resourceId: string) {
  return '../review?resource=' + encodeURIComponent(resourceId);
}
