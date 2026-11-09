import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { GenerationRequestStatus, GenerationRequestSummary, RequestStatus } from '../model/generationRequest';
import type { GenerationStorage, StoredGeneration } from './generationStorage';
import { abortableWait, nextPollDelay, pollGeneration, recoverRequestId } from './useGenerationRequest';

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
  const summary = { id: 'gen-req-activo' } as GenerationRequestSummary;

  function memoryStorage(initial: StoredGeneration | null): GenerationStorage & { entry: StoredGeneration | null } {
    const storage = {
      entry: initial,
      read: () => storage.entry,
      save: (_unitId: string, entry: StoredGeneration) => { storage.entry = entry; },
      clear: () => { storage.entry = null; },
    };
    return storage;
  }

  it('usa el requestId guardado sin consultar la lista', async () => {
    const list = vi.fn();
    const storage = memoryStorage({ key: 'k-12345678', payload, requestId: 'gen-req-guardado' });
    await expect(recoverRequestId('unidad-1', storage, list)).resolves.toBe('gen-req-guardado');
    expect(list).not.toHaveBeenCalled();
  });

  it('sin requestId, toma el pedido activo más reciente y lo asocia a la clave guardada', async () => {
    const storage = memoryStorage({ key: 'k-12345678', payload, requestId: null });
    await expect(recoverRequestId('unidad-1', storage, async () => [summary])).resolves.toBe('gen-req-activo');
    expect(storage.entry?.requestId).toBe('gen-req-activo');

    await expect(recoverRequestId('unidad-1', memoryStorage(null), async () => [])).resolves.toBeNull();
  });
});
