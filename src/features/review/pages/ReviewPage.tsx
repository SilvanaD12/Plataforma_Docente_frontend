import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import { getResource, listResources, regenerateMedia, retryVerification, saveResource } from '../api/reviewApi';
import { ResourceEditor } from '../components/ResourceEditor';
import type { Resource } from '../model/resource';
import { listFailed, listLoaded, listMessage, replaceResource, type ReviewListState } from '../model/reviewList';

/** Pestaña Revisión de la unidad. Lee la unidad y la sesión del contexto de `UnitLayout`. */
export function ReviewPage() {
  const { unit, token, onSessionExpired } = useOutletContext<UnitContext>();
  return <ReviewPageContent key={unit.id} token={token} unitId={unit.id} onSessionExpired={onSessionExpired} />;
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
          onGenerateMedia={(current) => track(regenerateMedia(token, current))}
        />
      ))}
    </section>
  );
}
