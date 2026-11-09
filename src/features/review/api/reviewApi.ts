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

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'VERSION_CONFLICT';
}
