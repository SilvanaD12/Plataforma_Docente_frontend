import { useState } from 'react';
import { extractCitedFragments } from '../model/citations';
import type { Resource } from '../model/resource';
import '../review.css';

interface CitationListProps {
  resource: Pick<Resource, 'id' | 'citations' | 'evidence'>;
  defaultOpen?: boolean;
}

/** Lista plegable con las fuentes citadas del recurso y sus extractos (cerrada por defecto). */
export function CitationList({ resource, defaultOpen = false }: CitationListProps) {
  const [open, setOpen] = useState(defaultOpen);
  const fragments = extractCitedFragments(resource);
  const bodyId = `${resource.id}-citations`;

  return (
    <div className="citation-list">
      <button
        type="button"
        className="citation-list__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="citation-list__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span>Fuentes citadas ({fragments.length})</span>
      </button>
      <div id={bodyId} hidden={!open}>
        <div className="citation-list__body">
          {fragments.length === 0 ? (
            <p className="muted">Este recurso no cita fragmentos del material.</p>
          ) : (
            <ul className="citation-list__items">
              {fragments.map((item) => (
                <li key={item.id} className="citation-list__item">
                  <div className="citation-list__meta">
                    <span className="citation-list__tag">{item.tag}</span>
                    <span className="citation-list__source">{item.sourceLabel}</span>
                    {item.location && <span className="muted">· {item.location}</span>}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="citation-list__link"
                      >
                        Ver fuente
                      </a>
                    )}
                  </div>
                  {item.excerpt && <blockquote className="citation-list__excerpt">«{item.excerpt}»</blockquote>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
