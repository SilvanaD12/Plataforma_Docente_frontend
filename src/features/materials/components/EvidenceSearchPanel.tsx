import { useState, FormEvent } from 'react';
import { EvidenceSearchResult } from '../model/types';

interface EvidenceSearchPanelProps {
  onSearch: (query: string, topK: number) => Promise<EvidenceSearchResult[]>;
}

export function EvidenceSearchPanel({ onSearch }: EvidenceSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<EvidenceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setIsSearching(true);
      setError(null);
      const data = await onSearch(query.trim(), topK);
      setResults(data);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al consultar evidencias');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="card" aria-labelledby="evidence-search-title">
      <h3 className="title" id="evidence-search-title">Búsqueda de evidencia en la unidad</h3>
      <p className="field__hint">
        Comprueba la relevancia de los fragmentos indexados antes de la generación 5E.
      </p>

      {error && <p className="alert alert--warn" role="alert">{error}</p>}

      <form onSubmit={handleSearch} className="course-form-grid">
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span className="field__label">Términos de búsqueda</span>
          <input
            className="input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. protocolos de capa de transporte"
            disabled={isSearching}
          />
        </label>

        <label className="field">
          <span className="field__label">Resultados ({topK})</span>
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            disabled={isSearching}
          />
        </label>

        <div style={{ alignSelf: 'end' }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSearching || !query.trim()}
            aria-busy={isSearching}
          >
            {isSearching ? 'Consultando…' : 'Buscar evidencias'}
          </button>
        </div>
      </form>

      {searched && (
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          <h4 className="field__label">Resultados encontrados ({results.length})</h4>
          {results.length === 0 ? (
            <p className="muted">No se encontraron evidencias coincidentes con los términos ingresados.</p>
          ) : (
            results.map((item) => (
              <article key={item.id} className="mat-chunk-card">
                <div className="mat-chunk-meta">
                  <strong>{item.location || 'Documento'}</strong>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {item.retrievalMode && (
                      <span className={`mat-badge mat-badge--${item.retrievalMode === 'hybrid' ? 'procesado' : 'registrado'}`}>
                        {item.retrievalMode === 'hybrid' ? 'Híbrido (RRF)' : 'Léxico (BM25)'}
                      </span>
                    )}
                    <span>Relevancia: {(item.relevance * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <p>{item.text}</p>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}