import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { materialsApi } from '../api/materialsApi';
import { DocumentItem, ChunkItem, UploadContextPayload } from '../model/types';
import { DocumentCard } from '../components/DocumentCard';
import { MaterialUploadForm } from '../components/MaterialUploadForm';
import { TopicSearchModal } from '../components/TopicSearchModal';
import { ChunkListModal } from '../components/ChunkListModal';
import { EvidenceSearchPanel } from '../components/EvidenceSearchPanel';
import '../materials.css';

export function MaterialPage() {
  const { unit, token, onSessionExpired } = useOutletContext<UnitContext>();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Modales
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const [activeChunks, setActiveChunks] = useState<ChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setErrorBanner(null);
      const allDocs = await materialsApi.listDocuments(token);
      const filtered = allDocs.filter((d) => d.unitId === unit.id);
      setDocuments(filtered);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          onSessionExpired(token);
          return;
        }
        if (err.status === 404) {
          setErrorBanner('La unidad seleccionada no existe o no pertenece a tus cursos asignados.');
          return;
        }
      }
      setErrorBanner(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token, unit.id, onSessionExpired]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File, context: UploadContextPayload) => {
    setIsUploading(true);
    try {
      const newDoc = await materialsApi.uploadDocument(file, context, token);
      setDocuments((prev) => [newDoc, ...prev]);
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
    try {
      const processed = await materialsApi.processDocument(documentId, token);
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? processed : d)));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setErrorBanner(errorMessage(err));
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este documento y sus fragmentos?')) return;
    try {
      await materialsApi.deleteDocument(documentId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setErrorBanner(errorMessage(err));
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
      setErrorBanner(errorMessage(err));
    }
  };

  const handleViewChunks = async (documentId: string) => {
    setIsChunkModalOpen(true);
    setIsLoadingChunks(true);
    try {
      const chunks = await materialsApi.getChunks(documentId, token);
      setActiveChunks(chunks);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired(token);
        return;
      }
      setErrorBanner(errorMessage(err));
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleImportTopic = async (topic: string, maxResults: number) => {
    try {
      const imported = await materialsApi.importFromTopic(unit.id, topic, token, maxResults);
      setDocuments((prev) => [...imported, ...prev]);
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

  return (
    <div className="mat-container">
      <div className="mat-header">
        <div>
          <h2>Materiales y Evidencias de la Unidad</h2>
          <p className="mat-subtitle">
            Carga y gestiona el material que fundamentará la generación de recursos didácticos 5E para {unit.title}.
          </p>
        </div>
        <div className="mat-header-actions">
          <button
            type="button"
            className="mat-btn mat-btn-secondary"
            onClick={() => setIsTopicModalOpen(true)}
          >
            Importar de fuente abierta
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="mat-error-banner" role="alert">
          {errorBanner}
        </div>
      )}

      {/* Formulario de carga de material */}
      <MaterialUploadForm
        unitId={unit.id}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      {/* Listado de documentos cargados */}
      <section className="mat-documents-section">
        <h3>Documentos registrados ({documents.length})</h3>
        {isLoading ? (
          <p className="mat-loading">Cargando materiales...</p>
        ) : documents.length === 0 ? (
          <p className="mat-empty">Aún no hay documentos registrados en esta unidad.</p>
        ) : (
          <div className="mat-documents-grid">
            {documents.map((doc) => (
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

      {/* Buscador de evidencia híbrida */}
      <EvidenceSearchPanel
        onSearch={handleSearchEvidence}
      />

      {/* Modales */}
      <TopicSearchModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onImport={handleImportTopic}
      />

      <ChunkListModal
        isOpen={isChunkModalOpen}
        onClose={() => setIsChunkModalOpen(false)}
        chunks={activeChunks}
        isLoading={isLoadingChunks}
      />
    </div>
  );
}