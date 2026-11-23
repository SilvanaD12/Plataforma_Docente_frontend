import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/httpClient';
import {
  approveGenerationPlan, createGenerationPlan, getGenerationPlan, listGenerationPlans, updateGenerationPlan,
} from '../api/generationPlansApi';
import { generationError, isSessionExpired, type GenerationError } from '../model/generationErrors';
import {
  latestOpenPlan, type CreateGenerationPlan, type GenerationPlan, type UpdateGenerationPlan,
} from '../model/generationPlan';
import { newIdempotencyKey } from './useStartGeneration';

export type PlanBusy = 'creating' | 'saving' | 'approving' | 'reloading' | null;

/** PLAN-C14: al recargar, el último plan de la unidad que sigue en borrador o aprobado. */
export async function recoverLatestPlan(list: () => Promise<GenerationPlan[]>) {
  return latestOpenPlan(await list());
}

export interface PlanAttempt {
  key: string;
  body: CreateGenerationPlan;
  /** El envío anterior quedó sin respuesta (fallo de red). */
  unanswered: boolean;
}

/**
 * Misma regla que la generación: la clave se reutiliza solo para reenviar el mismo cuerpo tras un fallo de red,
 * así el servidor devuelve el plan ya creado (200) en vez de crear otro.
 */
export function planAttemptKey(previous: PlanAttempt | null, body: CreateGenerationPlan, newKey: () => string) {
  if (previous?.unanswered && JSON.stringify(previous.body) === JSON.stringify(body)) return previous.key;
  return newKey();
}

interface UseGenerationPlanOptions {
  unitId: string;
  token: string;
  onSessionExpired: (token: string) => void;
}

export function useGenerationPlan({ unitId, token, onSessionExpired }: UseGenerationPlanOptions) {
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [recovering, setRecovering] = useState(true);
  const [busy, setBusy] = useState<PlanBusy>(null);
  const [error, setError] = useState<GenerationError | null>(null);
  const lastAttempt = useRef<PlanAttempt | null>(null);
  const mounted = useRef(false);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fail = useCallback((cause: unknown) => {
    if (isSessionExpired(cause)) {
      sessionExpired.current(token);
      return;
    }
    if (mounted.current) setError(generationError(cause));
  }, [token]);

  useEffect(() => {
    let active = true;
    setRecovering(true);
    recoverLatestPlan(() => listGenerationPlans(token, unitId))
      .then((latest) => { if (active && latest) setPlan((current) => current ?? latest); })
      // Sin plan que recuperar, el formulario sigue funcionando como siempre: solo importa la sesión vencida.
      .catch((cause) => { if (active && isSessionExpired(cause)) sessionExpired.current(token); })
      .finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [unitId, token, fail]);

  const run = useCallback(async (label: Exclude<PlanBusy, null>, action: () => Promise<GenerationPlan | null>) => {
    setBusy(label);
    setError(null);
    try {
      const next = await action();
      if (mounted.current) setPlan(next);
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [fail]);

  const create = useCallback((body: CreateGenerationPlan) => {
    const key = planAttemptKey(lastAttempt.current, body, newIdempotencyKey);
    lastAttempt.current = { key, body, unanswered: false };
    return run('creating', async () => {
      try {
        return (await createGenerationPlan(token, key, body)).plan;
      } catch (cause) {
        if (!(cause instanceof ApiError) && lastAttempt.current?.key === key) lastAttempt.current.unanswered = true;
        throw cause;
      }
    });
  }, [run, token]);

  const save = useCallback((body: UpdateGenerationPlan) => {
    if (!plan) return Promise.resolve(false);
    return run('saving', () => updateGenerationPlan(token, plan.id, body));
  }, [plan, run, token]);

  const approve = useCallback(() => {
    if (!plan) return Promise.resolve(false);
    return run('approving', () => approveGenerationPlan(token, plan.id, plan.version));
  }, [plan, run, token]);

  /** Tras `PLAN_VERSION_CONFLICT`: trae la versión actual del servidor. Los cambios sin guardar se pierden. */
  const reload = useCallback(() => {
    if (!plan) return Promise.resolve(false);
    return run('reloading', async () => {
      try {
        return await getGenerationPlan(token, plan.id);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) return null;
        throw cause;
      }
    });
  }, [plan, run, token]);

  /** Deja de mostrar el plan (para volver al formulario o tras empezar la generación). */
  const close = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { plan, recovering, busy, error, create, save, approve, reload, close, clearError };
}
