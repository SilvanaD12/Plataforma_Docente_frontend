import { request, requestWithStatus } from '../../../shared/api/httpClient';
import type {
  CreateGenerationPlan, GenerationPlan, PlanStatus, UpdateGenerationPlan,
} from '../model/generationPlan';

const planPath = (planId: string) => '/generation-plans/' + encodeURIComponent(planId);

/** `created` es true con 201 (plan nuevo) y false con 200 (misma clave y mismo cuerpo: plan existente). */
export async function createGenerationPlan(token: string, key: string, body: CreateGenerationPlan) {
  const { status, data } = await requestWithStatus<GenerationPlan>(
    '/generation-plans', 'POST', body, token, { 'Idempotency-Key': key },
  );
  return { plan: data, created: status === 201 };
}

/** Planes de la unidad, del más reciente al más antiguo. */
export function listGenerationPlans(token: string, unitId: string, options: { status?: PlanStatus; limit?: number } = {}) {
  const query = new URLSearchParams({ unitId });
  if (options.status) query.set('status', options.status);
  if (options.limit) query.set('limit', String(options.limit));
  return request<GenerationPlan[]>('/generation-plans?' + query, 'GET', undefined, token);
}

export function getGenerationPlan(token: string, planId: string) {
  return request<GenerationPlan>(planPath(planId), 'GET', undefined, token);
}

/** Guarda la edición. Un plan inválido se guarda igual, con sus problemas en `validation`. */
export function updateGenerationPlan(token: string, planId: string, body: UpdateGenerationPlan) {
  return request<GenerationPlan>(planPath(planId), 'PUT', body, token);
}

export function approveGenerationPlan(token: string, planId: string, expectedVersion: number) {
  return request<GenerationPlan>(planPath(planId) + '/approve', 'POST', { expectedVersion }, token);
}
