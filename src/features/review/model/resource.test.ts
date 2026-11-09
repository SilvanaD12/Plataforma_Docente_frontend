import { describe, expect, it } from 'vitest';
import {
  reviewStatusLabel,
  VERIFICATION_LABELS,
  verificationAction,
  verificationLabel,
  type VerificationResult,
} from './resource';

function verification(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    status: 'current',
    reason: null,
    fingerprint: 'sha256:' + 'a'.repeat(64),
    verifiedVersion: 2,
    evidenceThreshold: 0.6,
    ruleVersion: 1,
    checkedAt: '2026-11-08T15:00:00+00:00',
    retryAvailable: false,
    summary: {},
    ...overrides,
  };
}

describe('estado de revisión', () => {
  it('muestra en español el estado de revisión del recurso', () => {
    expect(reviewStatusLabel('pendiente')).toBe('Pendiente de revisión');
    expect(reviewStatusLabel('aprobado')).toBe('Aprobado');
    expect(reviewStatusLabel('descartado')).toBe('Descartado');
  });
});

describe('estado de verificación', () => {
  it('muestra en español los tres estados técnicos del contrato', () => {
    expect(VERIFICATION_LABELS).toEqual({ current: 'Vigente', insufficient: 'Insuficiente', pending: 'Pendiente' });
    expect(verificationLabel(verification({ status: 'insufficient' }))).toBe('Insuficiente');
  });

  it('un recurso todavía sin verificar se muestra como pendiente de comprobar', () => {
    expect(verificationLabel(null)).toBe('Sin comprobar');
  });

  it('ofrece reintentar solo si la comprobación está pendiente y la copia está completa (REV-C3)', () => {
    expect(verificationAction(verification({ status: 'pending', retryAvailable: true }))).toBe('retry');
  });

  it('sin copia completa no ofrece reintentar: indica regenerar el recurso (REV-C3, REV-C11)', () => {
    expect(verificationAction(verification({ status: 'pending', retryAvailable: false }))).toBe('regenerate');
  });

  it('un respaldo insuficiente se corrige editando el texto o regenerando, no reintentando', () => {
    expect(verificationAction(verification({ status: 'insufficient', reason: 'Sin respaldo.' }))).toBe('edit-or-regenerate');
  });

  it('una verificación vigente o ausente no pide ninguna acción', () => {
    expect(verificationAction(verification())).toBeNull();
    expect(verificationAction(null)).toBeNull();
  });
});
