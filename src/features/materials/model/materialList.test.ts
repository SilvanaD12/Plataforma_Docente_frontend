import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/httpClient';
import type { DocumentItem } from './types';
import {
  materialListFailed,
  materialListLoaded,
  materialListMessage,
  removeDocument,
  replaceDocument,
} from './materialList';

function sampleDoc(id = 'doc-1'): DocumentItem {
  return {
    id,
    unitId: 'unit-1',
    fileName: 'tema1.pdf',
    kind: 'pdf',
    outcomeIds: [],
    documentType: 'Separata o apuntes de clase',
    sizeBytes: 1024,
    status: 'registrado',
    registeredAt: '2026-11-09T00:00:00Z',
    fragmentCount: 0,
    pageCount: 5,
  };
}

describe('materialList model', () => {
  it('inicializa en estado ready con los documentos dados', () => {
    const state = materialListLoaded([sampleDoc()]);
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.documents).toHaveLength(1);
    }
  });

  it('detecta expiración de sesión por código 401', () => {
    const error = new ApiError(401, 'UNAUTHORIZED', 'Sesión vencida');
    const state = materialListFailed(error);
    expect(state.status).toBe('expired');
  });

  it('reemplaza un documento existente si ya estaba en la lista', () => {
    const initial = materialListLoaded([sampleDoc('doc-1')]);
    const updated: DocumentItem = {
      ...sampleDoc('doc-1'),
      status: 'procesado',
      fragmentCount: 4,
    };
    const next = replaceDocument(initial, updated);
    if (next.status === 'ready') {
      expect(next.documents[0].status).toBe('procesado');
      expect(next.documents[0].fragmentCount).toBe(4);
    }
  });

  it('elimina un documento por su id', () => {
    const initial = materialListLoaded([sampleDoc('doc-1'), sampleDoc('doc-2')]);
    const next = removeDocument(initial, 'doc-1');
    if (next.status === 'ready') {
      expect(next.documents).toHaveLength(1);
      expect(next.documents[0].id).toBe('doc-2');
    }
  });

  it('devuelve el mensaje adecuado según el estado', () => {
    expect(materialListMessage({ status: 'loading' })).toBe('Cargando materiales de la unidad…');
    expect(materialListMessage({ status: 'error', message: 'Fallo de red' })).toBe('Fallo de red');
    expect(materialListMessage({ status: 'ready', documents: [] })).toBeNull();
  });
});