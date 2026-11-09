import { describe, expect, it } from 'vitest';
import type { VerificationResult } from './resource';
import { verificationView } from './verificationView';

function verification(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    status: 'current', reason: null, fingerprint: 'sha256:' + 'a'.repeat(64), verifiedVersion: 1,
    evidenceThreshold: 0.6, ruleVersion: 1, checkedAt: '2026-11-08T15:00:00+00:00', retryAvailable: false, summary: {},
    ...overrides,
  };
}

describe('qué muestra la insignia de verificación', () => {
  it('vigente: solo el estado, sin motivo ni acción', () => {
    expect(verificationView(verification())).toEqual({
      label: 'Vigente', tone: 'ok', reason: null, retryLabel: null, hint: null,
    });
  });

  it('pendiente con copia completa: motivo y «Reintentar comprobación» (REV-C3)', () => {
    expect(verificationView(verification({ status: 'pending', reason: 'No se pudo completar.', retryAvailable: true }))).toEqual({
      label: 'Pendiente', tone: 'warning', reason: 'No se pudo completar.', retryLabel: 'Reintentar comprobación', hint: null,
    });
  });

  it('pendiente sin copia completa: no ofrece reintentar e indica regenerar (REV-C3, REV-C11)', () => {
    const view = verificationView(verification({ status: 'pending', reason: 'Falta la copia histórica.', retryAvailable: false }));
    expect(view.retryLabel).toBeNull();
    expect(view.hint).toBe('Regenera el recurso para poder verificarlo.');
    expect(view.tone).toBe('blocked');
  });

  it('insuficiente: motivo y sugerencia de corregir el texto o regenerar', () => {
    const view = verificationView(verification({ status: 'insufficient', reason: 'Sin respaldo en el material.' }));
    expect(view).toMatchObject({ label: 'Insuficiente', tone: 'blocked', reason: 'Sin respaldo en el material.', retryLabel: null });
    expect(view.hint).toBe('Corrige el texto o regenera el recurso.');
  });

  it('sin verificación todavía: se comprobará al guardar', () => {
    expect(verificationView(null)).toEqual({
      label: 'Sin comprobar', tone: 'unknown', reason: null, retryLabel: null, hint: 'Se comprueba al guardar el recurso.',
    });
  });
});
