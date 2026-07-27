import { API_BASE_URL } from '../config/api';
export type StudentIdConfig={id:number;prefix:string|null;suffix:string|null;separator:string;digit_length:number;include_campus_code:boolean;include_department_code:boolean;include_academic_year:boolean;include_admission_year:boolean;include_academic_type:boolean;yearly_reset:boolean;next_number:number};
async function post(path:string,token:string,body:Record<string,any>={}){const r=await fetch(`${API_BASE_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message??`Request failed (${r.status})`);return d;}
export async function fetchStudentIdConfig(token:string){return(await post('/admin_student_id_config',token)).config as StudentIdConfig}
export async function saveStudentIdConfig(token:string,data:Partial<StudentIdConfig>){return(await post('/admin_student_id_config_save',token,data)).config as StudentIdConfig}
export async function previewStudentId(token:string,data:Record<string,any>){return(await post('/admin_student_id_preview',token,data)).preview as string}
