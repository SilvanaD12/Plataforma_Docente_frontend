import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { Resource } from './resource';
import {
  CONFLICT_MESSAGE,
  RESET_NOTICE,
  afterSaveFailure,
  afterSaveSuccess,
  canApprove,
  canSave,
  editDraft,
  editOption,
  isDirty,
  reloadLatest,
  startEditing,
  withStatus,
} from './reviewEditor';

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1', unitId: 'unidad-1', outcomeId: null, stage: 'evaluate', type: 'item_opcion_multiple',
    title: 'TCP o UDP', body: '¿Qué protocolo confirma la entrega?', bodyHtml: null, format: 'text', structure: null, media: null,
    options: [
      { id: 'a', text: 'TCP', isCorrect: true, feedback: '', sourceFragmentIds: [], decision: 'pendiente', discardReason: null, edited: false },
      { id: 'b', text: 'UDP', isCorrect: false, feedback: '', sourceFragmentIds: [], decision: 'pendiente', discardReason: null, edited: false },
    ],
    citations: [], status: 'pendiente', edited: false, discardReason: null, createdAt: '2026-11-08T15:00:00+00:00',
    updatedAt: null, decidedAt: null, evidence: [], version: 2, verification: null, approvalBlockers: [],
    ...overrides,
  };
}

describe('edición de un recurso', () => {
  it('editar el texto marca el borrador como editado sin tocar lo guardado', () => {
    const state = editDraft(startEditing(resource()), { body: 'Nuevo enunciado.' });
    expect(state.draft.body).toBe('Nuevo enunciado.');
    expect(state.draft.edited).toBe(true);
    expect(state.saved.body).toBe('¿Qué protocolo confirma la entrega?');
    expect(isDirty(state)).toBe(true);
    expect(isDirty(startEditing(resource()))).toBe(false);
  });

  it('cambiar el texto de una alternativa la marca como editada; cambiar solo la decisión no', () => {
    const decided = editOption(startEditing(resource()), 'b', { decision: 'aceptado' });
    expect(decided.draft.options?.[1]).toMatchObject({ decision: 'aceptado', edited: false });
    const rewritten = editOption(decided, 'b', { text: 'IP' });
    expect(rewritten.draft.options?.[1]).toMatchObject({ text: 'IP', edited: true });
  });

  it('aprobar o descartar cambia el estado del borrador', () => {
    expect(withStatus(resource(), 'aprobado')).toMatchObject({ status: 'aprobado', discardReason: null });
    expect(withStatus(resource(), 'descartado', 'sin_sentido')).toMatchObject({ status: 'descartado', discardReason: 'sin_sentido' });
  });
});

describe('cuándo se ofrece aprobar', () => {
  it('sin cambios, solo si el servidor no informa bloqueos', () => {
    expect(canApprove(startEditing(resource()))).toBe(true);
    expect(canApprove(startEditing(resource({ approvalBlockers: ['Decide el distractor pendiente para poder aprobar.'] })))).toBe(false);
  });

  it('con cambios sin guardar se puede intentar: el servidor verifica la versión editada antes de aprobar', () => {
    const state = editDraft(startEditing(resource({ approvalBlockers: ['El respaldo es insuficiente.'] })), { body: 'Corregido.' });
    expect(canApprove(state)).toBe(true);
  });

  it('durante un conflicto de versión no se aprueba', () => {
    const state = afterSaveFailure(startEditing(resource()), new ApiError(409, 'Conflicto.', 'VERSION_CONFLICT'));
    expect(canApprove(state)).toBe(false);
  });
});

describe('resultado de guardar', () => {
  it('al guardar se toma la versión nueva del servidor', () => {
    const state = afterSaveSuccess(editDraft(startEditing(resource()), { title: 'Otro' }), resource({ title: 'Otro', version: 3 }));
    expect(state.saved.version).toBe(3);
    expect(state.draft).toEqual(state.saved);
    expect(state).toMatchObject({ notice: null, error: null, conflict: false });
  });

  it('avisa si un recurso aprobado volvió a revisión por cambiar su contenido (REV-C1)', () => {
    const state = afterSaveSuccess(startEditing(resource({ status: 'aprobado' })), resource({ status: 'pendiente', reviewReset: true }));
    expect(state.notice).toBe(RESET_NOTICE);
  });

  it('un conflicto de versión conserva lo escrito y pide recargar (REV-C14)', () => {
    const edited = editDraft(startEditing(resource()), { body: 'Lo que escribí.' });
    const state = afterSaveFailure(edited, new ApiError(409, 'El recurso cambió en otra pestaña.', 'VERSION_CONFLICT'));
    expect(state.conflict).toBe(true);
    expect(state.error).toBe(CONFLICT_MESSAGE);
    expect(state.draft.body).toBe('Lo que escribí.');
    expect(canSave(state)).toBe(false);
  });

  it('una aprobación bloqueada muestra el motivo del servidor y conserva lo escrito', () => {
    const edited = editDraft(startEditing(resource()), { body: 'Lo que escribí.' });
    const state = afterSaveFailure(edited, new ApiError(409, 'El respaldo es insuficiente: sin respaldo.', 'APPROVAL_BLOCKED'));
    expect(state).toMatchObject({ conflict: false, error: 'El respaldo es insuficiente: sin respaldo.' });
    expect(state.draft.body).toBe('Lo que escribí.');
    expect(canSave(state)).toBe(true);
  });

  it('otro error muestra un mensaje y conserva lo escrito', () => {
    const state = afterSaveFailure(editDraft(startEditing(resource()), { title: 'Otro' }), new Error('red'));
    expect(state.error).toBe('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    expect(state.draft.title).toBe('Otro');
  });

  it('recargar después del conflicto toma la versión vigente y descarta el borrador', () => {
    const conflicted = afterSaveFailure(
      editDraft(startEditing(resource()), { body: 'Lo que escribí.' }),
      new ApiError(409, 'Conflicto.', 'VERSION_CONFLICT'),
    );
    const state = reloadLatest(conflicted, resource({ body: 'Versión de la otra pestaña.', version: 5 }));
    expect(state.draft).toEqual(state.saved);
    expect(state.saved).toMatchObject({ body: 'Versión de la otra pestaña.', version: 5 });
    expect(state).toMatchObject({ conflict: false, error: null });
  });
});
