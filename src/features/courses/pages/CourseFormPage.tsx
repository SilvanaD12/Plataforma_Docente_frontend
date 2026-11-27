import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import { courseFormProblem, courseRequest, maxCourseUnits, maxUnitOutcomes } from '../model/courseForm';
import { activityTypeLabels, type ActivityType, type Course } from '../../../shared/types/courses';
import type { CoursesContext } from './CoursesLayout';

export function CourseFormPage() {
  const { courseId } = useParams();
  const { courses, saveCourse } = useOutletContext<CoursesContext>();
  const course = courses.find(({ id }) => id === courseId);

  if (courseId && !course) {
    return (
      <>
        <h1>No encontramos este curso</h1>
        <p><Link to="/courses">Volver a Mis cursos</Link></p>
      </>
    );
  }

  return <CourseFormView key={course?.id ?? 'new'} course={course} saveCourse={saveCourse} />;
}

function CourseFormView({ course, saveCourse }: { course?: Course; saveCourse: CoursesContext['saveCourse'] }) {
  const navigate = useNavigate();
  const savedUnits = course?.units ?? [];
  const initialUnitCount = Math.max(1, savedUnits.length);
  const lastUnitNumber = savedUnits.reduce((latest, unit) => Math.max(latest, unit.number), 0);
  const [unitKeys, setUnitKeys] = useState(() => Array.from({ length: initialUnitCount }, (_, index) => index + 1));
  const [outcomeKeys, setOutcomeKeys] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(savedUnits.map((unit, index) => [index + 1, unit.outcomes.map((_, outcomeIndex) => outcomeIndex)])),
  );
  const nextUnitKey = useRef(initialUnitCount + 1);
  const cancelPath = course ? '/courses/' + encodeURIComponent(course.id) : '/courses';
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<{ name: string; message: string } | null>(null);

  function fieldAttributes(name: string) {
    const invalid = fieldError?.name === name;
    return {
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? `${name}-error` : undefined,
    };
  }

  function fieldMessage(name: string) {
    if (fieldError?.name !== name) return null;
    return <span className="alert alert--warn" id={`${name}-error`} role="alert">{fieldError.message}</span>;
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setFieldError(null);

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const request = courseRequest({
      code: value('code'),
      name: value('name'),
      term: value('term'),
      summary: value('summary'),
      learningGoal: value('learningGoal'),
      educationLevel: value('educationLevel'),
      academicCycle: value('academicCycle'),
      activityType: value('activityType') as ActivityType | '',
      units: unitKeys.map((key) => {
        const unit = savedUnits[key - 1];
        return {
          id: unit?.id,
          title: value(`title-${key}`),
          outcomes: (outcomeKeys[key] ?? []).map((outcomeKey) => ({
            id: unit?.outcomes[outcomeKey]?.id,
            code: value(`outcome-code-${key}-${outcomeKey}`),
            text: value(`outcome-text-${key}-${outcomeKey}`),
          })),
        };
      }),
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
      const saved = await saveCourse(request, course?.id);
      if (mounted.current) navigate('/courses/' + encodeURIComponent(saved.id), { replace: true });
    } catch (cause) {
      if (!mounted.current) return;
      const message = errorMessage(cause);

      if (cause instanceof ApiError && cause.status === 409 && Array.isArray(cause.details)) {
        const detail = cause.details[0];
        const key = Number.isInteger(detail?.unitIndex) ? unitKeys[detail.unitIndex] : undefined;

        if (key !== undefined && cause.code === 'DUPLICATE_UNIT_TITLE' && detail.field === 'title') {
          setFieldError({ name: `title-${key}`, message });
          return;
        }

        if (key !== undefined && cause.code === 'DUPLICATE_OUTCOME' && (detail.field === 'code' || detail.field === 'text')
            && Number.isInteger(detail.outcomeIndex) && detail.outcomeIndex >= 0) {
          const outcomeKey = outcomeKeys[key]?.[detail.outcomeIndex];
          if (outcomeKey !== undefined) {
            setFieldError({ name: `outcome-${detail.field}-${key}-${outcomeKey}`, message });
            return;
          }
        }
      }

      setError(message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="stack stack--loose">
      <nav aria-label="Ruta del curso"><Link to="/courses">Mis cursos</Link></nav>
      <header className="stack course-heading">
        <h1>{course ? 'Editar curso' : 'Nuevo curso'}</h1>
        <p className="muted">{course ? 'Actualiza los datos del curso y sus unidades.' : 'Registra los datos del curso y al menos una unidad.'}</p>
      </header>
      <form className="stack stack--loose" onSubmit={submit} onChange={() => setFieldError(null)}>
        <section className="card" aria-labelledby="course-data">
          <h2 className="h2" id="course-data">Datos del curso</h2>
          <div className="course-form-grid">
            <label className="field"><span className="field__label">Código</span><input className="input" name="code" defaultValue={course?.code ?? ''} placeholder="RED-301" maxLength={30} required disabled={saving} /></label>
            <label className="field"><span className="field__label">Nombre del curso</span><input className="input" name="name" defaultValue={course?.name ?? ''} maxLength={150} required disabled={saving} /></label>
            <label className="field"><span className="field__label">Periodo</span><input className="input" name="term" defaultValue={course?.term ?? ''} placeholder="2026-II" maxLength={30} required disabled={saving} /></label>
          </div>
          <div className="course-form-grid">
            <label className="field">
              <span className="field__label">Nivel educativo (opcional)</span>
              <input className="input" name="educationLevel" defaultValue={course?.educationLevel ?? ''} placeholder="Pregrado" maxLength={60} disabled={saving} />
            </label>
            <label className="field">
              <span className="field__label">Ciclo (opcional)</span>
              <input className="input" name="academicCycle" defaultValue={course?.academicCycle ?? ''} placeholder="7.º ciclo" maxLength={40} disabled={saving} />
            </label>
            <label className="field">
              <span className="field__label">Tipo de actividad (opcional)</span>
              <select className="input" name="activityType" defaultValue={course?.activityType ?? ''} disabled={saving}>
                <option value="">Sin especificar</option>
                {Object.entries(activityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span className="field__label">Sumilla (opcional)</span><textarea className="input course-textarea" name="summary" defaultValue={course?.summary ?? ''} rows={3} maxLength={3000} disabled={saving} /></label>
          <label className="field"><span className="field__label">Logro del curso (opcional)</span><textarea className="input course-textarea" name="learningGoal" defaultValue={course?.learningGoal ?? ''} rows={2} maxLength={1000} disabled={saving} /></label>
        </section>
        <section className="card" aria-labelledby="course-units">
          <h2 className="h2" id="course-units">Unidades y resultados de aprendizaje</h2>
          {unitKeys.map((key, index) => {
            const unit = savedUnits[key - 1];
            const rows = outcomeKeys[key] ?? [];
            const number = unit?.number ?? lastUnitNumber + index - savedUnits.length + 1;
            return (
              <fieldset className="unit-fieldset" key={key} disabled={saving}>
                <legend className="unit-fieldset__legend">Unidad {number}</legend>
                <label className="field"><span className="field__label">Título de la unidad</span><input className="input" name={`title-${key}`} defaultValue={unit?.title} maxLength={150} required {...fieldAttributes(`title-${key}`)} />{fieldMessage(`title-${key}`)}</label>
                {rows.map((outcomeKey, outcomeIndex) => {
                  const outcome = unit?.outcomes[outcomeKey];
                  const codeName = `outcome-code-${key}-${outcomeKey}`;
                  const textName = `outcome-text-${key}-${outcomeKey}`;
                  return (
                    <div key={outcomeKey}>
                      <div className="course-outcome">
                        <label className="field">
                          <span className="field__label">Código del resultado {outcomeIndex + 1} (opcional)</span>
                          <input className="input" name={codeName} defaultValue={outcome?.code ?? ''} maxLength={20} {...fieldAttributes(codeName)} />
                          {fieldMessage(codeName)}
                        </label>
                        <label className="field">
                          <span className="field__label">Resultado de aprendizaje {outcomeIndex + 1}</span>
                          <input className="input" name={textName} defaultValue={outcome?.text} maxLength={400} required {...fieldAttributes(textName)} />
                          {fieldMessage(textName)}
                        </label>
                      </div>
                      {!outcome && (
                        <button className="btn" type="button" aria-label={`Quitar resultado ${outcomeIndex + 1}`} onClick={() => {
                          setFieldError(null);
                          setOutcomeKeys((current) => ({
                            ...current,
                            [key]: current[key].filter((row) => row !== outcomeKey),
                          }));
                        }}>Quitar resultado</button>
                      )}
                    </div>
                  );
                })}
                <div>
                  <button className="btn" type="button" disabled={rows.length >= maxUnitOutcomes} onClick={() => {
                    setOutcomeKeys((current) => {
                      const existing = current[key] ?? [];
                      const last = existing[existing.length - 1] ?? -1;
                      return { ...current, [key]: [...existing, last + 1] };
                    });
                  }}>Añadir resultado</button>
                </div>
                {!unit && unitKeys.length > 1 && (
                  <div><button className="btn" type="button" onClick={() => setUnitKeys((current) => current.filter((unitKey) => unitKey !== key))}>Quitar unidad</button></div>
                )}
              </fieldset>
            );
          })}
          {course && <p className="field__hint">Puedes modificar las unidades guardadas y añadir otras. Las unidades guardadas conservan su vínculo con el material y los recursos.</p>}
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
          <button className="btn" type="button" disabled={saving} onClick={() => navigate(cancelPath)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
