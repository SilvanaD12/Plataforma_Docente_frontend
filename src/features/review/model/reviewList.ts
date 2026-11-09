import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import type { Resource } from './resource';

export type ReviewListState =
  | { status: 'loading' }
  | { status: 'ready'; resources: Resource[] }
  | { status: 'error'; message: string }
  | { status: 'expired' };

export function listLoaded(resources: Resource[]): ReviewListState {
  return { status: 'ready', resources };
}

/** Un 401 indica sesión vencida: la pantalla devuelve al docente al acceso. */
export function listFailed(error: unknown): ReviewListState {
  if (error instanceof ApiError && error.status === 401) return { status: 'expired' };
  return { status: 'error', message: errorMessage(error) };
}

export function listMessage(state: ReviewListState): string | null {
  if (state.status === 'loading') return 'Cargando los recursos de la unidad…';
  if (state.status === 'error') return state.message;
  if (state.status === 'ready' && state.resources.length === 0) {
    return 'Esta unidad todavía no tiene recursos para revisar. Genéralos en la pestaña Generación.';
  }
  return null;
}

export function replaceResource(state: ReviewListState, resource: Resource): ReviewListState {
  if (state.status !== 'ready') return state;
  return { ...state, resources: state.resources.map((current) => (current.id === resource.id ? resource : current)) };
}

export function findResource(resources: Resource[], resourceId: string): Resource {
  const found = resources.find(({ id }) => id === resourceId);
  if (!found) throw new Error('El recurso ya no existe: vuelve a cargar la revisión.');
  return found;
}
