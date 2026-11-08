import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ApiError, errorMessage } from '../../../shared/api/httpClient';
import type { Course } from '../../../shared/types/courses';
import { createCourse, listCourses, updateCourse } from '../api/coursesApi';
import type { CourseRequest } from '../model/courseForm';
import '../courses.css';

type CoursesState =
  | { status: 'loading' }
  | { status: 'ready'; courses: Course[] }
  | { status: 'error'; message: string };

interface CoursesLayoutProps {
  token: string;
  onSessionExpired: (token: string) => void;
}

export interface CoursesContext extends CoursesLayoutProps {
  courses: Course[];
  saveCourse: (course: CourseRequest, courseId?: string) => Promise<Course>;
}

export function CoursesLayout({ token, onSessionExpired }: CoursesLayoutProps) {
  const [state, setState] = useState<CoursesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listCourses(token)
      .then((courses) => {
        if (active) setState({ status: 'ready', courses });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          onSessionExpired(token);
          return;
        }
        setState({ status: 'error', message: errorMessage(cause) });
      });
    return () => { active = false; };
  }, [token, onSessionExpired, attempt]);

  async function saveCourse(course: CourseRequest, courseId?: string) {
    try {
      const saved = courseId ? await updateCourse(token, courseId, course) : await createCourse(token, course);
      setState((current) => {
        if (current.status !== 'ready') return current;
        const courses = courseId
          ? current.courses.map((item) => item.id === courseId ? saved : item)
          : [...current.courses, saved];
        return { status: 'ready', courses };
      });
      return saved;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired(token);
      throw cause;
    }
  }

  if (state.status === 'ready') {
    return <Outlet context={{ courses: state.courses, saveCourse, token, onSessionExpired } satisfies CoursesContext} />;
  }

  return (
    <>
      <h1>Mis cursos</h1>
      {state.status === 'loading' ? (
        <p className="muted" role="status">Cargando tus cursos…</p>
      ) : (
        <div className="card">
          <p className="alert alert--warn" role="alert">{state.message}</p>
          <div>
            <button className="btn" type="button" onClick={() => {
              setState({ status: 'loading' });
              setAttempt((current) => current + 1);
            }}>Reintentar</button>
          </div>
        </div>
      )}
    </>
  );
}
