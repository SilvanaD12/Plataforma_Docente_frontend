import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom';
import type { Course, UnitContext } from '../../../shared/types/courses';

export function UnitLayout() {
  const { courseId, unitId } = useParams();
  const courses = useOutletContext<Course[]>();
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

  const context: UnitContext = { course, unit };
  return <Outlet context={context} />;
}
