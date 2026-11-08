import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VerificationResult } from '../model/resource';
import { VerificationBadge } from './VerificationBadge';

function verification(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    status: 'current', reason: null, fingerprint: 'sha256:' + 'a'.repeat(64), verifiedVersion: 1,
    evidenceThreshold: 0.6, ruleVersion: 1, checkedAt: '2026-11-08T15:00:00+00:00', retryAvailable: false, summary: {},
    ...overrides,
  };
}

const render = (value: VerificationResult | null) => renderToStaticMarkup(<VerificationBadge verification={value} onRetry={() => {}} />);

describe('insignia de verificación', () => {
  it('muestra el estado vigente sin botones', () => {
    const html = render(verification());
    expect(html).toContain('Vigente');
    expect(html).not.toContain('<button');
  });

  it('muestra el motivo y el botón para reintentar una comprobación pendiente', () => {
    const html = render(verification({ status: 'pending', reason: 'No se pudo completar.', retryAvailable: true }));
    expect(html).toContain('Pendiente');
    expect(html).toContain('No se pudo completar.');
    expect(html).toMatch(/<button[^>]*>Reintentar comprobación<\/button>/);
  });

  it('sin copia completa muestra el aviso de regenerar en lugar del botón', () => {
    const html = render(verification({ status: 'pending', reason: 'Falta la copia histórica.', retryAvailable: false }));
    expect(html).toContain('Regenera el recurso para poder verificarlo.');
    expect(html).not.toContain('<button');
  });

  it('un respaldo insuficiente se anuncia como alerta con su motivo', () => {
    const html = render(verification({ status: 'insufficient', reason: 'Sin respaldo en el material.' }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Insuficiente');
    expect(html).toContain('Sin respaldo en el material.');
  });

  it('no muestra textos de proveedores ni del modelo 5E', () => {
    const html = [verification(), verification({ status: 'pending', retryAvailable: true }), null].map(render).join('');
    expect(html).not.toMatch(/5E|Gemini|Wikipedia/);
  });
});
