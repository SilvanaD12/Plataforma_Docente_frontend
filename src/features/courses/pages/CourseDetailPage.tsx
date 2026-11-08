import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { Course } from '../../../shared/types/courses';

export function CourseDetailPage() {
  const { courseId } = useParams();
  const courses = useOutletContext<Course[]>();
  const course = courses.find(({ id }) => id === courseId);

  if (!course) {
    return (
      <>
        <h1>No encontramos este curso</h1>
        <p><Link to="/courses">Volver a Mis cursos</Link></p>
      </>
    );
  }

  return (
    <div className="stack stack--loose">
      <nav aria-label="Ruta del curso"><Link to="/courses">Mis cursos</Link></nav>
      <header className="stack course-heading">
        <p className="overline">{course.code} · {course.term}</p>
        <h1>{course.name}</h1>
      </header>
      {(course.summary || course.learningGoal) && (
        <div className="card">
          {course.summary && <div><h2 className="overline">Sumilla</h2><p>{course.summary}</p></div>}
          {course.learningGoal && <div><h2 className="overline">Logro del curso</h2><p>{course.learningGoal}</p></div>}
        </div>
      )}
      <section className="stack" aria-labelledby="course-units">
        <h2 className="h2" id="course-units">Unidades</h2>
        {course.units.length === 0 && <p className="muted">Este curso todavía no tiene unidades.</p>}
        {course.units.map((unit) => (
          <article className="card unit-card" key={unit.id}>
            <div className="unit-card__head">
              <div>
                <p className="overline">Unidad {unit.number}</p>
                <h3 className="title">{unit.title}</h3>
              </div>
              <Link className="btn btn--primary" to={'units/' + encodeURIComponent(unit.id)}>Abrir unidad</Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
