/**
 * REV-01 · Recurso en revisión, con su versión y su verificación (contrato en specs/001-revision-citas del backend).
 *
 * Por ahora estos tipos viven en la funcionalidad de revisión. Si Generación los necesita, conviene moverlos a
 * src/shared/types/.
 */

export type ReviewStatus = 'pendiente' | 'aprobado' | 'descartado';
export type DistractorDecision = 'pendiente' | 'aceptado' | 'descartado';
export type DiscardReason = 'sin_sentido' | 'tambien_correcto' | 'duplicado' | 'fuera_de_unidad' | 'otro' | 'regenerado';
export type ResourceFormat = 'text' | 'visual' | 'image' | 'audio' | 'interactive';

/** Valor técnico del estado de verificación. En pantalla: vigente, insuficiente o pendiente. */
export type VerificationStatus = 'current' | 'insufficient' | 'pending';

export interface VerificationResult {
  status: VerificationStatus;
  /** Motivo en español. Lo trae siempre que el estado no es vigente. */
  reason: string | null;
  fingerprint: string;
  verifiedVersion: number;
  evidenceThreshold: number;
  ruleVersion: number;
  checkedAt: string;
  /** Solo en una comprobación pendiente con la copia histórica completa: se ofrece «Reintentar comprobación». */
  retryAvailable: boolean;
  summary: Record<string, unknown>;
}

export interface ItemOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
  sourceFragmentIds: string[];
  /** Solo los distractores se deciden; la clave no. */
  decision: DistractorDecision;
  discardReason: DiscardReason | null;
  edited: boolean;
  misconception?: string | null;
  /** Aviso de fiabilidad: el material también lo presenta como respuesta (REV-C4). */
  reliabilityWarning?: string | null;
}

export interface Citation {
  claim: string;
  fragmentIds: string[];
}

/** Copia del fragmento citado, guardada con el recurso al generarlo. */
export interface Evidence {
  id: string;
  text: string;
  location: string;
  documentId: string;
  documentName: string;
  sourceUrl?: string | null;
  license?: string | null;
  /** Fecha de recuperación. `null` significa desconocida (recursos migrados). */
  retrievedAt?: string | null;
}

export interface ResourceMedia {
  status: 'ready' | 'fallback';
  id?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  note?: string | null;
  outdated?: boolean;
  /** REV-C8: cambió la descripción o el guion; el archivo anterior ya no se usa hasta generarlo de nuevo. */
  invalidated?: boolean;
}

export interface Resource {
  id: string;
  unitId: string;
  outcomeId: string | null;
  stage: string;
  type: string;
  title: string;
  /** Contenido. En preguntas es el enunciado. Párrafos separados por una línea en blanco. */
  body: string;
  bodyHtml?: string | null;
  format?: ResourceFormat;
  structure?: Record<string, unknown> | null;
  media?: ResourceMedia | null;
  options: ItemOption[] | null;
  citations: Citation[];
  status: ReviewStatus;
  edited: boolean;
  discardReason: DiscardReason | null;
  createdAt: string;
  updatedAt: string | null;
  decidedAt: string | null;
  evidence: Evidence[];
  /** Versión vigente. Se envía como `expectedVersion` al guardar (REV-R12). */
  version: number;
  verification: VerificationResult | null;
  /** Motivos que impiden aprobar, calculados por el servidor con la misma regla que valida la aprobación. */
  approvalBlockers: string[];
  /** Solo en la respuesta de un guardado: un recurso aprobado cambió su contenido y volvió a revisión. */
  reviewReset?: boolean | null;
  /** Aviso pedagógico no bloqueante devuelto por el servidor cuando el recurso proviene de un plan. */
  planWarning?: PlanWarning | null;
}

export type PlanWarningKind = 'overlap' | 'missing_concepts';

export interface PlanWarning {
  kind: PlanWarningKind;
  reason: string;
  developedConcepts: string[];
  missingOwnConcepts: string[];
}

export function parsePlanWarning(value: unknown): PlanWarning | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== 'overlap' && raw.kind !== 'missing_concepts') return null;
  if (typeof raw.reason !== 'string') return null;
  if (!Array.isArray(raw.developedConcepts) || !raw.developedConcepts.every((c) => typeof c === 'string')) {
    return null;
  }
  if (!Array.isArray(raw.missingOwnConcepts) || !raw.missingOwnConcepts.every((c) => typeof c === 'string')) {
    return null;
  }
  return {
    kind: raw.kind,
    reason: raw.reason,
    developedConcepts: raw.developedConcepts,
    missingOwnConcepts: raw.missingOwnConcepts,
  };
}

