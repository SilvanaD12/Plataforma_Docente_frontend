import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ApiError } from '../../../shared/api/httpClient';
import type { UnitContext } from '../../../shared/types/courses';
import { materialsApi } from '../../materials/api/materialsApi';
import { listResources } from '../../review/api/reviewApi';

interface UnitProgress {
  materials: number;
  processed: number;
  pending: number;
  approved: number;
}

function nextStep(progress: UnitProgress) {
  if (progress.pending) return { to: 'review', label: 'Revisar recursos pendientes' };
  if (progress.approved) return { to: 'export', label: 'Ver opciones de exportación' };
  if (progress.processed) return { to: 'generation', label: 'Ir a Generación' };
  if (progress.materials) return { to: 'material', label: 'Procesar material' };
  return { to: 'material', label: 'Añadir material' };
}

function UnitProgressPanel({ unit, token, onSessionExpired }: UnitContext) {
  const [state, setState] = useState<UnitProgress | 'loading' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const unitId = unit.id;

  useEffect(() => {
    let active = true;
    Promise.all([materialsApi.listDocuments(token), listResources(token, unitId)])
      .then(([documents, resources]) => {
        if (!active) return;
        const materials = documents.filter((document) => document.unitId === unitId);
        setState({
          materials: materials.length,
          processed: materials.filter(({ status }) => status === 'procesado').length,
          pending: resources.filter(({ status }) => status === 'pendiente').length,
          approved: resources.filter(({ status }) => status === 'aprobado').length,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired(token);
        setState('error');
      });
    return () => { active = false; };
  }, [token, unitId, onSessionExpired, attempt]);

  const step = typeof state === 'object' ? nextStep(state) : null;
  return (
    <section className="card stack" aria-labelledby="unit-progress">
      <h2 className="h2" id="unit-progress">Progreso de la unidad</h2>
      {state === 'loading' && <p role="status">Cargando progreso…</p>}
      {state === 'error' && (
        <div>
          <p role="alert">No se pudo consultar el progreso de la unidad.</p>
          <button className="btn" type="button" onClick={() => {
            setState('loading');
            setAttempt((current) => current + 1);
          }}>Reintentar</button>
        </div>
      )}
      {typeof state === 'object' && step && (
        <>
          <dl className="unit-progress-metrics">
            <div>
              <dt>Materiales</dt>
              <dd>{state.materials} <span className="muted">({state.processed} {state.processed === 1 ? 'procesado' : 'procesados'})</span></dd>
            </div>
            <div><dt>Recursos pendientes</dt><dd>{state.pending}</dd></div>
            <div><dt>Recursos aprobados</dt><dd>{state.approved}</dd></div>
          </dl>
          <div className="stack">
            <h3 className="h2">Siguiente paso sugerido</h3>
            <div><Link className="btn btn--primary" to={step.to}>{step.label}</Link></div>
          </div>
        </>
      )}
    </section>
  );
}

export function UnitOverviewPage() {
  const context = useOutletContext<UnitContext>();
  const { unit } = context;

  return (
    <>
      <section className="card" aria-labelledby="unit-outcomes">
        <h2 className="h2" id="unit-outcomes">Resultados de aprendizaje</h2>
        {unit.outcomes.length === 0 ? (
          <p className="muted">Esta unidad todavía no tiene resultados registrados.</p>
        ) : (
          <ul className="outcome-list">
            {unit.outcomes.map((outcome) => (
              <li key={outcome.id}>{outcome.code && <strong>{outcome.code} </strong>}{outcome.text}</li>
            ))}
          </ul>
        )}
      </section>
      <UnitProgressPanel key={unit.id} {...context} />
    </>
  );
}
