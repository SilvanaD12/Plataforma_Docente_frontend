import type { StartGenerationRequest } from '../model/generationRequest';

/** Lo que se guarda por unidad antes de enviar el pedido (research.md, R10). */
export interface StoredGeneration {
  key: string;
  payload: StartGenerationRequest;
  requestId: string | null;
}

export interface GenerationStorage {
  read: (unitId: string) => StoredGeneration | null;
  save: (unitId: string, entry: StoredGeneration) => void;
  clear: (unitId: string) => void;
}

const storageKey = (unitId: string) => 'generation:' + unitId;

function isStoredGeneration(value: unknown): value is StoredGeneration {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.key === 'string'
    && !!entry.payload && typeof entry.payload === 'object'
    && (entry.requestId === null || typeof entry.requestId === 'string');
}

// Si el navegador bloquea el almacenamiento, el pedido sigue en memoria y se recupera con la lista de activos.
export const generationStorage: GenerationStorage = {
  read(unitId) {
    try {
      const raw = window.sessionStorage.getItem(storageKey(unitId));
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return isStoredGeneration(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  save(unitId, entry) {
    try {
      window.sessionStorage.setItem(storageKey(unitId), JSON.stringify(entry));
    } catch {
      // Sin almacenamiento, la clave vive solo durante este envío.
    }
  },
  clear(unitId) {
    try {
      window.sessionStorage.removeItem(storageKey(unitId));
    } catch {
      // No había nada que limpiar o el navegador no lo permite.
    }
  },
};
