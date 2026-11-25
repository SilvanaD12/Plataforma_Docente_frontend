import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useInRouterContext, useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import {
  getDuplicationReport,
  getRegenerationStatus,
  getResource,
  listResources,
  regenerateMedia,
  regenerateResource,
  retryVerification,
  saveResource,
  type DuplicationReport,
} from '../api/reviewApi';
import { ResourceCard } from '../components/ResourceCard';
import {
  regenerationFailureNotice,
  regenerationNotice,
  regenerationProgressNotice,
  waitForRegeneration,
} from '../model/regenerationView';
import type { Resource, ReviewStatus } from '../model/resource';
import { listFailed, listLoaded, listMessage, replaceResource, type ReviewListState } from '../model/reviewList';
import {
  REVIEW_SECTIONS,
  closeSectionCards,
  groupResourcesByStatus,
  isCardOpen,
  nextPendingFocusId,
} from '../model/reviewSections';
import '../review.css';

type FocusTarget =
  | { kind: 'card'; id: string }
  | { kind: 'scroll'; id: string }
  | { kind: 'all-reviewed' };

function ExportTabLink({ href }: { href: string }) {
  const inRouter = useInRouterContext();
  return inRouter ? <Link to={href}>Exportación</Link> : <a href={href}>Exportación</a>;
}

/** Pestaña Revisión de la unidad. Lee la unidad y la sesión del contexto de `UnitLayout`. */
export function ReviewPage() {
  const { course, unit, token, onSessionExpired } = useOutletContext<UnitContext>();
  const exportHref = `/courses/${encodeURIComponent(course.id)}/units/${encodeURIComponent(unit.id)}/export`;
  return (
    <ReviewPageContent
      key={unit.id}
      token={token}
      unitId={unit.id}
      exportHref={exportHref}
      onSessionExpired={onSessionExpired}
    />
  );
}

interface ReviewPageContentProps {
  token: string;
  unitId: string;
  onSessionExpired: (token: string) => void;
  exportHref?: string;
  initialReport?: DuplicationReport | null;
  initialState?: ReviewListState;
  initialNotice?: { text: string; warn: boolean } | null;
  initialOpenSections?: Record<ReviewStatus, boolean>;
  initialOpenCards?: Record<string, boolean>;
}

const DEFAULT_OPEN_SECTIONS: Record<ReviewStatus, boolean> = {
  pendiente: true,
  aprobado: false,
  descartado: false,
};

