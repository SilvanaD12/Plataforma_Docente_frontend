import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentItem } from '../model/types';
import { materialsApi } from './materialsApi';

afterEach(() => vi.unstubAllGlobals());

function sampleDocument(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc-1',
    unitId: 'unidad-1',
    fileName: 'diapositivas.pdf',
    kind: 'pdf',
    outcomeIds: [],
    documentType: 'Diapositivas de clase',
    sizeBytes: 1048576,
    status: 'registrado',
    fragmentCount: 0,
    pageCount: 12,
    registeredAt: '2026-11-09T04:00:00+00:00',
    ...overrides,
  };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url,
    method: init?.method,
    headers: new Headers(init?.headers),
    body: init?.body,
  };
}

describe('API de materiales (MAT-01)', () => {
  it('lista los documentos enviando el token de autenticación', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([sampleDocument()]));
    vi.stubGlobal('fetch', fetchMock);

    const docs = await materialsApi.listDocuments('token-docente');
    expect(docs).toHaveLength(1);
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/documents');
    expect(call.method).toBe('GET');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });

  it('procesa el material mediante POST a /process', async () => {
    const processedDoc = sampleDocument({ status: 'procesado', fragmentCount: 8 });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(processedDoc));
    vi.stubGlobal('fetch', fetchMock);

    const result = await materialsApi.processDocument('doc-1', 'token-docente');
    expect(result.status).toBe('procesado');
    expect(result.fragmentCount).toBe(8);

    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/documents/doc-1/process');
    expect(call.method).toBe('POST');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });

  it('elimina un documento con método DELETE', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await materialsApi.deleteDocument('doc-1', 'token-docente');
    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/documents/doc-1');
    expect(call.method).toBe('DELETE');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });

  it('obtiene los fragmentos asociados a un documento', async () => {
    const fragments = [
      { id: 'frag-1', documentId: 'doc-1', text: 'Fragmento explicativo', order: 0, location: 'Pág. 1' },
    ];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(fragments));
    vi.stubGlobal('fetch', fetchMock);

    const res = await materialsApi.getChunks('doc-1', 'token-docente');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('frag-1');
  });

  it('ejecuta búsqueda de evidencia por unidad', async () => {
    const searchResults = [
      { id: 'frag-1', documentId: 'doc-1', text: 'Protocolo TCP', relevance: 0.95, location: 'Pág. 3' },
    ];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(searchResults));
    vi.stubGlobal('fetch', fetchMock);

    const hits = await materialsApi.searchEvidence('TCP', 'unidad-1', 5, 'token-docente');
    expect(hits).toHaveLength(1);

    const call = lastCall(fetchMock);
    expect(call.url).toBe('/api/v1/documents/search?query=TCP&topK=5&unitId=unidad-1');
    expect(call.method).toBe('GET');
    expect(call.headers.get('Authorization')).toBe('Bearer token-docente');
  });
});