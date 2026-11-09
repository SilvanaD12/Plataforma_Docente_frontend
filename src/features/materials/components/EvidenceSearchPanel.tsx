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
    <div className="mat-search-panel">
      <h3>Búsqueda de evidencia en la unidad</h3>
      <form onSubmit={handleSearch} className="mat-search-form">
        <div className="mat-search-inputs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe términos de búsqueda (ej. protocolos de red)..."
            disabled={isSearching}
          />
          <div className="mat-topk-control">
            <label htmlFor="topk-slider">Resultados ({topK}):</label>
            <input
              id="topk-slider"
              type="range"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              disabled={isSearching}
            />
          </div>
          <button type="submit" className="mat-btn mat-btn-primary" disabled={isSearching || !query.trim()}>
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <div className="mat-form-error">{error}</div>}

      {searched && (
        <div className="mat-search-results">
          <h4>Evidencias encontradas ({results.length})</h4>
          {results.length === 0 ? (
            <p className="mat-empty">No se encontraron fragmentos relevantes para los términos ingresados.</p>
          ) : (
            results.map((item) => (
              <div key={item.id} className="mat-evidence-result-card">
                <div className="mat-evidence-header">
                  <span className="mat-evidence-loc">{item.location || 'Documento'}</span>
                  <div className="mat-evidence-badges">
                    {item.retrievalMode && (
                      <span className={`mat-mode-badge mat-mode-${item.retrievalMode}`}>
                        {item.retrievalMode === 'hybrid' ? 'Híbrido (RRF)' : 'Léxico (BM25)'}
                      </span>
                    )}
                    <span className="mat-relevance-score">
                      Relevancia: {(item.relevance * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="mat-evidence-text">{item.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}