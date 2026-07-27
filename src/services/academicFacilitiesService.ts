import { API_BASE_URL } from '../config/api';

export type FacilityStatus = 'active' | 'archived';
export type RoomType = 'classroom' | 'laboratory' | 'library' | 'office' | 'hall' | 'mosque' | 'learning_space' | 'other';
export interface Building { id: number; campus_id: number | null; code: string; name: string; name_ar: string | null; floor_count: number; status: FacilityStatus; rooms_count?: number; }
export interface Room { id: number; building_id: number; campus_id: number | null; code: string; name: string; room_type: RoomType | string; floor_number: number; capacity: number; features: string[] | null; status: FacilityStatus; building?: Pick<Building, 'id'|'name'|'code'>; }

async function post<T>(path: string, token: string, body: Record<string, any> = {}): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message ?? d?.error ?? `Request failed (${r.status})`);
  return d as T;
}
export async function listBuildings(token: string, search = '') { const d = await post<{ buildings: { data: Building[] } }>('/admin_facilities_buildings', token, { search }); return d.buildings?.data ?? []; }
export async function saveBuilding(token: string, data: Partial<Building> & { name: string; code: string }) { return (await post<{ building: Building }>('/admin_facilities_building_store', token, data)).building; }
export async function updateBuilding(token: string, building_id: number, data: Partial<Building>) { return (await post<{ building: Building }>('/admin_facilities_building_update', token, { building_id, ...data })).building; }
export async function archiveBuilding(token: string, building_id: number) { return post('/admin_facilities_building_delete', token, { building_id }); }
export async function listRooms(token: string, building_id?: number, search = '') { const d = await post<{ rooms: { data: Room[] } }>('/admin_facilities_rooms', token, { ...(building_id ? { building_id } : {}), search }); return d.rooms?.data ?? []; }
export async function saveRoom(token: string, data: Partial<Room> & { building_id: number; name: string; code: string; room_type: string; floor_number: number }) { return (await post<{ room: Room }>('/admin_facilities_room_store', token, data)).room; }
export async function updateRoom(token: string, room_id: number, data: Partial<Room>) { return (await post<{ room: Room }>('/admin_facilities_room_update', token, { room_id, ...data })).room; }
export async function archiveRoom(token: string, room_id: number) { return post('/admin_facilities_room_delete', token, { room_id }); }
