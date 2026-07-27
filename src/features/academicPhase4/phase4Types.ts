export type Phase4Module = 'setup-wizard' | 'structure-builder' | 'enrollment-workflow' | 'subject-loading' | 'timetable' | 'completion' | 'catalog' | 'policies' | 'documents';
export interface Phase4ModuleCard { key: Phase4Module; title: string; description: string; enabled: boolean; routeName: string; }
export interface Phase4Dashboard { setupRequired: boolean; setupVersion: number; modules: Phase4ModuleCard[]; }
export interface Phase4ListResponse<T> { items: T[]; nextPage: number | null; }
