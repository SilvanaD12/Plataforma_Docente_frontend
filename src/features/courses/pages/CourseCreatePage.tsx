import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/httpClient';
import { courseFormProblem, courseRequest, maxCourseUnits } from '../model/courseForm';
import type { CoursesContext } from './CoursesLayout';

export function CourseCreatePage() {
  const { saveNewCourse } = useOutletContext<CoursesContext>();
  const navigate = useNavigate();
  const [unitKeys, setUnitKeys] = useState([1]);
  const nextUnitKey = useRef(2);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const request = courseRequest({
      code: value('code'),
      name: value('name'),
      term: value('term'),
      summary: value('summary'),
      learningGoal: value('learningGoal'),
      units: unitKeys.map((key) => ({ title: value(`title-${key}`), outcomes: value(`outcomes-${key}`) })),
    });
    const problem = courseFormProblem(request);
    if (problem) {
      setError(problem);
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const course = await saveNewCourse(request);
      if (mounted.current) navigate('/courses/' + encodeURIComponent(course.id), { replace: true });
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="stack stack--loose">
      <nav aria-label="Ruta del curso"><Link to="/courses">Mis cursos</Link></nav>
      <header className="stack course-heading">
        <h1>Nuevo curso</h1>
        <p className="muted">Registra los datos del curso y al menos una unidad.</p>
      </header>
      <form className="stack stack--loose" onSubmit={submit}>
        <section className="card" aria-labelledby="course-data">
          <h2 className="h2" id="course-data">Datos del curso</h2>
          <div className="course-form-grid">
            <label className="field"><span className="field__label">Código</span><input className="input" name="code" placeholder="RED-301" maxLength={30} required disabled={saving} /></label>
            <label className="field"><span className="field__label">Nombre del curso</span><input className="input" name="name" maxLength={150} required disabled={saving} /></label>
            <label className="field"><span className="field__label">Periodo</span><input className="input" name="term" placeholder="2026-II" maxLength={30} required disabled={saving} /></label>
          </div>
          <label className="field"><span className="field__label">Sumilla (opcional)</span><textarea className="input course-textarea" name="summary" rows={3} maxLength={3000} disabled={saving} /></label>
          <label className="field"><span className="field__label">Logro del curso (opcional)</span><textarea className="input course-textarea" name="learningGoal" rows={2} maxLength={1000} disabled={saving} /></label>
        </section>
        <section className="card" aria-labelledby="course-units">
          <h2 className="h2" id="course-units">Unidades y resultados de aprendizaje</h2>
          {unitKeys.map((key, index) => (
            <fieldset className="unit-fieldset" key={key} disabled={saving}>
              <legend className="unit-fieldset__legend">Unidad {index + 1}</legend>
              <label className="field"><span className="field__label">Título de la unidad</span><input className="input" name={`title-${key}`} maxLength={150} required /></label>
              <label className="field">
                <span className="field__label">Resultados de aprendizaje (opcional)</span>
                <textarea className="input course-textarea" name={`outcomes-${key}`} rows={3} aria-describedby={`outcomes-hint-${key}`} />
                <span className="field__hint" id={`outcomes-hint-${key}`}>Uno por línea. Puedes indicar un código, como «RA1.1: Compara protocolos».</span>
              </label>
              {unitKeys.length > 1 && (
                <div><button className="btn" type="button" onClick={() => setUnitKeys((current) => current.filter((unitKey) => unitKey !== key))}>Quitar unidad</button></div>
              )}
            </fieldset>
          ))}
          <div>
            <button className="btn" type="button" disabled={saving || unitKeys.length >= maxCourseUnits} onClick={() => {
              const key = nextUnitKey.current++;
              setUnitKeys((current) => [...current, key]);
            }}>Añadir unidad</button>
          </div>
        </section>
        {error && <p className="alert alert--warn" role="alert">{error}</p>}
        <div className="course-actions">
          <button className="btn btn--primary" type="submit" aria-busy={saving} disabled={saving}>{saving ? 'Guardando…' : 'Guardar curso'}</button>
          <button className="btn" type="button" disabled={saving} onClick={() => navigate('/courses')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
