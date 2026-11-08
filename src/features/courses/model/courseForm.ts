export const maxCourseUnits = 50;
const maxUnitOutcomes = 20;
const outcomePrefix = /^([A-Za-z]{1,4}[ -]?\d+(?:\.\d+)*)\s*[:.)-]\s+(.+)$/;

interface UnitForm {
  title: string;
  outcomes: string;
}

export interface CourseForm {
  code: string;
  name: string;
  term: string;
  summary: string;
  learningGoal: string;
  units: UnitForm[];
}

export function courseRequest(form: CourseForm) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    term: form.term.trim(),
    summary: form.summary.trim(),
    learningGoal: form.learningGoal.trim(),
    units: form.units.map(({ title, outcomes }) => ({
      title: title.trim(),
      outcomes: outcomes.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const match = line.match(outcomePrefix);
        return match ? { code: match[1].toUpperCase(), text: match[2].trim() } : { text: line };
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
    if (unit.outcomes.length > maxUnitOutcomes) return `La unidad ${number} admite hasta 20 resultados de aprendizaje.`;
    if (unit.outcomes.some(({ code, text }) => (code && code.length > 20) || text.length > 400)) {
      return `En la unidad ${number}, cada resultado admite 400 caracteres y su código, hasta 20.`;
    }
  }
  return null;
}
