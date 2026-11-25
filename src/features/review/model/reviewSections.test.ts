import { describe, expect, it } from 'vitest';
import type { Resource } from './resource';
import {
  REVIEW_SECTIONS,
  closeSectionCards,
  groupResourcesByStatus,
  isCardOpen,
  nextPendingFocusId,
} from './reviewSections';

function makeResource(id: string, overrides: Partial<Resource> = {}): Resource {
  return {
    id,
    unitId: 'unidad-1',
    outcomeId: null,
    stage: 'explain',
    type: 'explicacion',
    title: id,
    body: 'Contenido.',
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
    verification: null,
    approvalBlockers: [],
    ...overrides,
  };
}

describe('reviewSections', () => {
  it('define las tres secciones en orden con su apertura inicial correcta', () => {
    expect(REVIEW_SECTIONS.map((s) => [s.status, s.defaultOpen])).toEqual([
      ['pendiente', true],
      ['aprobado', false],
      ['descartado', false],
    ]);
  });

  it('agrupa por estado y ordena por etapa y luego por fecha de creación', () => {
    const resources = [
      makeResource('p-eval', { stage: 'evaluate', createdAt: '2026-11-20T08:00:00Z' }),
      makeResource('p-engage-late', { stage: 'engage', createdAt: '2026-11-20T12:00:00Z' }),
      makeResource('p-engage-early', { stage: 'engage', createdAt: '2026-11-20T09:00:00Z' }),
      makeResource('a-1', { status: 'aprobado', stage: 'explain' }),
      makeResource('d-1', { status: 'descartado', stage: 'explore', discardReason: 'duplicado' }),
    ];

    const grouped = groupResourcesByStatus(resources);
    expect(grouped.pendiente.map((r) => r.id)).toEqual(['p-engage-early', 'p-engage-late', 'p-eval']);
    expect(grouped.aprobado.map((r) => r.id)).toEqual(['a-1']);
    expect(grouped.descartado.map((r) => r.id)).toEqual(['d-1']);
  });

  it('abre por defecto solo las tarjetas pendientes', () => {
    expect(isCardOpen({}, makeResource('p', { status: 'pendiente' }))).toBe(true);
    expect(isCardOpen({}, makeResource('a', { status: 'aprobado' }))).toBe(false);
    expect(isCardOpen({}, makeResource('d', { status: 'descartado' }))).toBe(false);
  });

  it('elige el siguiente recurso pendiente tras aprobar o descartar', () => {
    const r1 = makeResource('r1');
    const r2 = makeResource('r2');
    const r3 = makeResource('r3');
    expect(nextPendingFocusId([r1, r2, r3], [r1, r3], 'r2')).toBe('r3');
    expect(nextPendingFocusId([r1, r3], [r1], 'r3')).toBe('r1');
    expect(nextPendingFocusId([r1], [], 'r1')).toBeNull();
  });

  it('closeSectionCards no pliega tarjetas con cambios sin guardar', () => {
    const r1 = makeResource('r1');
    const r2 = makeResource('r2');
    const { nextOpen, blockedIds } = closeSectionCards(
      [r1, r2],
      { r1: true, r2: true },
      { r2: true },
    );
    expect(nextOpen).toEqual({ r1: false, r2: true });
    expect(blockedIds).toEqual(['r2']);
  });
});
