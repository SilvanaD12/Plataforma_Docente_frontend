import { request, ApiError } from '../../../shared/api/httpClient';
import {
  DocumentItem,
  ChunkItem,
  EvidenceSearchResult,
  UploadContextPayload,
} from '../model/types.js';

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const materialsApi = {
  /**
   * Lista todos los documentos de la cuenta del docente.
   */
  async listDocuments(token: string): Promise<DocumentItem[]> {
    return request<DocumentItem[]>('/documents', 'GET', undefined, token);
  },

  /**
   * Procesa y fragmenta el documento en chunks de ~220 palabras.
   */
  async processDocument(documentId: string, token: string): Promise<DocumentItem> {
    return request<DocumentItem>(`/documents/${documentId}/process`, 'POST', undefined, token);
  },

  /**
   * Lista los fragmentos procesados de un documento.
   */
  async getChunks(documentId: string, token: string): Promise<ChunkItem[]> {
    return request<ChunkItem[]>(`/documents/${documentId}/chunks`, 'GET', undefined, token);
  },

  /**
   * Elimina un documento y sus chunks asociados.
   */
  async deleteDocument(documentId: string, token: string): Promise<void> {
    return request<void>(`/documents/${documentId}`, 'DELETE', undefined, token);
  },

  /**
   * Importa contenido educativo abierto a partir de un tema (Wikipedia).
   */
  async importFromTopic(
    unitId: string,
    topic: string,
    token: string,
    maxResults: number = 1
  ): Promise<DocumentItem[]> {
    return request<DocumentItem[]>(
      '/documents/from-topic',
      'POST',
      { unitId, topic, maxResults },
      token
    );
  },

  /**
   * Búsqueda híbrida de evidencia con query parameters estandarizados en camelCase (unitId, topK ge=1 le=50).
   */
  async searchEvidence(
    query: string,
    unitId: string | undefined,
    topK: number,
    token: string
  ): Promise<EvidenceSearchResult[]> {
    const params = new URLSearchParams({
      query,
      topK: Math.max(1, Math.min(50, topK)).toString(),
    });
    if (unitId) {
      params.append('unitId', unitId);
    }
    return request<EvidenceSearchResult[]>(`/documents/search?${params.toString()}`, 'GET', undefined, token);
  },

  /**
   * Sube un archivo con multipart/form-data adjuntando el payload context en JSON.
   */
  async uploadDocument(file: File, context: UploadContextPayload, token: string): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', JSON.stringify(context));

    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${apiBase}/api/v1/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = typeof data?.error?.message === 'string'
        ? data.error.message
        : 'No se pudo subir el documento.';
      throw new ApiError(response.status, message);
    }

    return response.json();
  },

  /**
   * Descarga el archivo original subido.
   */
  async downloadOriginalFile(documentId: string, fileName: string, token: string): Promise<void> {
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${apiBase}/api/v1/documents/${documentId}/file`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = typeof data?.error?.message === 'string'
        ? data.error.message
        : 'No se pudo descargar el archivo.';
      throw new ApiError(response.status, message);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};