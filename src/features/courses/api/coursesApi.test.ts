import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Course } from '../../../shared/types/courses';
import { listCourses } from './coursesApi';

afterEach(() => vi.unstubAllGlobals());

describe('API de cursos', () => {
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
});
