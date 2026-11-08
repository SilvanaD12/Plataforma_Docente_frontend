import { useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/httpClient';
import type { CoursesContext } from './CoursesLayout';

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { courses, removeCourse } = useOutletContext<CoursesContext>();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const course = courses.find(({ id }) => id === courseId);

  if (!course) {
    return (
      <>
        <h1>No encontramos este curso</h1>
        <p><Link to="/courses">Volver a Mis cursos</Link></p>
      </>
    );
  }

  async function confirmDeletion(courseId: string) {
    const confirmation = dialog.current;
    if (!confirmation?.open || inFlight.current) return;

    inFlight.current = true;
    setDeleting(true);
    setError('');
    try {
      await removeCourse(courseId);
      if (dialog.current === confirmation) {
        navigate('/courses', { replace: true, state: { courseDeleted: true } });
      }
    } catch (cause) {
      if (dialog.current === confirmation) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  }

  return (
    <div className="stack stack--loose">
      <nav aria-label="Ruta del curso"><Link to="/courses">Mis cursos</Link></nav>
      <header className="course-page-header">
        <div className="stack course-heading">
          <p className="overline">{course.code} · {course.term}</p>
          <h1>{course.name}</h1>
        </div>
        <div className="course-actions">
          <Link className="btn" to="edit">Editar curso</Link>
          <button className="btn" type="button" disabled={deleting} onClick={() => {
            setError('');
            dialog.current?.showModal();
          }}>Eliminar curso</button>
        </div>
      </header>
      <dialog
        key={course.id}
        ref={dialog}
        className="course-delete-dialog"
        aria-labelledby="delete-course-title"
        aria-describedby="delete-course-description"
        onCancel={(event) => { if (inFlight.current) event.preventDefault(); }}
      >
        <div className="stack">
          <h2 className="h2" id="delete-course-title">¿Eliminar este curso?</h2>
          <p id="delete-course-description">
            Se eliminará «{course.name}» junto con sus unidades y materiales. Se conservará el historial de descargas.
          </p>
          {error && <p className="alert alert--warn" role="alert">{error}</p>}
          <div className="course-actions">
            <button className="btn" type="button" disabled={deleting} onClick={() => dialog.current?.close()}>
              Cancelar
            </button>
            <button className="btn" type="button" disabled={deleting} aria-busy={deleting}
              onClick={() => void confirmDeletion(course.id)}>
              {deleting ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </div>
        </div>
      </dialog>
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
