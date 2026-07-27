import { ENDPOINTS } from '../config/api';
export type Schedule={id?:number;section_id:number;subject_id:number;teacher_id?:number|null;room_id?:number|null;day_of_week:number;start_time:string;end_time:string;status?:string};
async function req(token:string,path:string,init:RequestInit={}){const base=(ENDPOINTS as any).academicSchedules||`${(ENDPOINTS as any).me.replace(/\/me$/,'')}/academic/schedules`;const r=await fetch(base+path,{...init,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`Request failed (${r.status})`);return d}
export const scheduleApi={list:(t:string,q='')=>req(t,`?${q}`),create:(t:string,x:Schedule)=>req(t,'',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)}),update:(t:string,id:number,x:Partial<Schedule>)=>req(t,`/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)}),remove:(t:string,id:number)=>req(t,`/${id}`,{method:'DELETE'}),publish:(t:string)=>req(t,'/publish',{method:'POST'}),mine:(t:string)=>req(t,'/mine')};

// --- Real, backend-wired API used by screens/teachers/AcademicScheduleScreen.tsx ---
// The backend (AcademicScheduleController) is flat-POST style, not REST, and uses
// its own field names (start_time/end_time, period_label, integer day_of_week).
// These adapters translate between that and the shape this screen was built against.

import { API_BASE_URL } from '../config/api';

export type Day = 'sunday'|'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday';

export interface AcademicSchedule {
  id: number;
  code: string;
  day_of_week: Day;
  starts_at: string;
  ends_at: string;
  room_id?: number | null;
  section_id?: number | null;
  teacher_id?: number | null;
  meeting_type?: string;
}

const DAY_TO_INT: Record<Day, number> = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
const INT_TO_DAY: Day[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

async function schedulePost(token: string, endpoint: string, body: Record<string, any> = {}) {
  const r = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || `Request failed (${r.status})`);
  return d;
}

function fromBackendSchedule(row: any): AcademicSchedule {
  return {
    id: row.id,
    code: row.period_label || `SCH-${row.id}`,
    day_of_week: INT_TO_DAY[row.day_of_week] ?? 'monday',
    starts_at: row.start_time,
    ends_at: row.end_time,
    room_id: row.room_id ?? null,
    section_id: row.section_id ?? null,
    teacher_id: row.teacher_id ?? null,
    meeting_type: row.status,
  };
}

/** POST /admin_schedule_list */
export async function listSchedules(token: string, day?: Day): Promise<AcademicSchedule[]> {
  const body: Record<string, any> = {};
  if (day) body.day_of_week = DAY_TO_INT[day];
  const data = await schedulePost(token, 'admin_schedule_list', body);
  return (data.schedules || []).map(fromBackendSchedule);
}

/** POST /admin_schedule_store */
export async function saveSchedule(
  token: string,
  input: {code:string; day_of_week:Day; starts_at:string; ends_at:string; room_id?:number|null; section_id?:number|null; teacher_id?:number|null},
): Promise<AcademicSchedule> {
  const data = await schedulePost(token, 'admin_schedule_store', {
    period_label: input.code,
    day_of_week: DAY_TO_INT[input.day_of_week],
    start_time: input.starts_at,
    end_time: input.ends_at,
    room_id: input.room_id ?? undefined,
    section_id: input.section_id ?? undefined,
    teacher_id: input.teacher_id ?? undefined,
  });
  return fromBackendSchedule(data.schedule);
}

/** POST /admin_schedule_delete */
export async function deleteSchedule(token: string, id: number): Promise<void> {
  await schedulePost(token, 'admin_schedule_delete', {id});
}
