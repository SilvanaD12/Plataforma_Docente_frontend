import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Resource } from '../model/resource';
import { ResourceCard } from './ResourceCard';

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1',
    unitId: 'unidad-1',
    outcomeId: null,
    stage: 'explain',
    type: 'glosario',
    title: 'Glosario de capa de transporte',
    body: 'TCP es orientado a conexión.',
    options: null,
    citations: [],
    status: 'pendiente',
    edited: false,
    discardReason: null,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: null,
    decidedAt: null,
    evidence: [],
    version: 1,
    verification: {
      status: 'current',
      reason: null,
      fingerprint: 'sha256:' + 'a'.repeat(64),
      verifiedVersion: 1,
      evidenceThreshold: 0.6,
      ruleVersion: 1,
      checkedAt: '2026-11-20T10:00:00Z',
      retryAvailable: false,
      summary: {},
    },
    approvalBlockers: [],
    ...overrides,
  };
}

const noop = async () => makeResource();

describe('ResourceCard', () => {
  it('cerrada muestra solo la cabecera compacta sin montar el editor', () => {
    const html = renderToStaticMarkup(
      <ResourceCard
        resource={makeResource({ status: 'aprobado' })}
        isOpen={false}
        onToggle={() => {}}
        onSave={noop}
        onReload={noop}
        onRetry={noop}
      />,
    );
    expect(html).toContain('Glosario de capa de transporte');
    expect(html).toContain('Glosario');
    expect(html).toContain('Explicar');
    expect(html).toContain('Respaldo: Vigente');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="rec-1-panel"');
    expect(html).not.toContain('Guardar cambios');
    expect(html).not.toContain('Fuentes citadas');
  });

  it('abierta muestra el editor y la sección Fuentes citadas', () => {
    const html = renderToStaticMarkup(
      <ResourceCard
        resource={makeResource()}
        isOpen={true}
        onToggle={() => {}}
        onSave={noop}
        onReload={noop}
        onRetry={noop}
      />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Guardar cambios');
    expect(html).toContain('Fuentes citadas (0)');
  });

  it('en descartados muestra el motivo en la cabecera y con cambios sin guardar muestra el aviso', () => {
    const html = renderToStaticMarkup(
      <ResourceCard
        resource={makeResource({ status: 'descartado', discardReason: 'duplicado' })}
        isOpen={true}
        isDirty={true}
        closeBlockedWarning={true}
        onToggle={() => {}}
        onSave={noop}
        onReload={noop}
        onRetry={noop}
      />,
    );
    expect(html).toContain('Repite otro recurso');
    expect(html).toContain('Cambios sin guardar');
    expect(html).toContain('Guárdalos antes de cerrar la tarjeta.');
  });
});
