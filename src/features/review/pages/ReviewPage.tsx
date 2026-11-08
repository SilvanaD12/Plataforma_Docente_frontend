import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { getResource, listResources, retryVerification, saveResource } from '../api/reviewApi';
import { ResourceEditor } from '../components/ResourceEditor';
import type { Resource } from '../model/resource';
import { listFailed, listLoaded, listMessage, replaceResource, type ReviewListState } from '../model/reviewList';

/**
 * Mientras CC-01 no agregue la sesión al contexto de la unidad, `token` y `onSessionExpired` pueden faltar.
 * Cuando estén en `UnitContext`, este tipo se reemplaza por `UnitContext`.
 */
type UnitSessionContext = UnitContext & { token?: string; onSessionExpired?: (token: string) => void };

/** Pestaña Revisión de la unidad. Lee la unidad y la sesión del contexto de `UnitLayout`. */
export function ReviewPage() {
  const { unit, token, onSessionExpired } = useOutletContext<UnitSessionContext>();
  if (!token) return <ReviewSessionMissing />;
  return <ReviewPageContent key={unit.id} token={token} unitId={unit.id} onSessionExpired={onSessionExpired ?? (() => {})} />;
}

export function ReviewSessionMissing() {
  return (
    <section className="card stack">
      <h2 className="h2">Revisión</h2>
      <p className="alert alert--warn" role="alert">No se encontró la sesión para cargar la revisión. Vuelve a entrar.</p>
    </section>
  );
}

interface ReviewPageContentProps {
  token: string;
  unitId: string;
  onSessionExpired: (token: string) => void;
}

export function ReviewPageContent({ token, unitId, onSessionExpired }: ReviewPageContentProps) {
  const [state, setState] = useState<ReviewListState>({ status: 'loading' });

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

  async function track(action: Promise<Resource>) {
    const resource = await action;
    setState((current) => replaceResource(current, resource));
    return resource;
  }

  const message = listMessage(state);
  return (
    <section className="stack">
      <h2 className="h2">Revisión</h2>
      {message && (
        <p className={state.status === 'error' ? 'alert alert--warn' : 'muted'} role={state.status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      {state.status === 'ready' && state.resources.map((resource) => (
        <ResourceEditor
          key={resource.id}
          resource={resource}
          onSave={(draft) => track(saveResource(token, draft))}
          onReload={() => track(getResource(token, unitId, resource.id))}
          onRetry={(current) => track(retryVerification(token, current))}
        />
      ))}
    </section>
  );
}
