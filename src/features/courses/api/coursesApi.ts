import { request } from '../../../shared/api/httpClient';
import type { Course } from '../../../shared/types/courses';
import type { CourseRequest } from '../model/courseForm';

export function listCourses(token: string) {
  return request<Course[]>('/courses', 'GET', undefined, token);
}

export function createCourse(token: string, course: CourseRequest) {
  return request<Course>('/courses', 'POST', course, token);
}
