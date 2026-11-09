import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import {
  getRegenerationStatus,
  getResource,
  listResources,
  regenerateMedia,
  regenerateResource,
  retryVerification,
  saveResource,
} from '../api/reviewApi';
import { ResourceEditor } from '../components/ResourceEditor';
import {
  regenerationFailureNotice,
  regenerationNotice,
  regenerationProgressNotice,
  waitForRegeneration,
} from '../model/regenerationView';
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
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(null);
  // Al salir de la revisión se deja de consultar una regeneración en segundo plano.
  const left = useRef(false);
  useEffect(() => () => { left.current = true; }, []);
  // Cuántas veces se volvió a cargar el editor de cada recurso: solo el regenerado, para no perder otros borradores.
  const [remounts, setRemounts] = useState<Record<string, number>>({});

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
      setState(listLoaded(await listResources(token, unitId)));
      setRemounts((counts) => ({ ...counts, [current.id]: (counts[current.id] ?? 0) + 1 }));
    } catch {
      setNotice({ text: text + ' No se pudo actualizar la lista: vuelve a cargar la página.', warn: true });
    }
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
      {notice && (
        <p className={notice.warn ? 'alert alert--warn' : 'alert'} role={notice.warn ? 'alert' : 'status'}>{notice.text}</p>
      )}
      {state.status === 'ready' && state.resources.map((resource) => (
        <ResourceEditor
          key={`${resource.id}:${remounts[resource.id] ?? 0}`}
          resource={resource}
          onSave={(draft) => track(saveResource(token, draft))}
          onReload={() => track(getResource(token, unitId, resource.id))}
          onRetry={(current) => track(retryVerification(token, current))}
          onGenerateMedia={(current) => track(regenerateMedia(token, current))}
          onRegenerate={regenerate}
        />
      ))}
    </section>
  );
}