export function ReviewPageContent({
  token,
  unitId,
  onSessionExpired,
  exportHref = '../export',
  initialReport = null,
  initialState = { status: 'loading' },
  initialNotice = null,
  initialOpenSections = DEFAULT_OPEN_SECTIONS,
  initialOpenCards = {},
}: ReviewPageContentProps) {
  const [state, setState] = useState<ReviewListState>(initialState);
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(initialNotice);
  // Al salir de la revisión se deja de consultar una regeneración en segundo plano.
  const left = useRef(false);
  useEffect(() => () => { left.current = true; }, []);
  // Cuántas veces se volvió a cargar el editor de cada recurso: solo el regenerado, para no perder otros borradores.
  const [remounts, setRemounts] = useState<Record<string, number>>({});
  const [duplicationReport, setDuplicationReport] = useState<DuplicationReport | null>(initialReport);
  const [openSections, setOpenSections] = useState<Record<ReviewStatus, boolean>>(initialOpenSections);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(initialOpenCards);
  const [dirtyCards, setDirtyCards] = useState<Record<string, boolean>>({});
  const [closeWarnings, setCloseWarnings] = useState<Record<string, boolean>>({});
  const [sectionBlockedNotice, setSectionBlockedNotice] = useState<Partial<Record<ReviewStatus, boolean>>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const headerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const allReviewedRef = useRef<HTMLDivElement | null>(null);
  const resourcesRef = useRef<Resource[]>([]);
  resourcesRef.current = state.status === 'ready' ? state.resources : [];

  const fetchDuplicationReport = useCallback(() => {
    getDuplicationReport(token, unitId)
      .then((rep) => setDuplicationReport(rep))
      .catch(() => {
        setDuplicationReport(null);
        setNotice({ text: 'No se pudo comprobar si hay contenido repetido.', warn: true });
      });
  }, [token, unitId]);

  useEffect(() => {
    fetchDuplicationReport();
  }, [fetchDuplicationReport]);

  useEffect(() => {
    let active = true;
    listResources(token, unitId)
      .then((resources) => { if (active) setState(listLoaded(resources)); })
      .catch((cause: unknown) => {
        if (!active) return;
        const next = listFailed(cause);
        if (next.status === 'expired') onSessionExpired(token);
        setState(next);
      });
    return () => { active = false; };
  }, [token, unitId, onSessionExpired]);

  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.kind === 'all-reviewed') {
      allReviewedRef.current?.focus();
    } else if (focusTarget.kind === 'card') {
      headerButtonRefs.current[focusTarget.id]?.focus();
    } else if (focusTarget.kind === 'scroll') {
      document.getElementById(focusTarget.id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      headerButtonRefs.current[focusTarget.id]?.focus({ preventScroll: true });
    }
    setFocusTarget(null);
  }, [focusTarget, openSections, openCards]);

  async function track(action: Promise<Resource>, previousResource: Resource) {
    const previousPending = groupResourcesByStatus(resourcesRef.current).pendiente;
    const resource = await action;
    const nextResources = resourcesRef.current.map((item) => (item.id === resource.id ? resource : item));
    const nextGrouped = groupResourcesByStatus(nextResources);

    setState((current) => replaceResource(current, resource));
    setDirtyCards((prev) => ({ ...prev, [resource.id]: false }));
    setCloseWarnings((prev) => ({ ...prev, [resource.id]: false }));

    if (previousResource.status === 'pendiente' && (resource.status === 'aprobado' || resource.status === 'descartado')) {
      setOpenCards((prev) => ({ ...prev, [resource.id]: false }));
      const nextId = nextPendingFocusId(previousPending, nextGrouped.pendiente, resource.id);
      if (nextId) {
        setFocusTarget({ kind: 'card', id: nextId });
      } else if (nextGrouped.aprobado.length > 0) {
        setFocusTarget({ kind: 'all-reviewed' });
      }
    } else if (previousResource.status !== 'pendiente' && resource.status === 'pendiente') {
      setOpenSections((prev) => ({ ...prev, pendiente: true }));
      setOpenCards((prev) => ({ ...prev, [resource.id]: true }));
      setFocusTarget({ kind: 'card', id: resource.id });
    }

    fetchDuplicationReport();
    return resource;
  }

  /** REV-C12: si falla, el error vuelve al editor, que muestra el motivo y conserva el recurso (REV-C13). */
  async function regenerate(current: Resource) {
    let result = await regenerateResource(token, current);
    if (result.status === 'running') {
      // D10: Generación sigue en segundo plano; se consulta el estado hasta que termine.
      setNotice({ text: regenerationProgressNotice(), warn: false });
      const final = await waitForRegeneration(
        () => getRegenerationStatus(token, current), undefined, undefined, () => left.current,
      );
      if (final === null) {
        setNotice({ text: regenerationNotice(result), warn: false });
        return;
      }
      if (final.status === 'failed') {
        setNotice({ text: regenerationFailureNotice(final), warn: true });
        return;
      }
      result = { ...final, status: 'succeeded' };
    }
    const text = regenerationNotice(result);
    setNotice({ text, warn: false });
    try {
      const updatedList = await listResources(token, unitId);
      setState(listLoaded(updatedList));
      setDirtyCards((prev) => ({ ...prev, [current.id]: false }));
      setCloseWarnings((prev) => ({ ...prev, [current.id]: false }));
      setOpenCards((prev) => {
        const next = { ...prev };
        delete next[current.id];
        return next;
      });
      fetchDuplicationReport();
      setRemounts((counts) => ({ ...counts, [current.id]: (counts[current.id] ?? 0) + 1 }));
    } catch {
      setNotice({ text: text + ' No se pudo actualizar la lista: vuelve a cargar la página.', warn: true });
    }
  }

  function toggleSection(status: ReviewStatus, sectionResources: Resource[]) {
    const currentlyOpen = openSections[status];
    if (currentlyOpen) {
      const dirtyInSection = sectionResources.filter((item) => dirtyCards[item.id]);
      if (dirtyInSection.length > 0) {
        setSectionBlockedNotice((prev) => ({ ...prev, [status]: true }));
        setCloseWarnings((prev) => {
          const next = { ...prev };
          for (const item of dirtyInSection) next[item.id] = true;
          return next;
        });
        return;
      }
    }
    setSectionBlockedNotice((prev) => ({ ...prev, [status]: false }));
    setOpenSections((prev) => ({ ...prev, [status]: !currentlyOpen }));
  }

  function openAllInSection(status: ReviewStatus, sectionResources: Resource[]) {
    setSectionBlockedNotice((prev) => ({ ...prev, [status]: false }));
    setOpenSections((prev) => ({ ...prev, [status]: true }));
    setOpenCards((prev) => {
      const next = { ...prev };
      for (const item of sectionResources) next[item.id] = true;
      return next;
    });
    setCloseWarnings((prev) => {
      const next = { ...prev };
      for (const item of sectionResources) next[item.id] = false;
      return next;
    });
  }

  function closeAllInSection(sectionResources: Resource[]) {
    const { nextOpen, blockedIds } = closeSectionCards(sectionResources, openCards, dirtyCards);
    setOpenCards(nextOpen);
    if (blockedIds.length > 0) {
      setCloseWarnings((prev) => {
        const next = { ...prev };
        for (const id of blockedIds) next[id] = true;
        return next;
      });
    }
  }

  function toggleCard(resource: Resource) {
    const currentlyOpen = isCardOpen(openCards, resource);
    if (currentlyOpen && dirtyCards[resource.id]) {
      setCloseWarnings((prev) => ({ ...prev, [resource.id]: true }));
      return;
    }
    setCloseWarnings((prev) => ({ ...prev, [resource.id]: false }));
    setOpenCards((prev) => ({ ...prev, [resource.id]: !currentlyOpen }));
  }

  function handleDirtyChange(resourceId: string, dirty: boolean) {
    setDirtyCards((prev) => {
      if (Boolean(prev[resourceId]) === dirty) return prev;
      return { ...prev, [resourceId]: dirty };
    });
    if (!dirty) {
      setCloseWarnings((prev) => (prev[resourceId] ? { ...prev, [resourceId]: false } : prev));
    }
  }

  function navigateToDuplicate(event: MouseEvent<HTMLAnchorElement>, resourceId: string) {
    event.preventDefault();
    if (state.status !== 'ready') return;
    const target = state.resources.find((r) => r.id === resourceId);
    if (!target) return;
    setOpenSections((prev) => ({ ...prev, [target.status]: true }));
    setOpenCards((prev) => ({ ...prev, [resourceId]: true }));
    setFocusTarget({ kind: 'scroll', id: resourceId });
  }

  const message = listMessage(state);
  const grouped = state.status === 'ready' ? groupResourcesByStatus(state.resources) : null;
  const flaggedPairs = duplicationReport?.flaggedPairs ?? [];
  const withinUnitPairs = flaggedPairs.filter((pair) => !pair.crossUnit);
  const crossUnitPairs = flaggedPairs.filter((pair) => pair.crossUnit === true);
  const resourceTitleById = (id: string) => {
    const match = state.status === 'ready' ? state.resources.find((r) => r.id === id) : null;
    return match ? `«${match.title}»` : `Recurso ${id}`;
  };

  return (
    <section className="stack">
      <h2 className="h2">Revisión</h2>
      {message && (
        <p className={state.status === 'error' ? 'alert alert--warn' : 'muted'} role={state.status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      {notice && (
        <p className={notice.warn ? 'alert alert--warn' : 'alert'} role={notice.warn ? 'alert' : 'status'}>{notice.text}</p>
      )}
      {withinUnitPairs.length > 0 && (
        <aside className="duplication-warning" role="region" aria-label="Aviso de posible contenido repetido">
          <p className="duplication-warning__title">Aviso: posible contenido repetido</p>
          <ul className="duplication-warning__list">
            {withinUnitPairs.map((pair, idx) => {
              const resA = state.status === 'ready' ? state.resources.find((r) => r.id === pair.resourceIdA) : null;
              const resB = state.status === 'ready' ? state.resources.find((r) => r.id === pair.resourceIdB) : null;
              const titleA = resA ? `«${resA.title}»` : `Recurso ${pair.resourceIdA}`;
              const titleB = resB ? `«${resB.title}»` : `Recurso ${pair.resourceIdB}`;
              const pct = Math.round(pair.score * 100);
              const label = pair.scope === 'question' ? 'pregunta repetida' : 'contenido repetido';
              return (
                <li key={`${pair.resourceIdA}-${pair.resourceIdB}-${idx}`} className="duplication-warning__item">
                  <span>
                    Posible {label} entre {titleA} y {titleB} (similitud {pct} %)
                  </span>
                  <div className="duplication-warning__excerpt">
                    <p>Extracto A: {pair.excerptA}</p>
                    <p>Extracto B: {pair.excerptB}</p>
                  </div>
                  <div className="duplication-warning__links">
                    <a
                      href={`#${pair.resourceIdA}`}
                      className="duplication-warning__link"
                      onClick={(event) => navigateToDuplicate(event, pair.resourceIdA)}
                    >
                      Ir a {titleA}
                    </a>
                    <a
                      href={`#${pair.resourceIdB}`}
                      className="duplication-warning__link"
                      onClick={(event) => navigateToDuplicate(event, pair.resourceIdB)}
                    >
                      Ir a {titleB}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
      {crossUnitPairs.length > 0 && (
        <aside
          className="duplication-warning duplication-warning--cross-unit"
          role="region"
          aria-label="Aviso de contenido repetido en otras unidades"
        >
          <p className="duplication-warning__title">Posible contenido repetido en otras unidades</p>
          <ul className="duplication-warning__list">
            {crossUnitPairs.map((pair, idx) => {
              const titleA = resourceTitleById(pair.resourceIdA);
              const unitTitleB = pair.unitTitleB ?? pair.unitIdB ?? 'otra unidad';
              const pct = Math.round(pair.score * 100);
              return (
                <li
                  key={`${pair.resourceIdA}-${pair.unitIdB ?? 'unit'}-${pair.resourceIdB}-${idx}`}
                  className="duplication-warning__item"
                >
                  <span>
                    Se parece a un recurso de la unidad «{unitTitleB}» ({pct} %): {titleA}
                  </span>
                  <div className="duplication-warning__excerpt">
                    <p>Extracto A: {pair.excerptA}</p>
                    <p>Extracto B: {pair.excerptB}</p>
                  </div>
                  <div className="duplication-warning__links">
                    <a
                      href={`#${pair.resourceIdA}`}
                      className="duplication-warning__link"
                      onClick={(event) => navigateToDuplicate(event, pair.resourceIdA)}
                    >
                      Ir a {titleA}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
      {grouped && state.status === 'ready' && state.resources.length > 0 && (
        <div className="stack stack--loose">
          <p className="review-summary-bar" aria-label="Resumen de recursos por estado">
            Pendientes ({grouped.pendiente.length}) · Aprobados ({grouped.aprobado.length}) · Descartados ({grouped.descartado.length})
          </p>

          {grouped.pendiente.length === 0 && grouped.aprobado.length > 0 && (
            <div ref={allReviewedRef} tabIndex={-1} className="alert review-all-done" role="status">
              <p>
                Todo revisado. Ya puedes ir a <ExportTabLink href={exportHref} />.
              </p>
            </div>
          )}

          {REVIEW_SECTIONS.map((section) => {
            const sectionResources = grouped[section.status];
            const sectionOpen = openSections[section.status];
            const headingId = `review-section-${section.status}-heading`;
            const bodyId = `review-section-${section.status}-body`;

            return (
              <section key={section.status} className="review-section stack" aria-labelledby={headingId}>
                <div className="review-section__header">
                  <h3 id={headingId} className="review-section__heading">
                    <button
                      type="button"
                      className="review-section__toggle"
                      aria-expanded={sectionOpen}
                      aria-controls={bodyId}
                      onClick={() => toggleSection(section.status, sectionResources)}
                    >
                      <span className="review-section__chevron" aria-hidden="true">{sectionOpen ? '▾' : '▸'}</span>
                      {' '}
                      <span>{section.title}</span>
                      {' '}
                      <span className="review-count-badge">{sectionResources.length}</span>
                    </button>
                  </h3>
                  {sectionResources.length > 0 && (
                    <div className="review-section__actions">
                      <button
                        type="button"
                        className="btn review-section__action"
                        onClick={() => openAllInSection(section.status, sectionResources)}
                      >
                        Abrir todo
                      </button>
                      <button
                        type="button"
                        className="btn review-section__action"
                        onClick={() => closeAllInSection(sectionResources)}
                      >
                        Cerrar todo
                      </button>
                    </div>
                  )}
                </div>

                {sectionBlockedNotice[section.status] && (
                  <p className="alert alert--warn" role="alert">
                    Hay cambios sin guardar en esta sección. Guárdalos antes de plegarla.
                  </p>
                )}

                <div id={bodyId} hidden={!sectionOpen}>
                  {sectionOpen && (
                    sectionResources.length === 0 ? (
                      <p className="muted review-section__empty">{section.emptyMessage}</p>
                    ) : (
                      <div className="stack">
                        {sectionResources.map((resource) => (
                          <ResourceCard
                            key={`${resource.id}:${remounts[resource.id] ?? 0}`}
                            resource={resource}
                            isOpen={isCardOpen(openCards, resource)}
                            isDirty={Boolean(dirtyCards[resource.id])}
                            closeBlockedWarning={Boolean(closeWarnings[resource.id])}
                            headerButtonRef={(el) => { headerButtonRefs.current[resource.id] = el; }}
                            onToggle={() => toggleCard(resource)}
                            onDirtyChange={(dirty) => handleDirtyChange(resource.id, dirty)}
                            onSave={(draft) => track(saveResource(token, draft), resource)}
                            onReload={() => track(getResource(token, unitId, resource.id), resource)}
                            onRetry={(current) => track(retryVerification(token, current), resource)}
                            onGenerateMedia={(current) => track(regenerateMedia(token, current), resource)}
                            onRegenerate={regenerate}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
