import { post } from './nextPhaseClient';

export type ExamStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export type Examination = {
  id: number;
  title: string;
  title_ar: string | null;
  description: string | null;
  exam_type: string;
  class_id: number | null;
  section_id: number | null;
  subject_id: number | null;
  exam_category_id: number | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  room: string | null;
  total_marks: number;
  passing_marks: number | null;
  weight: number | null;
  instructions: string | null;
  status: ExamStatus;
  published_at: string | null;
  graded_count: number | null;
  roster_count: number | null;
};

export type ExamRosterRow = {
  student_id: number;
  name: string;
  student_number: string | null;
  marks_obtained: number | null;
  is_absent: boolean;
  remarks: string | null;
  released: boolean;
};

export default {
  list: (filters: Record<string, unknown> = {}) =>
    post<{
      examinations: Examination[];
      exam_types: string[];
      statuses: ExamStatus[];
      summary: { total: number; draft: number; published: number; upcoming: number };
    }>('teacher_examination_list', filters),

  create: (body: Record<string, unknown>) =>
    post<{ examination: Examination }>('teacher_examination_store', body),

  update: (examination_id: number, body: Record<string, unknown>) =>
    post<{ examination: Examination }>('teacher_examination_update', { examination_id, ...body }),

  setStatus: (examination_id: number, status: ExamStatus) =>
    post<{ examination: Examination }>('teacher_examination_publish', { examination_id, status }),

  remove: (examination_id: number) =>
    post<{ message: string }>('teacher_examination_delete', { examination_id }),

  results: (examination_id: number) =>
    post<{ examination: Examination; roster: ExamRosterRow[] }>('teacher_examination_results', { examination_id }),

  grade: (
    examination_id: number,
    results: Array<{ student_id: number; marks_obtained: number | null; is_absent?: boolean; remarks?: string }>,
    release = false,
  ) => post<{ saved: number; message: string }>('teacher_examination_grade', { examination_id, results, release }),
};
