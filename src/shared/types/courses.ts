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

export interface Course {
  id: string;
  code: string;
  name: string;
  term: string;
  summary: string | null;
  learningGoal: string | null;
  units: Unit[];
}

export interface UnitContext {
  course: Course;
  unit: Unit;
  token: string;
  onSessionExpired: (token: string) => void;
}
