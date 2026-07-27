import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Config from '../../src/config/api';
const cfg:any=Config as any; const base=(cfg.API_BASE_URL||cfg.BASE_URL||cfg.API_URL||'').replace(/\/$/,'');
async function post(endpoint:string, body:any={}){let token=null;for(const k of ['token','auth_token','authToken','user_token']){token=await AsyncStorage.getItem(k);if(token)break;}const r=await fetch(base+'/'+endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}: {})},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.message||'Request failed');return j;}
export const scheduleService={list:(p:any={})=>post('admin_schedule_list',p),check:(p:any)=>post('admin_schedule_check_conflicts',p),store:(p:any)=>post('admin_schedule_store',p),update:(p:any)=>post('admin_schedule_update',p),status:(id:number,status:string,remarks?:string)=>post('admin_schedule_status',{id,status,remarks}),audit:(id:number)=>post('admin_schedule_audit',{id})};
export default scheduleService;
