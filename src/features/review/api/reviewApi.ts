import { ApiError, request } from '../../../shared/api/httpClient';
import type { Resource } from '../model/resource';
import { findResource } from '../model/reviewList';

const resourcesPath = (unitId: string) => '/units/' + encodeURIComponent(unitId) + '/resources';
const resourcePath = (resource: Pick<Resource, 'unitId' | 'id'>) =>
  resourcesPath(resource.unitId) + '/' + encodeURIComponent(resource.id);

export function listResources(token: string, unitId: string) {
  return request<Resource[]>(resourcesPath(unitId), 'GET', undefined, token);
}

/** La versión vigente de un recurso, por ejemplo para recargarlo después de un conflicto de versión. */
export async function getResource(token: string, unitId: string, resourceId: string) {
  return findResource(await listResources(token, unitId), resourceId);
}

/** Solo lo que el docente edita o decide; la versión indica de qué versión parte la edición (REV-R12). */
export function reviewBody(resource: Resource) {
  return {
    expectedVersion: resource.version,
    title: resource.title,
    body: resource.body,
    status: resource.status,
    discardReason: resource.status === 'descartado' ? resource.discardReason : null,
    edited: resource.edited,
    ...(resource.bodyHtml !== undefined ? { bodyHtml: resource.bodyHtml } : {}),
    ...(resource.structure ? { structure: resource.structure } : {}),
    options: resource.options?.map((option) => ({
      id: option.id,
      text: option.text,
      feedback: option.feedback,
      decision: option.decision,
      discardReason: option.decision === 'descartado' ? option.discardReason : null,
      edited: option.edited,
    })) ?? null,
  };
}

/** Guarda la revisión. Si el recurso cambió en otra pestaña, falla con 409 VERSION_CONFLICT (REV-C14). */
export function saveResource(token: string, resource: Resource) {
  return request<Resource>(resourcePath(resource), 'PUT', reviewBody(resource), token);
}

/** «Reintentar comprobación» de una comprobación pendiente, sobre la misma versión (REV-C3). */
export function retryVerification(token: string, resource: Resource) {
  return request<Resource>(resourcePath(resource) + '/verification', 'POST', { expectedVersion: resource.version }, token);
}

/**
 * Genera de nuevo la imagen o el audio con la descripción o el guion guardados (REV-C8). Solo para recursos pendientes
 * (409 RESOURCE_NOT_PENDING) y con la generación activa en el servidor (409 MEDIA_GENERATION_DISABLED).
 */
export function regenerateMedia(token: string, resource: Resource) {
  return request<Resource>(resourcePath(resource) + '/media', 'POST', undefined, token);
}

export interface RegenerationResult {
  previousResourceId: string;
  /** El anterior pasó a Descartados con el motivo «regenerado»; false si cambió mientras tanto y quedan los dos. */
  previousDiscarded: boolean;
  newResourceIds: string[];
  status: 'succeeded' | 'running';
}

/**
 * Pide a Generación un recurso nuevo con los parámetros guardados (REV-C12). Si falla, el anterior queda igual y el
 * error trae el motivo: 409 o 422 con el código de Generación, 502 REGENERATION_FAILED o 503 REGENERATION_UNAVAILABLE.
 */
export function regenerateResource(token: string, resource: Resource) {
  return request<RegenerationResult>(
    resourcePath(resource) + '/regenerations', 'POST', { expectedVersion: resource.version }, token,
  );
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'VERSION_CONFLICT';
}
