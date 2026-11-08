import { request } from '../../../shared/api/httpClient';
import type { Course } from '../../../shared/types/courses';
import type { CourseRequest } from '../model/courseForm';

export function listCourses(token: string) {
  return request<Course[]>('/courses', 'GET', undefined, token);
}

export function createCourse(token: string, course: CourseRequest) {
  return request<Course>('/courses', 'POST', course, token);
}

export function updateCourse(token: string, courseId: string, course: CourseRequest) {
  return request<Course>('/courses/' + encodeURIComponent(courseId), 'PUT', course, token);
}

export function deleteCourse(token: string, courseId: string) {
  return request<void>('/courses/' + encodeURIComponent(courseId), 'DELETE', undefined, token);
}
