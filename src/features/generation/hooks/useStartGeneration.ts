import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/httpClient';
import { startGenerationRequest } from '../api/generationApi';
import { generationError, isSessionExpired, type GenerationError } from '../model/generationErrors';
import type { GenerationRequestStatus, StartGenerationRequest } from '../model/generationRequest';
import { generationStorage, type GenerationStorage, type StoredGeneration } from './generationStorage';

/** Reintentos automáticos ante un fallo de red, con la misma clave. */
export const networkRetryDelays = [1000, 3000];

export function newIdempotencyKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID solo existe en contextos seguros; fuera de ellos se arma una clave equivalente.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const samePayload = (a: StartGenerationRequest, b: StartGenerationRequest) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Reutiliza la clave guardada solo si el envío anterior con el mismo cuerpo no recibió respuesta.
 * Con un pedido ya confirmado, otro cuerpo o `fresh`, crea una clave nueva.
 */
export function prepareAttempt(
  stored: StoredGeneration | null, payload: StartGenerationRequest, fresh: boolean, newKey: () => string,
): StoredGeneration {
  if (!fresh && stored && stored.requestId === null && samePayload(stored.payload, payload)) return stored;
  return { key: newKey(), payload, requestId: null };
}

interface SubmitOptions {
  unitId: string;
  token: string;
  payload: StartGenerationRequest;
  fresh?: boolean;
  send?: typeof startGenerationRequest;
  storage?: GenerationStorage;
  newKey?: () => string;
  wait?: (ms: number) => Promise<void>;
  retryDelays?: number[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Guarda la clave antes de enviar y reintenta con ella mientras falle la red. */
export async function submitGeneration({
  unitId, token, payload, fresh = false, send = startGenerationRequest, storage = generationStorage,
  newKey = newIdempotencyKey, wait = sleep, retryDelays = networkRetryDelays,
}: SubmitOptions) {
  const entry = prepareAttempt(storage.read(unitId), payload, fresh, newKey);
  storage.save(unitId, entry);

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await send(token, entry.key, payload);
      storage.save(unitId, { ...entry, requestId: result.request.id });
      return result;
    } catch (cause) {
      if (cause instanceof ApiError || attempt >= retryDelays.length) throw cause;
      await wait(retryDelays[attempt]);
    }
  }
}

interface UseStartGenerationOptions {
  unitId: string;
  token: string;
  onSessionExpired: (token: string) => void;
  onStarted: (request: GenerationRequestStatus, created: boolean) => void;
}

export function useStartGeneration({ unitId, token, onSessionExpired, onStarted }: UseStartGenerationOptions) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<GenerationError | null>(null);
  const lastPayload = useRef<StartGenerationRequest | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const start = useCallback(async (payload: StartGenerationRequest, fresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastPayload.current = payload;
    setSubmitting(true);
    setError(null);
    try {
      const { request, created } = await submitGeneration({ unitId, token, payload, fresh });
      if (mounted.current) onStarted(request, created);
    } catch (cause) {
      if (isSessionExpired(cause)) onSessionExpired(token);
      else if (mounted.current) setError(generationError(cause));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [unitId, token, onSessionExpired, onStarted]);

  /** Tras un fallo de red: reenvía el mismo cuerpo con la misma clave. */
  const retry = useCallback(() => {
    if (lastPayload.current) void start(lastPayload.current);
  }, [start]);

  /** Tras un 409: el mismo cuerpo como pedido nuevo, con otra clave. */
  const startFresh = useCallback(() => {
    if (lastPayload.current) void start(lastPayload.current, true);
  }, [start]);

  const clearError = useCallback(() => setError(null), []);

  return { submitting, error, start, retry, startFresh, clearError };
}
