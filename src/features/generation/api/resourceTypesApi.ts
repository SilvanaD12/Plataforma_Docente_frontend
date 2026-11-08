import { request } from '../../../shared/api/httpClient';
import type { ResourceTypeInfo } from '../model/resourceTypes';

/** Catálogo público: no requiere sesión. */
export function listResourceTypes() {
  return request<ResourceTypeInfo[]>('/resource-types', 'GET');
}
