import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { DistractorDecision, Resource } from './resource';
import {
  CONFLICT_MESSAGE,
  RESET_NOTICE,
  RETRY_NEEDS_SAVE,
  afterSaveFailure,
  afterRetrySuccess,
  afterSaveSuccess,
  approvalHint,
  canApprove,
  canEdit,
  canRetry,
  canSave,
  distractorProblem,
  editDraft,
  editOption,
  isDirty,
  reloadLatest,
  retryHint,
  startEditing,
  startRequest,
  withStatus,
} from './reviewEditor';
import { reviewBody } from '../api/reviewApi';

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
  /** Un ítem con la clave y tres distractores, con las decisiones indicadas. */
  const item = (decisions: DistractorDecision[], overrides: Partial<Resource> = {}) => resource({
    options: [
      resource().options![0],
      ...decisions.map((decision, index) => ({
        id: `d${index}`, text: `Distractor ${index}`, isCorrect: false, feedback: '', sourceFragmentIds: [],
        decision, discardReason: null, edited: false,
      })),
    ],
    ...overrides,
  });

  it('1 aceptado y 2 por decidir: no se ofrece aprobar', () => {
    const state = startEditing(item(['aceptado', 'pendiente', 'pendiente']));
    expect(distractorProblem(state.draft)).toBe('Decide los 2 distractores pendientes para poder aprobar.');
    expect(canApprove(state)).toBe(false);
  });

  it('1 aceptado y 2 descartados: no se ofrece aprobar', () => {
    const state = startEditing(item(['aceptado', 'descartado', 'descartado']));
    expect(distractorProblem(state.draft)).toBe('Acepta al menos 2 distractores para poder aprobar.');
    expect(canApprove(state)).toBe(false);
  });

  it('2 aceptados: se ofrece aprobar', () => {
    const state = startEditing(item(['aceptado', 'aceptado', 'descartado']));
    expect(distractorProblem(state.draft)).toBeNull();
    expect(canApprove(state)).toBe(true);
  });

  it('el aviso junto al botón cambia a medida que el docente decide', () => {
    let state = startEditing(item(['pendiente', 'pendiente', 'pendiente']));
    expect(approvalHint(state)).toBe('Decide los 3 distractores pendientes para poder aprobar.');
    state = editOption(state, 'd0', { decision: 'aceptado' });
    state = editOption(state, 'd1', { decision: 'descartado' });
    expect(approvalHint(state)).toBe('Decide el distractor pendiente para poder aprobar.');
    state = editOption(state, 'd2', { decision: 'descartado' });
    expect(approvalHint(state)).toBe('Acepta al menos 2 distractores para poder aprobar.');
    state = editOption(state, 'd2', { decision: 'aceptado' });
    expect(approvalHint(state)).toBeNull();
    expect(canApprove(state)).toBe(true);
  });

  it('sin cambios, además hace falta que el servidor no informe bloqueos', () => {
    expect(canApprove(startEditing(item(['aceptado', 'aceptado', 'descartado'], { approvalBlockers: ['El respaldo es insuficiente.'] })))).toBe(false);
  });

  it('con cambios sin guardar se puede intentar: el servidor verifica la versión editada antes de aprobar', () => {
    const base = item(['aceptado', 'aceptado', 'descartado'], { approvalBlockers: ['El respaldo es insuficiente.'] });
    expect(canApprove(editDraft(startEditing(base), { body: 'Corregido.' }))).toBe(true);
  });

  it('un recurso sin alternativas no tiene regla de distractores', () => {
    expect(distractorProblem(resource({ options: null }))).toBeNull();
    expect(canApprove(startEditing(resource({ options: null })))).toBe(true);
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

describe('mientras una solicitud está en curso', () => {
  it('no se edita ni se vuelve a guardar o aprobar hasta que responda el servidor', () => {
    const state = startRequest(editDraft(startEditing(resource()), { title: 'Antes de guardar' }));
    expect(state.pending).toBe(true);
    expect(canEdit(state)).toBe(false);
    expect(canSave(state)).toBe(false);
    expect(canApprove({ ...state, draft: { ...state.draft, options: null } })).toBe(false);
  });

  it('lo que se intente escribir durante la solicitud no cambia el borrador', () => {
    const state = startRequest(editDraft(startEditing(resource()), { title: 'Antes de guardar' }));
    expect(editDraft(state, { title: 'Escrito durante el guardado' })).toBe(state);
    expect(editOption(state, 'b', { decision: 'aceptado' })).toBe(state);
  });

  it('al responder, bien o mal, se vuelve a poder editar', () => {
    const pending = startRequest(editDraft(startEditing(resource()), { title: 'Otro' }));
    expect(canEdit(afterSaveSuccess(pending, resource({ title: 'Otro', version: 3 })))).toBe(true);
    expect(canEdit(afterSaveFailure(pending, new Error('red')))).toBe(true);
    expect(canEdit(reloadLatest(pending, resource({ version: 5 })))).toBe(true);
  });
});

describe('texto con formato (bodyHtml)', () => {
  const formatted = () => resource({ bodyHtml: '<p><strong>¿Qué protocolo</strong> confirma la entrega?</p>' });

  it('al cambiar el cuerpo no se envía el HTML viejo, para que el servidor use el cuerpo nuevo', () => {
    const state = editDraft(startEditing(formatted()), { body: 'Nuevo enunciado.' });
    expect(state.draft.bodyHtml).toBeUndefined();
    expect(reviewBody(state.draft)).not.toHaveProperty('bodyHtml');
  });

  it('si no cambia el cuerpo, se conserva el formato', () => {
    const state = editDraft(startEditing(formatted()), { title: 'Otro título' });
    expect(reviewBody(state.draft).bodyHtml).toBe('<p><strong>¿Qué protocolo</strong> confirma la entrega?</p>');
  });

  it('si el docente vuelve al texto original, recupera el formato guardado', () => {
    const changed = editDraft(startEditing(formatted()), { body: 'Nuevo enunciado.' });
    const reverted = editDraft(changed, { body: '¿Qué protocolo confirma la entrega?' });
    expect(reverted.draft.bodyHtml).toBe(formatted().bodyHtml);
  });
});

describe('«Reintentar comprobación» con cambios sin guardar', () => {
  const pending = { status: 'pending', reason: 'No se pudo comprobar.', fingerprint: 'sha256:a', verifiedVersion: 2,
    evidenceThreshold: 0.6, ruleVersion: 1, checkedAt: '2026-11-08T15:00:00+00:00', retryAvailable: true, summary: {} } as const;
  const withPending = () => resource({ options: null, verification: pending });

  it('sin cambios se ofrece el reintento, sin aviso', () => {
    const state = startEditing(withPending());
    expect(canRetry(state)).toBe(true);
    expect(retryHint(state)).toBeNull();
  });

  it('con cambios queda desactivado y avisa que hay que guardar', () => {
    const state = editDraft(startEditing(withPending()), { body: 'Texto nuevo sin guardar.' });
    expect(canRetry(state)).toBe(false);
    expect(retryHint(state)).toBe(RETRY_NEEDS_SAVE);
    expect(RETRY_NEEDS_SAVE).toBe('Guarda los cambios para comprobar el texto nuevo.');
  });

  it('mientras hay una solicitud en curso no se reintenta', () => {
    expect(canRetry(startRequest(startEditing(withPending())))).toBe(false);
  });

  it('si el reintento termina mientras hay cambios, el borrador no se reemplaza', () => {
    const edited = startRequest(editDraft(startEditing(withPending()), { body: 'Texto nuevo sin guardar.' }));
    const checked = withPending();
    checked.verification = { ...pending, status: 'current', reason: null, retryAvailable: false };
    const state = afterRetrySuccess(edited, checked);
    expect(state.draft.body).toBe('Texto nuevo sin guardar.');
    expect(state.saved.verification?.status).toBe('current');
    expect(state.pending).toBe(false);
    expect(isDirty(state)).toBe(true);
  });

  it('sin cambios, el reintento toma el recurso del servidor como al guardar', () => {
    const checked = withPending();
    checked.verification = { ...pending, status: 'current', reason: null, retryAvailable: false };
    const state = afterRetrySuccess(startRequest(startEditing(withPending())), checked);
    expect(state.draft).toEqual(checked);
    expect(isDirty(state)).toBe(false);
  });
});
