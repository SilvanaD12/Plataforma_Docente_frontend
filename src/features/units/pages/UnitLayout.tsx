import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import type { UnitContext } from '../../../shared/types/courses';
import type { CoursesContext } from '../../courses/pages/CoursesLayout';
import '../unitNavigation.css';

const tabs = [
  { path: '.', label: 'Resumen' },
  { path: 'material', label: 'Material' },
  { path: 'generation', label: 'Generación' },
  { path: 'review', label: 'Revisión' },
  { path: 'export', label: 'Exportación' },
];

export function UnitLayout() {
  const { courseId, unitId } = useParams();
  const { courses, token, onSessionExpired } = useOutletContext<CoursesContext>();
  const course = courses.find(({ id }) => id === courseId);
  const unit = course?.units.find(({ id }) => id === unitId);

  if (!course || !unit) {
    return (
      <>
        <h1>No encontramos esta unidad</h1>
        <p><Link to="/courses">Volver a Mis cursos</Link></p>
      </>
    );
  }

  const context: UnitContext = { course, unit, token, onSessionExpired };
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
      <nav className="unit-tabs" aria-label="Secciones de la unidad">
        {tabs.map(({ path, label }) => <NavLink key={path} className="btn unit-tab" to={path} end>{label}</NavLink>)}
      </nav>
      <Outlet context={context} />
    </div>
  );
}
