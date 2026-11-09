import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { GenerationRequestStatus, GenerationRequestSummary, RequestStatus } from '../model/generationRequest';
import type { GenerationStorage, StoredGeneration } from './generationStorage';
import { abortableWait, nextPollDelay, pollGeneration, recoverRequest } from './useGenerationRequest';

const status = (value: RequestStatus) => ({ id: 'gen-req-1', status: value, steps: [] }) as unknown as GenerationRequestStatus;

function poll(load: (id: string) => Promise<GenerationRequestStatus>, initial: GenerationRequestStatus | null = null) {
  const controller = new AbortController();
  const waits: number[] = [];
  const updates: RequestStatus[] = [];
  const transient: unknown[] = [];
  const done = pollGeneration({
    requestId: 'gen-req-1', initial, load, signal: controller.signal,
    onUpdate: (current) => updates.push(current.status),
    onTransientError: (cause) => transient.push(cause),
    wait: async (ms) => { waits.push(ms); },
  });
  return { controller, waits, updates, transient, done };
}

describe('Consulta periódica', () => {
  it('espera 2 s y crece hasta 10 s', () => {
    const delays = [2000];
    while (delays.length < 7) delays.push(nextPollDelay(delays[delays.length - 1]));
    expect(delays).toEqual([2000, 3000, 4500, 6750, 10000, 10000, 10000]);
  });

  it('se detiene al llegar a un estado final', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(status('running'))
      .mockResolvedValueOnce(status('running'))
      .mockResolvedValueOnce(status('partially_succeeded'));
    const run = poll(load);

    await run.done;
    expect(run.updates).toEqual(['running', 'running', 'partially_succeeded']);
    expect(run.waits).toEqual([2000, 3000]);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('con el estado del POST espera antes de la primera consulta, y no consulta si ya terminó', async () => {
    const load = vi.fn().mockResolvedValueOnce(status('succeeded'));
    const run = poll(load, status('queued'));
    await run.done;
    expect(run.waits).toEqual([2000]);
    expect(load).toHaveBeenCalledTimes(1);

    const finished = vi.fn();
    await poll(finished, status('failed')).done;
    expect(finished).not.toHaveBeenCalled();
  });

  it('se detiene al desmontar, aunque una consulta esté en curso', async () => {
    let resolveLoad: (value: GenerationRequestStatus) => void = () => undefined;
    const load = vi.fn(() => new Promise<GenerationRequestStatus>((resolve) => { resolveLoad = resolve; }));
    const run = poll(load);

    run.controller.abort();
    resolveLoad(status('running'));
    await run.done;
    expect(run.updates).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('la espera termina en cuanto se aborta la señal', async () => {
    const controller = new AbortController();
    const waiting = abortableWait(60_000, controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBeUndefined();
  });

  it('sigue consultando ante fallos de red y se detiene con 404 o 401', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(503, 'No disponible.'))
      .mockResolvedValueOnce(status('succeeded'));
    const run = poll(load);
    await run.done;
    expect(run.transient).toHaveLength(2);
    expect(run.updates).toEqual(['succeeded']);

    await expect(poll(vi.fn().mockRejectedValue(new ApiError(404, 'No encontrado.'))).done).rejects.toMatchObject({ status: 404 });
    await expect(poll(vi.fn().mockRejectedValue(new ApiError(401, 'Sesión vencida.'))).done).rejects.toMatchObject({ status: 401 });
  });
});

describe('Recuperación al recargar', () => {
  const payload = { mode: 'individual' as const, unitId: 'unidad-1', resourceTypes: ['glosario'] };
  const ownRequest = { id: 'gen-req-propio', status: 'running', steps: [] } as unknown as GenerationRequestStatus;
  const otherActive = { id: 'gen-req-otro-activo' } as GenerationRequestSummary;

  function memoryStorage(initial: StoredGeneration | null): GenerationStorage & { entry: StoredGeneration | null } {
    const storage = {
      entry: initial,
      read: () => storage.entry,
      save: (_unitId: string, entry: StoredGeneration) => { storage.entry = entry; },
      clear: () => { storage.entry = null; },
    };
    return storage;
  }

  it('usa el requestId guardado sin reenviar ni consultar la lista', async () => {
    const resend = vi.fn();
    const listActive = vi.fn();
    const storage = memoryStorage({ key: 'k-12345678', payload, requestId: 'gen-req-guardado' });

    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend, listActive }))
      .resolves.toEqual({ requestId: 'gen-req-guardado', initial: null });
    expect(resend).not.toHaveBeenCalled();
    expect(listActive).not.toHaveBeenCalled();
  });

  it('un envío sin respuesta recupera su propio pedido con la clave original aunque haya otro activo', async () => {
    const storage = memoryStorage({ key: 'clave-original', payload, requestId: null });
    const resend = vi.fn().mockResolvedValueOnce({ request: ownRequest, created: false });
    const listActive = vi.fn().mockResolvedValue([otherActive]);

    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend, listActive }))
      .resolves.toEqual({ requestId: 'gen-req-propio', initial: ownRequest });
    expect(resend).toHaveBeenCalledWith('clave-original', payload);
    expect(listActive).not.toHaveBeenCalled();
    expect(storage.entry).toEqual({ key: 'clave-original', payload, requestId: 'gen-req-propio' });
  });

  it('si el reenvío crea el pedido (202), también lo vincula a la clave original', async () => {
    const storage = memoryStorage({ key: 'clave-original', payload, requestId: null });
    const resend = vi.fn().mockResolvedValueOnce({ request: ownRequest, created: true });

    await recoverRequest({ unitId: 'unidad-1', storage, resend, listActive: vi.fn() });
    expect(storage.entry?.requestId).toBe('gen-req-propio');
  });

  it('con 409 IDEMPOTENCY_KEY_REUSED limpia lo guardado, propaga el mensaje y no vincula otro pedido', async () => {
    const storage = memoryStorage({ key: 'clave-original', payload, requestId: null });
    const conflict = new ApiError(409, 'Esta clave ya se usó con otros datos.', 'IDEMPOTENCY_KEY_REUSED');
    const listActive = vi.fn().mockResolvedValue([otherActive]);

    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend: vi.fn().mockRejectedValueOnce(conflict), listActive }))
      .rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED', message: 'Esta clave ya se usó con otros datos.' });
    expect(storage.entry).toBeNull();
    expect(listActive).not.toHaveBeenCalled();
  });

  it('con 400 NO_PROCESSED_MATERIAL limpia lo guardado y propaga el mensaje del servidor', async () => {
    const storage = memoryStorage({ key: 'clave-original', payload, requestId: null });
    const noMaterial = new ApiError(400, 'La unidad no tiene material procesado.', 'NO_PROCESSED_MATERIAL');
    const listActive = vi.fn().mockResolvedValue([otherActive]);

    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend: vi.fn().mockRejectedValueOnce(noMaterial), listActive }))
      .rejects.toMatchObject({ status: 400, code: 'NO_PROCESSED_MATERIAL', message: 'La unidad no tiene material procesado.' });
    expect(storage.entry).toBeNull();
    expect(listActive).not.toHaveBeenCalled();
  });

  it('limpia lo guardado ante otros rechazos definitivos (404, 422)', async () => {
    for (const rejection of [new ApiError(404, 'La unidad no existe.', 'UNIT_NOT_FOUND'), new ApiError(422, 'Parámetros no válidos.')]) {
      const storage = memoryStorage({ key: 'clave-original', payload, requestId: null });
      await expect(recoverRequest({ unitId: 'unidad-1', storage, resend: vi.fn().mockRejectedValueOnce(rejection), listActive: vi.fn() }))
        .rejects.toBe(rejection);
      expect(storage.entry).toBeNull();
    }
  });

  it('conserva la clave ante un fallo de red, un 5xx, un 429 o una sesión vencida', async () => {
    const failures = [
      new TypeError('Failed to fetch'),
      new ApiError(503, 'Material no respondió.', 'EVIDENCE_UNAVAILABLE'),
      new ApiError(429, 'Ya tienes 2 pedidos en curso.', 'TOO_MANY_ACTIVE_REQUESTS'),
      new ApiError(401, 'La sesión venció.', 'UNAUTHORIZED'),
    ];
    for (const failure of failures) {
      const entry = { key: 'clave-original', payload, requestId: null };
      const storage = memoryStorage(entry);
      const listActive = vi.fn();

      await expect(recoverRequest({ unitId: 'unidad-1', storage, resend: vi.fn().mockRejectedValueOnce(failure), listActive }))
        .rejects.toBe(failure);
      expect(storage.entry).toEqual(entry);
      expect(listActive).not.toHaveBeenCalled();
    }
  });

  it('sin nada guardado usa el pedido activo más reciente, o ninguno', async () => {
    const resend = vi.fn();
    const storage = memoryStorage(null);

    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend, listActive: async () => [otherActive] }))
      .resolves.toEqual({ requestId: 'gen-req-otro-activo', initial: null });
    expect(storage.entry).toBeNull();
    await expect(recoverRequest({ unitId: 'unidad-1', storage, resend, listActive: async () => [] })).resolves.toBeNull();
    expect(resend).not.toHaveBeenCalled();
  });
});
