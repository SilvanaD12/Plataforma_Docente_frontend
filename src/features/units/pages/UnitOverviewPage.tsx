import { useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';

export function UnitOverviewPage() {
  const { unit } = useOutletContext<UnitContext>();

  return (
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
  );
}
