import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { materialsApi } from '../api/materialsApi';
import type { ChunkItem, UploadContextPayload } from '../model/types';
import {
  materialListFailed,
  materialListLoaded,
  materialListMessage,
  removeDocument,
  replaceDocument,
  type MaterialListState,
} from '../model/materialList';
import { DocumentCard } from '../components/DocumentCard';
import { MaterialUploadForm } from '../components/MaterialUploadForm';
import { TopicSearchModal } from '../components/TopicSearchModal';
import { ChunkListModal } from '../components/ChunkListModal';
import { EvidenceSearchPanel } from '../components/EvidenceSearchPanel';
import '../materials.css';

export function MaterialPage() {
  const { unit, token, onSessionExpired } = useOutletContext<UnitContext>();
  return <MaterialPageContent key={unit.id} unit={unit} token={token} onSessionExpired={onSessionExpired} />;
}

export interface MaterialPageContentProps {
  unit: UnitContext['unit'];
  token: string;
  onSessionExpired: (token: string) => void;
}

export function MaterialPageContent({ unit, token, onSessionExpired }: MaterialPageContentProps) {
  const [listState, setListState] = useState<MaterialListState>({ status: 'loading' });
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modales y manejo de foco
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const [activeChunks, setActiveChunks] = useState<ChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!token) return;
    try {
      setListState({ status: 'loading' });
      setActionError(null);
      const allDocs = await materialsApi.listDocuments(token);
      const filtered = allDocs.filter((d) => d.unitId === unit.id);
      setListState(materialListLoaded(filtered));
    } catch (cause: unknown) {
      const next = materialListFailed(cause);
      if (next.status === 'expired') {
        onSessionExpired(token);
        return;
      }
      setListState(next);
    }
  }, [token, unit.id, onSessionExpired]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File, context: UploadContextPayload) => {
    setIsUploading(true);
    setActionError(null);
    try {
      const newDoc = await materialsApi.uploadDocument(file, context, token);
      setListState((current) => replaceDocument(current, newDoc));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async (documentId: string) => {
    setIsProcessingId(documentId);
    setActionError(null);
    try {
      const processed = await materialsApi.processDocument(documentId, token);
      setListState((current) => replaceDocument(current, processed));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setActionError(errorMessage(err));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este documento y sus fragmentos?')) return;
    setActionError(null);
    try {
      await materialsApi.deleteDocument(documentId, token);
      setListState((current) => removeDocument(current, documentId));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setActionError(errorMessage(err));
    }
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      await materialsApi.downloadOriginalFile(documentId, fileName, token);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setActionError(errorMessage(err));
    }
  };

  const handleViewChunks = async (documentId: string, triggerElement: HTMLElement) => {
    lastTriggerRef.current = triggerElement;
    // Limpieza inmediata del estado anterior
    setActiveChunks([]);
    setChunkError(null);
    setIsLoadingChunks(true);
    setIsChunkModalOpen(true);

    try {
      const chunks = await materialsApi.getChunks(documentId, token);
      setActiveChunks(chunks);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      // El error se muestra dentro del modal, no en la página
      setChunkError(errorMessage(err));
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleCloseChunkModal = () => {
    setIsChunkModalOpen(false);
    setChunkError(null);
    setActiveChunks([]);
    lastTriggerRef.current?.focus();
  };

  const handleOpenTopicModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    lastTriggerRef.current = e.currentTarget;
    setIsTopicModalOpen(true);
  };

  const handleCloseTopicModal = () => {
    setIsTopicModalOpen(false);
    lastTriggerRef.current?.focus();
  };

  const handleImportTopic = async (topic: string, maxResults: number) => {
    try {
      const imported = await materialsApi.importFromTopic(unit.id, topic, token, maxResults);
      imported.forEach((doc) => {
        setListState((current) => replaceDocument(current, doc));
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      throw err;
    }
  };

  const handleSearchEvidence = async (query: string, topK: number) => {
    try {
      return await materialsApi.searchEvidence(query, unit.id, topK, token);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
      }
      throw err;
    }
  };

  const message = materialListMessage(listState);

  return (
    <section className="stack">
      <div className="mat-section-head">
        <h2 className="h2">Material y Evidencia</h2>
        <button
          type="button"
          className="btn"
          onClick={handleOpenTopicModal}
        >
          Importar de fuente abierta
        </button>
      </div>

      {message && (
        <p
          className={listState.status === 'error' ? 'alert alert--warn' : 'muted'}
          role={listState.status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}

      {actionError && (
        <p className="alert alert--warn" role="alert">
          {actionError}
        </p>
      )}

      <MaterialUploadForm
        unitId={unit.id}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      <section className="card" aria-labelledby="mat-list-title">
        <h3 className="title" id="mat-list-title">Materiales registrados</h3>
        {listState.status === 'loading' && (
          <p className="muted" role="status">Cargando materiales…</p>
        )}
        {listState.status === 'ready' && listState.documents.length === 0 && (
          <p className="muted">Esta unidad todavía no tiene materiales registrados.</p>
        )}
        {listState.status === 'ready' && listState.documents.length > 0 && (
          <div className="mat-grid">
            {listState.documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onProcess={handleProcess}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onViewChunks={handleViewChunks}
                isProcessing={isProcessingId === doc.id}
              />
            ))}
          </div>
        )}
      </section>

      <EvidenceSearchPanel
        onSearch={handleSearchEvidence}
      />

      <TopicSearchModal
        isOpen={isTopicModalOpen}
        onClose={handleCloseTopicModal}
        onImport={handleImportTopic}
      />

      <ChunkListModal
        isOpen={isChunkModalOpen}
        onClose={handleCloseChunkModal}
        chunks={activeChunks}
        isLoading={isLoadingChunks}
        error={chunkError}
      />
    </section>
  );
}