import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Config from '../../src/config/api';

const c: any = Config as any;
const base = (c.API_BASE_URL || c.BASE_URL || c.API_URL || '').replace(/\/$/, '');

async function p(x: string, b: any = {}) {
  let t = null;
  for (const k of ['token', 'auth_token', 'authToken', 'user_token']) {
    t = await AsyncStorage.getItem(k);
    if (t) break;
  }
  const r = await fetch(base + '/' + x, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(t ? { Authorization: 'Bearer ' + t } : {}),
    },
    body: JSON.stringify(b),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || 'Request failed');
  return j;
}

// Backend: AcademicCompletionEngineController (Traits-free controller, spec
// §4.19 Graduation/Completion). Requirement sets are school-scoped and
// versioned by is_active; evaluate() is read-only and safe to call as often
// as needed, save() persists an evaluation_snapshot + audit row, approve()
// moves a saved snapshot to eligible/approved/deferred/rejected.
export default {
  requirements: () => p('admin_graduation_requirements'),
  saveRequirement: (b: {
    id?: number;
    name: string;
    curriculum_id?: number | null;
    requirements: {
      minimum_credits?: number;
      minimum_gpa?: number;
      maximum_failed_subjects?: number;
      minimum_attendance?: number;
      required_subject_ids?: number[];
    };
    effective_from?: string;
  }) => p('admin_graduation_requirement_save', b),
  evaluate: (student_id: number, completion_type: string = 'graduation') =>
    p('admin_graduation_evaluate', { student_id, completion_type }),
  save: (b: { student_id: number; completion_type?: string; remarks?: string }) =>
    p('admin_graduation_save', b),
  approve: (b: { id: number; decision: string; reason?: string }) =>
    p('admin_graduation_approve', b),
  list: () => p('admin_graduation_list'),
  audit: (id: number) => p('admin_graduation_audit', { id }),
};
