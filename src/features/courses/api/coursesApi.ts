import { request } from '../../../shared/api/httpClient';
import type { Course } from '../../../shared/types/courses';

export function listCourses(token: string) {
  return request<Course[]>('/courses', 'GET', undefined, token);
}
