import { describe, expect, it } from 'vitest';
import type { Resource, ResourceMedia } from './resource';
import { editDraft, startEditing, startRequest } from './reviewEditor';
import { GENERATION_FAILED, INVALIDATED_MESSAGE, afterMediaResult, canGenerateMedia, mediaView } from './mediaView';

function resource(media: ResourceMedia | null, overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1', unitId: 'unidad-1', outcomeId: null, stage: 'engage', type: 'audio_detonante', title: 'Audio',
    body: 'Escucha.', bodyHtml: null, format: 'audio', media,
    structure: { script: 'Hoy vamos a escuchar cómo viajan los datos por la red y por qué algunos llegan antes que otros.' },
    options: null, citations: [], status: 'pendiente', edited: true, discardReason: null,
    createdAt: '2026-11-08T15:00:00+00:00', updatedAt: null, decidedAt: null, evidence: [], version: 2, verification: null,
    approvalBlockers: [], ...overrides,
  };
}

const invalidated: ResourceMedia = { status: 'fallback', invalidated: true, note: 'Se editó el guion.' };

describe('multimedia invalidada (REV-C8)', () => {
  it('sin multimedia invalidada no hay aviso', () => {
    expect(mediaView(startEditing(resource({ status: 'ready', id: 'm1' })))).toBeNull();
    expect(mediaView(startEditing(resource(null)))).toBeNull();
  });

  it('avisa que el archivo ya no se usa y ofrece generarlo de nuevo', () => {
    const state = startEditing(resource(invalidated));
    expect(mediaView(state)).toEqual({ message: INVALIDATED_MESSAGE, actionLabel: 'Generar de nuevo', hint: null });
    expect(canGenerateMedia(state)).toBe(true);
  });

  it('con cambios sin guardar pide guardar primero, porque se genera con lo guardado', () => {
    const state = editDraft(startEditing(resource(invalidated)), { title: 'Otro título' });
    expect(canGenerateMedia(state)).toBe(false);
    expect(mediaView(state)?.hint).toBe('Guarda los cambios antes de generar el archivo.');
  });

  it('un recurso aprobado o descartado tiene que volver a revisión', () => {
    const state = startEditing(resource(invalidated, { status: 'descartado', discardReason: 'otro' }));
    expect(canGenerateMedia(state)).toBe(false);
    expect(mediaView(state)?.hint).toBe('Vuelve el recurso a revisión para generar el archivo.');
  });

  it('no se ofrece con una solicitud en curso', () => {
    expect(canGenerateMedia(startRequest(startEditing(resource(invalidated))))).toBe(false);
  });

  it('si se generó, toma el recurso nuevo y quita el aviso', () => {
    const state = afterMediaResult(startRequest(startEditing(resource(invalidated))), resource({ status: 'ready', id: 'm2' }));
    expect(state.saved.media?.status).toBe('ready');
    expect(state).toMatchObject({ error: null, pending: false });
    expect(mediaView(state)).toBeNull();
  });

  it('si el servicio no pudo generarlo, el aviso sigue y se informa', () => {
    const state = afterMediaResult(startRequest(startEditing(resource(invalidated))), resource(invalidated));
    expect(state.error).toBe(GENERATION_FAILED);
    expect(state.pending).toBe(false);
    expect(mediaView(state)?.message).toBe(INVALIDATED_MESSAGE);
  });
});
