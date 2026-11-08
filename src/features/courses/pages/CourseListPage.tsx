import { Link, useOutletContext } from 'react-router-dom';
import type { CoursesContext } from './CoursesLayout';

export function CourseListPage() {
  const { courses } = useOutletContext<CoursesContext>();

  return (
    <div className="stack stack--loose">
      <header className="course-page-header">
        <div className="stack course-heading">
          <h1>Mis cursos</h1>
          <p className="muted">Entra a un curso para trabajar con sus unidades.</p>
        </div>
        <Link className="btn btn--primary" to="new">Nuevo curso</Link>
      </header>
      {courses.length === 0 ? (
        <section className="card" aria-labelledby="empty-courses">
          <h2 className="h2" id="empty-courses">Todavía no tienes cursos</h2>
          <p className="muted">Crea tu primer curso para empezar a trabajar con sus unidades.</p>
        </section>
      ) : (
        <div className="course-grid">
          {courses.map((course) => (
            <article className="card course-card" key={course.id}>
              <p className="overline">{course.code} · {course.term}</p>
              <h2 className="h2">{course.name}</h2>
              {course.summary && <p className="course-card__text">{course.summary}</p>}
              <p className="course-card__stats">
                {course.units.length} {course.units.length === 1 ? 'unidad' : 'unidades'}
              </p>
              <div>
                <Link className="btn btn--primary" to={encodeURIComponent(course.id)}>Entrar al curso</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
