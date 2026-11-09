import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import type { DocumentItem } from './types';

export type MaterialListStatus = 'loading' | 'ready' | 'error' | 'expired';

export type MaterialListState =
  | { status: 'loading' }
  | { status: 'ready'; documents: DocumentItem[] }
  | { status: 'error'; message: string }
  | { status: 'expired' };

export function materialListLoaded(documents: DocumentItem[]): MaterialListState {
  return { status: 'ready', documents };
}

export function materialListFailed(cause: unknown): MaterialListState {
  if (cause instanceof ApiError && cause.status === 401) {
    return { status: 'expired' };
  }
  return { status: 'error', message: errorMessage(cause) };
}

export function replaceDocument(current: MaterialListState, updated: DocumentItem): MaterialListState {
  if (current.status !== 'ready') return current;
  const exists = current.documents.some((d) => d.id === updated.id);
  const documents = exists
    ? current.documents.map((d) => (d.id === updated.id ? updated : d))
    : [updated, ...current.documents];
  return { status: 'ready', documents };
}

export function removeDocument(current: MaterialListState, id: string): MaterialListState {
  if (current.status !== 'ready') return current;
  return {
    status: 'ready',
    documents: current.documents.filter((d) => d.id !== id),
  };
}

export function materialListMessage(state: MaterialListState): string | null {
  if (state.status === 'loading') return 'Cargando materiales de la unidad…';
  if (state.status === 'error') return state.message;
  return null;
}