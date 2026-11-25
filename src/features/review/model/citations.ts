import type { Evidence, Resource } from './resource';

const MAX_EXCERPT_CHARS = 300;

export interface CitedFragment {
  id: string;
  tag: string;
  excerpt: string;
  location: string;
  sourceLabel: string;
  sourceUrl: string | null;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

function formatExcerpt(text: string): string {
  const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_EXCERPT_CHARS) return collapsed;
  return collapsed.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd() + '…';
}

function formatSourceLabel(evidence: Evidence, sourceUrl: string | null): string {
  const name = (evidence.documentName ?? '').trim();
  if (!name || /wikipedia/i.test(name)) {
    if (sourceUrl) {
      try {
        return new URL(sourceUrl).hostname.toLowerCase();
      } catch {
        return 'Fuente web';
      }
    }
    return 'Fuente web';
  }
  return name;
}

/**
 * Extrae las fuentes citadas en `resource.citations[].fragmentIds` que tienen respaldo en `resource.evidence`,
 * asignando etiquetas consecutivas F1, F2… según el mismo criterio de orden que el contenido.
 */
export function extractCitedFragments(resource: Pick<Resource, 'citations' | 'evidence'>): CitedFragment[] {
  const evidenceById = new Map<string, Evidence>();
  for (const item of resource.evidence ?? []) {
    if (item && typeof item.id === 'string') {
      evidenceById.set(item.id, item);
    }
  }

  const seen = new Set<string>();
  const result: CitedFragment[] = [];

  for (const citation of resource.citations ?? []) {
    for (const fragmentId of citation.fragmentIds ?? []) {
      if (seen.has(fragmentId)) continue;
      const evidence = evidenceById.get(fragmentId);
      if (!evidence) continue;
      seen.add(fragmentId);
      const sourceUrl = safeHttpUrl(evidence.sourceUrl);
      result.push({
        id: evidence.id,
        tag: `F${result.length + 1}`,
        excerpt: formatExcerpt(evidence.text),
        location: (evidence.location ?? '').trim(),
        sourceLabel: formatSourceLabel(evidence, sourceUrl),
        sourceUrl,
      });
    }
  }

  return result;
}
