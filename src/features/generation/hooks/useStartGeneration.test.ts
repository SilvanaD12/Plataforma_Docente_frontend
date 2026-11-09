import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { GenerationRequestStatus, StartGenerationRequest } from '../model/generationRequest';
import type { GenerationStorage, StoredGeneration } from './generationStorage';
import { newIdempotencyKey, prepareAttempt, submitGeneration } from './useStartGeneration';

const payload: StartGenerationRequest = { mode: 'sequence', unitId: 'unidad-1', resourceTypes: ['glosario'], quantity: 1, outcomeId: null };
const created = { request: { id: 'gen-req-1', status: 'queued' } as GenerationRequestStatus, created: true };

function memoryStorage(initial: StoredGeneration | null = null): GenerationStorage & { entry: StoredGeneration | null } {
  const storage = {
    entry: initial,
    read: () => storage.entry,
    save: (_unitId: string, entry: StoredGeneration) => { storage.entry = entry; },
    clear: () => { storage.entry = null; },
  };
  return storage;
}

function keys() {
  let next = 0;
  return () => 'clave-nueva-' + ++next;
}

describe('Clave de idempotencia', () => {
  it('reutiliza la clave solo para el mismo cuerpo sin respuesta confirmada', () => {
    const pending = { key: 'clave-guardada', payload, requestId: null };
    expect(prepareAttempt(pending, payload, false, keys())).toBe(pending);
    expect(prepareAttempt(pending, { ...payload, quantity: 2 }, false, keys()).key).toBe('clave-nueva-1');
    expect(prepareAttempt({ ...pending, requestId: 'gen-req-1' }, payload, false, keys()).key).toBe('clave-nueva-1');
    expect(prepareAttempt(pending, payload, true, keys()).key).toBe('clave-nueva-1');
    expect(prepareAttempt(null, payload, false, keys())).toEqual({ key: 'clave-nueva-1', payload, requestId: null });
  });

  it('crea claves que cumplen el formato del contrato', () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });
});

describe('Envío del pedido', () => {
  it('guarda la clave y el cuerpo antes de enviar y el requestId al confirmar', async () => {
    const storage = memoryStorage();
    const send = vi.fn(async () => {
      expect(storage.entry).toEqual({ key: 'clave-nueva-1', payload, requestId: null });
      return created;
    });

    await expect(submitGeneration({ unitId: 'unidad-1', token: 't', payload, send, storage, newKey: keys() })).resolves.toBe(created);
    expect(send).toHaveBeenCalledWith('t', 'clave-nueva-1', payload);
    expect(storage.entry).toEqual({ key: 'clave-nueva-1', payload, requestId: 'gen-req-1' });
  });

  it('reintenta con la misma clave si falla la red', async () => {
    const storage = memoryStorage();
    const send = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(created);
    const wait = vi.fn(async () => undefined);

    await submitGeneration({ unitId: 'unidad-1', token: 't', payload, send, storage, newKey: keys(), wait, retryDelays: [10, 20] });
    expect(send.mock.calls.map(([, key]) => key)).toEqual(['clave-nueva-1', 'clave-nueva-1', 'clave-nueva-1']);
    expect(wait.mock.calls).toEqual([[10], [20]]);
  });

  it('tras agotar los reintentos conserva la clave para reenviarla sin duplicar', async () => {
    const storage = memoryStorage();
    const send = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const options = { unitId: 'unidad-1', token: 't', payload, storage, newKey: keys(), wait: async () => undefined, retryDelays: [0] };

    await expect(submitGeneration({ ...options, send })).rejects.toBeInstanceOf(TypeError);
    expect(send).toHaveBeenCalledTimes(2);
    expect(storage.entry).toEqual({ key: 'clave-nueva-1', payload, requestId: null });

    const resend = vi.fn().mockResolvedValueOnce({ ...created, created: false });
    await submitGeneration({ ...options, send: resend });
    expect(resend).toHaveBeenCalledWith('t', 'clave-nueva-1', payload);
  });

  it('no reintenta los errores del servidor', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(429, 'Ya tienes 2 pedidos en curso.'));
    const wait = vi.fn(async () => undefined);

    await expect(submitGeneration({ unitId: 'unidad-1', token: 't', payload, send, storage: memoryStorage(), newKey: keys(), wait }))
      .rejects.toMatchObject({ status: 429 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('con fresh usa otra clave aunque el cuerpo sea el mismo (tras un 409)', async () => {
    const storage = memoryStorage({ key: 'clave-reutilizada', payload, requestId: null });
    const send = vi.fn().mockResolvedValueOnce(created);

    await submitGeneration({ unitId: 'unidad-1', token: 't', payload, fresh: true, send, storage, newKey: keys() });
    expect(send).toHaveBeenCalledWith('t', 'clave-nueva-1', payload);
  });
});
