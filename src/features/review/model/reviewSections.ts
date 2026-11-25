import type { Resource, ReviewStatus } from './resource';
import { STAGE_ORDER } from './resource';

export interface SectionDefinition {
  status: ReviewStatus;
  title: string;
  emptyMessage: string;
  defaultOpen: boolean;
}

export const REVIEW_SECTIONS: SectionDefinition[] = [
  {
    status: 'pendiente',
    title: 'Pendientes de revisión',
    emptyMessage: 'No hay recursos pendientes.',
    defaultOpen: true,
  },
  {
    status: 'aprobado',
    title: 'Aprobados',
    emptyMessage: 'Aún no apruebas recursos.',
    defaultOpen: false,
  },
  {
    status: 'descartado',
    title: 'Descartados',
    emptyMessage: 'No hay recursos descartados.',
    defaultOpen: false,
  },
];

export type GroupedResources = Record<ReviewStatus, Resource[]>;

/** Ordena los recursos por etapa pedagógica (Enganchar → Evaluar) y luego por fecha de creación ascendente. */
export function compareResourcesByStageAndDate(a: Resource, b: Resource): number {
  const stageA = STAGE_ORDER[a.stage] ?? 99;
  const stageB = STAGE_ORDER[b.stage] ?? 99;
  if (stageA !== stageB) return stageA - stageB;

  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);
  if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }
  const byText = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  return byText !== 0 ? byText : a.id.localeCompare(b.id);
}

export function groupResourcesByStatus(resources: Resource[]): GroupedResources {
  const grouped: GroupedResources = {
    pendiente: [],
    aprobado: [],
    descartado: [],
  };
  for (const item of resources) {
    grouped[item.status].push(item);
  }
  grouped.pendiente.sort(compareResourcesByStageAndDate);
  grouped.aprobado.sort(compareResourcesByStageAndDate);
  grouped.descartado.sort(compareResourcesByStageAndDate);
  return grouped;
}

export function defaultCardOpen(resource: Pick<Resource, 'status'>): boolean {
  return resource.status === 'pendiente';
}

export function isCardOpen(openCards: Record<string, boolean>, resource: Pick<Resource, 'id' | 'status'>): boolean {
  return openCards[resource.id] ?? defaultCardOpen(resource);
}

/**
 * Tras aprobar o descartar un recurso pendiente, elige la cabecera del siguiente recurso pendiente al cual mover
 * el foco, o null cuando ya no quedan pendientes.
 */
export function nextPendingFocusId(
  previousPending: Resource[],
  nextPending: Resource[],
  movedId: string,
): string | null {
  if (nextPending.length === 0) return null;
  const nextIds = new Set(nextPending.map((item) => item.id));
  const previousIndex = previousPending.findIndex((item) => item.id === movedId);
  if (previousIndex >= 0) {
    for (let i = previousIndex + 1; i < previousPending.length; i++) {
      if (nextIds.has(previousPending[i].id)) {
        return previousPending[i].id;
      }
    }
  }
  return nextPending[0].id;
}

/** Aplica el cierre de todas las tarjetas de una sección sin plegar aquellas con cambios sin guardar. */
export function closeSectionCards(
  sectionResources: Resource[],
  openCards: Record<string, boolean>,
  dirtyCards: Record<string, boolean>,
): { nextOpen: Record<string, boolean>; blockedIds: string[] } {
  const nextOpen = { ...openCards };
  const blockedIds: string[] = [];
  for (const item of sectionResources) {
    if (dirtyCards[item.id]) {
      nextOpen[item.id] = true;
      blockedIds.push(item.id);
    } else {
      nextOpen[item.id] = false;
    }
  }
  return { nextOpen, blockedIds };
}
