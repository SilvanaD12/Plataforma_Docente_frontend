import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { Resource } from './resource';
import { afterSaveFailure, editDraft, startEditing, startRequest } from './reviewEditor';
import { canRegenerate, regenerationHint, regenerationNotice } from './regenerationView';

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1', unitId: 'unidad-1', outcomeId: null, stage: 'explain', type: 'explicacion', title: 'TCP',
    body: 'TCP confirma la entrega.', bodyHtml: null, format: 'text', structure: null, media: null, options: null,
    citations: [], status: 'pendiente', edited: false, discardReason: null, createdAt: '2026-11-08T15:00:00+00:00',
    updatedAt: null, decidedAt: null, evidence: [], version: 3, verification: null, approvalBlockers: [], ...overrides,
  };
}

describe('cuándo se ofrece regenerar (REV-C12)', () => {
  it('en un recurso pendiente o aprobado, sin cambios sin guardar', () => {
    expect(canRegenerate(startEditing(resource()))).toBe(true);
    expect(canRegenerate(startEditing(resource({ status: 'aprobado' })))).toBe(true);
    expect(regenerationHint(startEditing(resource()))).toBeNull();
  });

  it('con cambios sin guardar no se ofrece, porque se regenera desde lo guardado', () => {
    const state = editDraft(startEditing(resource()), { body: 'Texto nuevo.' });
    expect(canRegenerate(state)).toBe(false);
    expect(regenerationHint(state)).toBe('Guarda o deshaz tus cambios antes de regenerar el recurso.');
  });

  it('no en uno descartado, ni con una solicitud en curso o un conflicto de versión', () => {
    expect(canRegenerate(startEditing(resource({ status: 'descartado', discardReason: 'regenerado' })))).toBe(false);
    expect(canRegenerate(startRequest(startEditing(resource())))).toBe(false);
    const conflicted = afterSaveFailure(startEditing(resource()), new ApiError(409, 'Conflicto.', 'VERSION_CONFLICT'));
    expect(canRegenerate(conflicted)).toBe(false);
  });
});

describe('resultado de regenerar', () => {
  it('si el anterior seguía en la misma versión, pasó a Descartados', () => {
    expect(regenerationNotice({ previousResourceId: 'rec-1', previousDiscarded: true, newResourceIds: ['rec-2'], status: 'succeeded' }))
      .toBe('Se generó un recurso nuevo para revisar. El anterior pasó a Descartados con el motivo «regenerado».');
  });

  it('si el anterior cambió mientras tanto, quedan los dos en Revisión', () => {
    expect(regenerationNotice({ previousResourceId: 'rec-1', previousDiscarded: false, newResourceIds: ['rec-2'], status: 'succeeded' }))
      .toBe('Se generó un recurso nuevo para revisar. El anterior cambió mientras tanto, así que se conservan los dos: elige con cuál te quedas.');
  });

  it('si la misma regeneración sigue en curso, lo dice', () => {
    expect(regenerationNotice({ previousResourceId: 'rec-1', previousDiscarded: false, newResourceIds: [], status: 'running' }))
      .toBe('La regeneración de este recurso sigue en curso. Vuelve a cargar la revisión en unos momentos.');
  });
});

describe('si la regeneración falla (REV-C13)', () => {
  it('muestra el motivo de Generación y conserva el recurso como estaba', () => {
    const start = startRequest(startEditing(resource()));
    const failed = afterSaveFailure(start, new ApiError(409, 'Procesa primero un documento de la unidad.', 'NO_PROCESSED_MATERIAL'));
    expect(failed).toMatchObject({ error: 'Procesa primero un documento de la unidad.', conflict: false, pending: false });
    expect(failed.saved).toEqual(start.saved);
    expect(canRegenerate(failed)).toBe(true);
  });

  it('un conflicto de versión pide recargar', () => {
    const failed = afterSaveFailure(startEditing(resource()), new ApiError(409, 'Conflicto.', 'VERSION_CONFLICT'));
    expect(failed.conflict).toBe(true);
  });
});
