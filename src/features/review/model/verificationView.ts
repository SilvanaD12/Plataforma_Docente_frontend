import { verificationAction, verificationLabel, type VerificationResult } from './resource';

export type VerificationTone = 'ok' | 'warning' | 'blocked' | 'unknown';

export interface VerificationView {
  label: string;
  tone: VerificationTone;
  /** Motivo que da el servidor cuando la verificación no es vigente. */
  reason: string | null;
  /** Texto del botón de reintento; null si no se ofrece (REV-C3). */
  retryLabel: string | null;
  /** Qué puede hacer el docente cuando no hay reintento. */
  hint: string | null;
}

const HINTS = {
  regenerate: 'Regenera el recurso para poder verificarlo.',
  'edit-or-regenerate': 'Corrige el texto o regenera el recurso.',
} as const;

/** Decide qué muestra la insignia de verificación en cada estado (REV-C3, REV-C11). */
export function verificationView(verification: VerificationResult | null | undefined): VerificationView {
  const label = verificationLabel(verification);
  if (!verification) {
    return { label, tone: 'unknown', reason: null, retryLabel: null, hint: 'Se comprueba al guardar el recurso.' };
  }
  const action = verificationAction(verification);
  const reason = verification.status === 'current' ? null : verification.reason;
  if (action === null) return { label, tone: 'ok', reason, retryLabel: null, hint: null };
  if (action === 'retry') return { label, tone: 'warning', reason, retryLabel: 'Reintentar comprobación', hint: null };
  return { label, tone: 'blocked', reason, retryLabel: null, hint: HINTS[action] };
}
