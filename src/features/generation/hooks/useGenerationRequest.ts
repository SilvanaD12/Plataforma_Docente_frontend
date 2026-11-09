import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/httpClient';
import { getGenerationRequest, listGenerationRequests } from '../api/generationApi';
import { generationError, isSessionExpired, type GenerationError } from '../model/generationErrors';
import { isTerminal, type GenerationRequestStatus, type GenerationRequestSummary } from '../model/generationRequest';
import { generationStorage, type GenerationStorage } from './generationStorage';

export const firstPollDelay = 2000;
export const maxPollDelay = 10000;

/** 2 s, 3 s, 4,5 s, 6,75 s y luego 10 s. */
export function nextPollDelay(previous: number) {
  return Math.min(maxPollDelay, Math.round(previous * 1.5));
}

export function abortableWait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}

/** Errores que no se arreglan reintentando: sesión, pedido inexistente y otros 4xx salvo 429. */
function isFatal(cause: unknown) {
  return cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429;
}

interface PollOptions {
  requestId: string;
  /** Estado ya conocido (por ejemplo, la respuesta del POST). Sin él, consulta de inmediato. */
  initial: GenerationRequestStatus | null;
  load: (requestId: string) => Promise<GenerationRequestStatus>;
  signal: AbortSignal;
  onUpdate: (request: GenerationRequestStatus) => void;
  onTransientError: (cause: unknown) => void;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/** Consulta hasta un estado final o hasta que se aborte la señal. Lanza los errores fatales. */
export async function pollGeneration({
  requestId, initial, load, signal, onUpdate, onTransientError, wait = abortableWait,
}: PollOptions) {
  if (initial && isTerminal(initial.status)) return;
  let delay = firstPollDelay;
  let loadNow = !initial;

  while (!signal.aborted) {
    if (!loadNow) {
      await wait(delay, signal);
      delay = nextPollDelay(delay);
      if (signal.aborted) return;
    }
    loadNow = false;
    try {
      const current = await load(requestId);
      if (signal.aborted) return;
      onUpdate(current);
      if (isTerminal(current.status)) return;
    } catch (cause) {
      if (signal.aborted) return;
      if (isFatal(cause)) throw cause;
      onTransientError(cause);
    }
  }
}

/** El pedido guardado o, si no hay ninguno, el activo más reciente de la unidad. */
export async function recoverRequestId(
  unitId: string, storage: GenerationStorage, listActive: () => Promise<GenerationRequestSummary[]>,
) {
  const stored = storage.read(unitId);
  if (stored?.requestId) return stored.requestId;
  const [latest] = await listActive();
  if (!latest) return null;
  if (stored) storage.save(unitId, { ...stored, requestId: latest.id });
  return latest.id;
}

interface UseGenerationRequestOptions {
  unitId: string;
  token: string;
  onSessionExpired: (token: string) => void;
}

interface PollTarget {
  requestId: string;
  initial: GenerationRequestStatus | null;
}

export function useGenerationRequest({ unitId, token, onSessionExpired }: UseGenerationRequestOptions) {
  const [request, setRequest] = useState<GenerationRequestStatus | null>(null);
  const [target, setTarget] = useState<PollTarget | null>(null);
  const [recovering, setRecovering] = useState(true);
  const [error, setError] = useState<GenerationError | null>(null);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  const handleFatal = useCallback((cause: unknown) => {
    if (isSessionExpired(cause)) {
      sessionExpired.current(token);
      return;
    }
    if (cause instanceof ApiError && cause.status === 404) {
      generationStorage.clear(unitId);
      setRequest(null);
      setTarget(null);
    }
    setError(generationError(cause));
  }, [token, unitId]);

  useEffect(() => {
    let active = true;
    setRecovering(true);
    recoverRequestId(unitId, generationStorage, () => listGenerationRequests(token, unitId, true))
      .then((requestId) => {
        if (active && requestId) setTarget((current) => current ?? { requestId, initial: null });
      })
      .catch((cause) => { if (active) handleFatal(cause); })
      .finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [unitId, token, handleFatal]);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    pollGeneration({
      ...target,
      load: (requestId) => getGenerationRequest(token, requestId),
      signal: controller.signal,
      onUpdate: (current) => {
        setRequest(current);
        setError(null);
      },
      onTransientError: (cause) => setError(generationError(cause)),
    }).catch((cause) => { if (!controller.signal.aborted) handleFatal(cause); });
    return () => controller.abort();
  }, [target, token, handleFatal]);

  /** Sigue un pedido recién creado o recuperado con su estado ya conocido. */
  const track = useCallback((current: GenerationRequestStatus) => {
    setRequest(current);
    setError(null);
    setTarget({ requestId: current.id, initial: current });
  }, []);

  /** Deja de mostrar el pedido para empezar otro. Lo generado sigue en Revisión. */
  const reset = useCallback(() => {
    generationStorage.clear(unitId);
    setRequest(null);
    setTarget(null);
    setError(null);
  }, [unitId]);

  return { request, recovering, error, track, reset };
}
