export interface LearningOutcome {
  id: string;
  code: string | null;
  text: string;
}

export interface Unit {
  id: string;
  courseId: string;
  number: number;
  title: string;
  outcomes: LearningOutcome[];
}

export const activityTypeLabels = {
  course: 'Curso',
  workshop: 'Taller',
  conference: 'Conferencia',
} as const;

export type ActivityType = keyof typeof activityTypeLabels;

export interface Course {
  id: string;
  code: string;
  name: string;
  term: string;
  summary: string | null;
  learningGoal: string | null;
  educationLevel?: string | null;
  academicCycle?: string | null;
  activityType?: ActivityType | '' | null;
  units: Unit[];
}

export interface UnitContext {
  course: Course;
  unit: Unit;
  token: string;
  onSessionExpired: (token: string) => void;
}
