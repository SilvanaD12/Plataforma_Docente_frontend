import { fallbackSteps, stageLabel, type GenerationStep, type RetrievalMode } from '../model/generationRequest';
import { typeName, type ResourceTypeInfo } from '../model/resourceTypes';
import '../generation.css';

interface FallbackNoticesProps {
  retrievalMode?: RetrievalMode | null;
  steps: GenerationStep[];
  resourceTypes: ResourceTypeInfo[];
}

/**
 * Dos degradaciones independientes (research.md, R8): la búsqueda en el material y la redacción.
 * Con `retrievalMode` nulo o `hybrid` no hay aviso de búsqueda.
 */
export function FallbackNotices({ retrievalMode, steps, resourceTypes }: FallbackNoticesProps) {
  const drafted = fallbackSteps(steps);
  const searchFallback = retrievalMode === 'bm25_fallback';
  if (!searchFallback && drafted.length === 0) return null;

  return (
    <section className="stack" aria-label="Avisos sobre la generación">
      {searchFallback && (
        <div className="alert" data-notice="retrieval">
          <p>
            <strong>Búsqueda en el material por palabras clave.</strong>{' '}
            La búsqueda semántica no estuvo disponible y la evidencia se eligió solo por coincidencia de términos.
            Comprueba que los fragmentos citados sean pertinentes.
          </p>
        </div>
      )}
      {drafted.length > 0 && (
        <div className="alert alert--warn" data-notice="generator">
          <div className="stack generation-notice">
            <p>
              <strong>Redacción sin IA.</strong>{' '}
              En estos pasos la IA no respondió o su redacción no tenía respaldo en el material, y el recurso lo
              redactó el generador por reglas. Revísalos con más atención:
            </p>
            <ul className="generation-list">
              {drafted.map((step) => (
                <li key={step.position}>{stageLabel(step.stage)}: {typeName(resourceTypes, step.resourceType)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
