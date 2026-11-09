export type DocumentStatus = 'registrado' | 'procesando' | 'procesado' | 'error';
export type DocumentKind = 'pdf' | 'pptx' | 'txt';

export interface DocumentOrigin {
  source: string;
  url: string;
  license: string;
  topic: string;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  kind: DocumentKind;
  sizeBytes: number;
  unitId: string;
  outcomeIds: string[];
  documentType: string;
  status: DocumentStatus;
  registeredAt: string;
  processedAt?: string | null;
  fragmentCount: number;
  pageCount?: number | null;
  errorMessage?: string | null;
  embeddedFragmentCount?: number | null;
  embeddingModel?: string | null;
  embeddingError?: string | null;
  origin?: DocumentOrigin | null;
}

export interface ChunkItem {
  id: string;
  order: number;
  location: string;
  text: string;
}

export interface EvidenceSearchResult {
  id: string;
  documentId?: string | null;
  name?: string | null;
  location?: string | null;
  text: string;
  relevance: number;
  retrievalMode?: 'hybrid' | 'bm25_fallback' | null;
}

export interface UploadContextPayload {
  unitId: string;
  outcomeIds: string[];
  documentType: string;
  suggestedStage?: string | null;
  usePermission: boolean;
}