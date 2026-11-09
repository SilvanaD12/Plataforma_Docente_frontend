import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Resource } from '../model/resource';
import {
  getResource,
  isVersionConflict,
  listResources,
  regenerateMedia,
  retryVerification,
  reviewBody,
  saveResource,
} from './reviewApi';

afterEach(() => vi.unstubAllGlobals());

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'rec-1',
    unitId: 'unidad-1',
    outcomeId: 'ra-1',
    stage: 'evaluate',
    type: 'item_opcion_multiple',
    title: 'TCP o UDP',
    body: '¿Qué protocolo confirma la entrega?',
    bodyHtml: null,
    format: 'text',
    structure: null,
    media: null,
    options: [
      { id: 'rec-1:a', text: 'TCP', isCorrect: true, feedback: 'Correcto.', sourceFragmentIds: ['f1'], decision: 'pendiente',
        discardReason: null, edited: false },
      { id: 'rec-1:b', text: 'UDP', isCorrect: false, feedback: 'No.', sourceFragmentIds: ['f1'], decision: 'aceptado',
        discardReason: null, edited: true, reliabilityWarning: null },
    ],
    citations: [{ claim: 'TCP confirma la entrega.', fragmentIds: ['f1'] }],
    status: 'pendiente',
    edited: true,
    discardReason: null,
    createdAt: '2026-11-08T15:00:00+00:00',
    updatedAt: '2026-11-08T15:00:00+00:00',
    decidedAt: null,
    evidence: [],
    version: 3,
    verification: null,
    approvalBlockers: [],
    ...overrides,
  };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init?.headers) };
}

describe('API de revisión', () => {
  it('lista los recursos de la unidad con el token de la sesión', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([resource()]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listResources('token-docente', 'unidad-1')).resolves.toHaveLength(1);
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/units/unidad-1/resources');
    expect(call.method).toBe('GET');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });

  it('guarda enviando la versión de la que parte la edición (REV-R12)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ...resource(), version: 4, reviewReset: false }));
    vi.stubGlobal('fetch', fetchMock);

    const saved = await saveResource('token-docente', resource());
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/units/unidad-1/resources/rec-1');
    expect(call.method).toBe('PUT');
    expect(call.body.expectedVersion).toBe(3);
    expect(saved.version).toBe(4);
  });

  it('envía solo lo editable de la revisión, sin los datos que calcula el servidor', () => {
    const body = reviewBody(resource({ status: 'descartado', discardReason: 'sin_sentido' }));
    expect(body).toMatchObject({ expectedVersion: 3, status: 'descartado', discardReason: 'sin_sentido', edited: true });
    expect(body.options?.[1]).toEqual({ id: 'rec-1:b', text: 'UDP', feedback: 'No.', decision: 'aceptado', discardReason: null, edited: true });
    expect(body).not.toHaveProperty('verification');
    expect(body).not.toHaveProperty('approvalBlockers');
    expect(reviewBody(resource({ status: 'pendiente', discardReason: 'sin_sentido' })).discardReason).toBeNull();
    expect(reviewBody(resource({ options: null })).options).toBeNull();
  });

  it('expone el aviso de que un recurso aprobado volvió a revisión (REV-C1)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ ...resource({ status: 'pendiente' }), version: 4, reviewReset: true }),
    ));

    await expect(saveResource('token-docente', resource({ status: 'aprobado' }))).resolves.toMatchObject({ reviewReset: true });
  });

  it('reconoce el conflicto de versión para pedir recargar el recurso (REV-C14)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(
      { error: { code: 'VERSION_CONFLICT', message: 'El recurso cambió en otra pestaña. Recárgalo antes de guardar.' } },
      { status: 409 },
    )));

    const error = await saveResource('token-docente', resource()).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
    expect(isVersionConflict(error)).toBe(true);
  });

  it('una aprobación bloqueada también es 409, pero no es un conflicto de versión', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(
      { error: { code: 'APPROVAL_BLOCKED', message: 'El respaldo es insuficiente.' } }, { status: 409 },
    )));

    const error = await saveResource('token-docente', resource({ status: 'aprobado' })).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: 'APPROVAL_BLOCKED', message: 'El respaldo es insuficiente.' });
    expect(isVersionConflict(error)).toBe(false);
  });

  it('recarga un recurso desde la lista de su unidad', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([resource({ id: 'otro' }), resource({ version: 9 })])));

    await expect(getResource('token-docente', 'unidad-1', 'rec-1')).resolves.toMatchObject({ id: 'rec-1', version: 9 });
  });

  it('reintenta la comprobación con la versión leída (REV-C3)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(resource()));
    vi.stubGlobal('fetch', fetchMock);

    await retryVerification('token-docente', resource());
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/units/unidad-1/resources/rec-1/verification');
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ expectedVersion: 3 });
  });

  it('genera de nuevo la imagen o el audio con lo guardado (REV-C8)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(resource()));
    vi.stubGlobal('fetch', fetchMock);

    await regenerateMedia('token-docente', resource());
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/units/unidad-1/resources/rec-1/media');
    expect(call.method).toBe('POST');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });
});