export interface StaleDocument {
  documentId: string;
  documentName: string;
  missingFragmentIds: string[];
}

export function parseStaleDocuments(value: unknown): StaleDocument[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed: StaleDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const raw = item as Record<string, unknown>;
    if (typeof raw.documentId !== 'string' || typeof raw.documentName !== 'string') {
      return null;
    }
    if (
      !Array.isArray(raw.missingFragmentIds) ||
      raw.missingFragmentIds.length === 0 ||
      !raw.missingFragmentIds.every((id) => typeof id === 'string')
    ) {
      return null;
    }
    parsed.push({
      documentId: raw.documentId,
      documentName: raw.documentName,
      missingFragmentIds: raw.missingFragmentIds,
    });
  }
  return parsed;
}

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobado',
  descartado: 'Descartado',
};

export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}

const DISCARD_REASON_LABELS: Record<DiscardReason, string> = {
  sin_sentido: 'No tiene sentido o es confuso',
  tambien_correcto: 'También es correcto',
  duplicado: 'Repite otro recurso',
  fuera_de_unidad: 'No corresponde a la unidad',
  otro: 'Otro motivo',
  regenerado: 'Reemplazado por uno regenerado',
};

/**
 * Motivos que el docente elige al descartar un recurso. «También es correcto» es solo de los distractores y
 * «regenerado» lo pone el servidor al reemplazar el recurso por uno regenerado (REV-C12).
 */
export const RESOURCE_DISCARD_REASONS: { value: DiscardReason; label: string }[] = (
  ['sin_sentido', 'duplicado', 'fuera_de_unidad', 'otro'] as const
).map((value) => ({ value, label: DISCARD_REASON_LABELS[value] }));

export function discardReasonLabel(reason: DiscardReason | null | undefined): string | null {
  return reason ? DISCARD_REASON_LABELS[reason] : null;
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  current: 'Vigente',
  insufficient: 'Insuficiente',
  pending: 'Pendiente',
};

export function verificationLabel(verification: VerificationResult | null | undefined): string {
  return verification ? VERIFICATION_LABELS[verification.status] : 'Sin comprobar';
}

/** Qué puede hacer el docente según la verificación (REV-C3 y REV-C11). */
export type VerificationAction = 'retry' | 'regenerate' | 'edit-or-regenerate';

export function verificationAction(verification: VerificationResult | null | undefined): VerificationAction | null {
  if (!verification || verification.status === 'current') return null;
  if (verification.status === 'insufficient') return 'edit-or-regenerate';
  return verification.retryAvailable ? 'retry' : 'regenerate';
}

export const STAGE_ORDER: Record<string, number> = {
  engage: 0,
  explore: 1,
  explain: 2,
  elaborate: 3,
  evaluate: 4,
};

const STAGE_LABELS: Record<string, string> = {
  engage: 'Enganchar',
  explore: 'Explorar',
  explain: 'Explicar',
  elaborate: 'Elaborar',
  evaluate: 'Evaluar',
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  pregunta_detonante: 'Pregunta detonante',
  sondeo_diagnostico: 'Sondeo de ideas previas',
  audio_detonante: 'Cápsula de audio',
  reto_prediccion: 'Reto de predicción',
  guia_exploracion: 'Guía de exploración',
  caso_indagacion: 'Caso con preguntas',
  imagen_ilustrativa: 'Imagen ilustrativa',
  diagrama_proceso: 'Diagrama de proceso',
  exploracion_guiada: 'Exploración guiada',
  actividad_kinestesica: 'Actividad kinestésica',
  explicacion: 'Explicación del tema',
  glosario: 'Glosario',
  mapa_conceptual: 'Mapa conceptual',
  infografia: 'Infografía',
  podcast_resumen: 'Resumen en pódcast',
  ejercicio_aplicacion: 'Ejercicio de aplicación',
  caso_aplicado: 'Caso aplicado',
  emparejamiento: 'Actividad de relacionar',
  ordenar_pasos: 'Actividad de ordenar',
  item_opcion_multiple: 'Pregunta de opción múltiple',
  verdadero_falso: 'Verdadero o falso',
  completar_espacios: 'Completar espacios',
};

export function resourceTypeLabel(type: string): string {
  return RESOURCE_TYPE_LABELS[type] ?? type;
}

const approvalDateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

export function formatApprovalDate(decidedAt: string | null | undefined): string | null {
  if (!decidedAt) return null;
  const date = new Date(decidedAt);
  if (Number.isNaN(date.getTime())) return null;
  return approvalDateFormat.format(date);
}
