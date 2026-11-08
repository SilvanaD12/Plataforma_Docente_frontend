import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Course } from '../../../shared/types/courses';
import { createCourse, deleteCourse, listCourses, updateCourse } from './coursesApi';

const newCourse = {
  code: 'RED-301', name: 'Redes', term: '2026-II', summary: '', learningGoal: '',
  units: [{ title: 'Transporte', outcomes: [] }],
};

afterEach(() => vi.unstubAllGlobals());

describe('API de cursos', () => {
  it('elimina el curso con el token y acepta una respuesta 204 vacía', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteCourse('token-docente', 'curso/1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses/curso%2F1', expect.objectContaining({
      method: 'DELETE', body: undefined,
    }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-docente');
  });

  it('carga los cursos y sus unidades con el token de la sesión', async () => {
    const courses: Course[] = [{
      id: 'curso-1',
      code: 'RED-301',
      name: 'Redes',
      term: '2026-II',
      summary: null,
      learningGoal: null,
      units: [{ id: 'unidad-1', courseId: 'curso-1', number: 1, title: 'Transporte', outcomes: [] }],
    }];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(courses));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listCourses('token-docente')).resolves.toEqual(courses);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses', expect.objectContaining({ method: 'GET' }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-docente');
  });

  it('distingue una sesión vencida para devolver al docente al acceso', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ error: { message: 'La sesión venció.' } }, { status: 401 }),
    ));

    await expect(listCourses('token-vencido')).rejects.toMatchObject({ status: 401, message: 'La sesión venció.' });
  });

  it('envía el curso con sus unidades y devuelve los identificadores del servidor', async () => {
    const saved = {
      ...newCourse,
      id: 'curso-1',
      units: [{ ...newCourse.units[0], id: 'unidad-1', courseId: 'curso-1', number: 1 }],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(saved, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCourse('token-docente', newCourse)).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses', expect.objectContaining({
      method: 'POST', body: JSON.stringify(newCourse),
    }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-docente');
  });

  it('conserva el mensaje de conflicto si el código ya existe', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ error: { message: 'Ya existe un curso con ese código.' } }, { status: 409 }),
    ));

    await expect(createCourse('token-docente', newCourse)).rejects.toMatchObject({
      status: 409, message: 'Ya existe un curso con ese código.',
    });
  });

  it('actualiza el curso existente con sus identificadores mediante PUT', async () => {
    const course = { ...newCourse, units: [{ ...newCourse.units[0], id: 'unidad-1' }] };
    const saved = { ...course, id: 'curso-1' };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(saved));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateCourse('token-docente', 'curso-1', course)).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/courses/curso-1', expect.objectContaining({
      method: 'PUT', body: JSON.stringify(course),
    }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-docente');
  });
});
