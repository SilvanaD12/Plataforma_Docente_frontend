import { Link, useOutletContext } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';

export function UnitOverviewPage() {
  const { course, unit } = useOutletContext<UnitContext>();

  return (
    <div className="stack stack--loose">
      <nav className="course-breadcrumb" aria-label="Ruta de la unidad">
        <Link to="/courses">Mis cursos</Link>
        <span aria-hidden="true">/</span>
        <Link to={'/courses/' + encodeURIComponent(course.id)}>{course.name}</Link>
      </nav>
      <header className="stack course-heading">
        <p className="overline">Unidad {unit.number}</p>
        <h1>{unit.title}</h1>
      </header>
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
    </div>
  );
}
