import type { ActivityType } from '../../../shared/types/courses';

export const maxCourseUnits = 50;
export const maxUnitOutcomes = 20;

interface UnitForm {
  id?: string;
  title: string;
  outcomes: { id?: string; code: string; text: string }[];
}

export interface CourseForm {
  code: string;
  name: string;
  term: string;
  summary: string;
  learningGoal: string;
  educationLevel?: string;
  academicCycle?: string;
  activityType?: ActivityType | '';
  units: UnitForm[];
  removedUnitIds?: string[];
}

export function courseRequest(form: CourseForm) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    term: form.term.trim(),
    summary: form.summary.trim(),
    learningGoal: form.learningGoal.trim(),
    ...(form.educationLevel === undefined ? {} : { educationLevel: form.educationLevel.trim() }),
    ...(form.academicCycle === undefined ? {} : { academicCycle: form.academicCycle.trim() }),
    ...(form.activityType === undefined ? {} : { activityType: form.activityType }),
    ...(form.removedUnitIds?.length ? { removedUnitIds: form.removedUnitIds } : {}),
    units: form.units.map(({ id, title, outcomes }) => ({
      ...(id ? { id } : {}),
      title: title.trim(),
      outcomes: outcomes.map(({ id, code, text }) => {
        const trimmedCode = code.trim();
        return {
          ...(id ? { id } : {}),
          ...(trimmedCode ? { code: trimmedCode } : {}),
          text: text.trim(),
        };
      }),
    })),
  };
}

export type CourseRequest = ReturnType<typeof courseRequest>;

export function courseFormProblem(course: CourseRequest): string | null {
  if (!course.code || !course.name || !course.term) return 'Completa el código, el nombre y el periodo del curso.';
  if (course.units.length === 0) return 'Agrega al menos una unidad.';
  if (course.units.length > maxCourseUnits) return 'Puedes agregar hasta 50 unidades.';
  for (const [index, unit] of course.units.entries()) {
    const number = index + 1;
    if (!unit.title) return `Escribe el título de la unidad ${number}.`;
    if (unit.outcomes.some(({ text }) => !text)) return `Completa los resultados de la unidad ${number}.`;
    if (unit.outcomes.length > maxUnitOutcomes) return `La unidad ${number} admite hasta 20 resultados de aprendizaje.`;
    if (unit.outcomes.some(({ code, text }) => (code && code.length > 20) || text.length > 400)) {
      return `En la unidad ${number}, cada resultado admite 400 caracteres y su código, hasta 20.`;
    }
  }
  return null;
}
