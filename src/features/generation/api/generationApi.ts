import { request, requestWithStatus } from '../../../shared/api/httpClient';
import type {
  GenerationInterpretation, GenerationRequestStatus, GenerationRequestSummary, StartGenerationRequest,
} from '../model/generationRequest';

/** `created` es true con 202 (pedido nuevo) y false con 200 (misma clave y mismo cuerpo: pedido existente). */
export async function startGenerationRequest(token: string, key: string, body: StartGenerationRequest) {
  const { status, data } = await requestWithStatus<GenerationRequestStatus>(
    '/generation-requests', 'POST', body, token, { 'Idempotency-Key': key },
  );
  return { request: data, created: status === 202 };
}

export function getGenerationRequest(token: string, requestId: string) {
  return request<GenerationRequestStatus>('/generation-requests/' + encodeURIComponent(requestId), 'GET', undefined, token);
}

export function listGenerationRequests(token: string, unitId: string, active: boolean) {
  const query = new URLSearchParams({ unitId, active: String(active) });
  return request<GenerationRequestSummary[]>('/generation-requests?' + query, 'GET', undefined, token);
}

export function interpretGenerationRequest(token: string, unitId: string, message: string) {
  return request<GenerationInterpretation>(
    '/generation-requests/interpret',
    'POST',
    { unitId, message },
    token,
  );
}
