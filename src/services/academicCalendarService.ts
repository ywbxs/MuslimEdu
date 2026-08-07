import {API_BASE_URL} from '../config/api';
import {cacheKeyFor,cacheThenNetwork} from '../utils/offlineCache';
const CACHE_PREFIX='@academic_calendar_cache_v1';
export type CalendarEventType='enrollment'|'term'|'exam'|'holiday'|'ramadan'|'eid'|'graduation'|'orientation'|'training'|'meeting'|'suspension'|'makeup_class'|'institution';
export interface CalendarEvent{id:number;title:string;title_ar:string|null;event_type:CalendarEventType;starts_on:string;ends_on:string|null;starts_at:string|null;ends_at:string|null;all_day:boolean;visibility:string;status:string;color:string|null;description:string|null;}
async function post<T>(p:string,t:string,b:Record<string,any>={}){const r=await fetch(`${API_BASE_URL}${p}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify(b)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message??`Request failed (${r.status})`);return d as T;}
export async function listCalendarEvents(t:string,from?:string,to?:string){return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX,t,'admin',from??'x',to??'x'),async()=>{const d=await post<{events:{data:CalendarEvent[]}}>(`/admin_calendar_events`,t,{...(from?{from}:{}),...(to?{to}:{})});return d.events?.data??[];});}
export async function saveCalendarEvent(t:string,d:Partial<CalendarEvent>&{title:string;event_type:CalendarEventType;starts_on:string}){return(await post<{event:CalendarEvent}>('/admin_calendar_event_store',t,d)).event;}
export async function updateCalendarEvent(t:string,id:number,d:Partial<CalendarEvent>){return(await post<{event:CalendarEvent}>('/admin_calendar_event_update',t,{event_id:id,...d})).event;}
export async function deleteCalendarEvent(t:string,id:number){return post('/admin_calendar_event_delete',t,{event_id:id});}
export async function fetchMyCalendarEvents(t:string,from?:string,to?:string){return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX,t,'mine',from??'x',to??'x'),async()=>(await post<{events:CalendarEvent[]}>('/calendar_events_mine',t,{...(from?{from}:{}),...(to?{to}:{})})).events??[]);}
