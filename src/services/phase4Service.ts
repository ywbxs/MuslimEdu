import type { ApiClient } from './http/client';
import type { ApiResult } from './http/envelope';
import type { Phase4Dashboard, Phase4ListResponse } from '../features/academicPhase4/phase4Types';
export class Phase4Service {
  constructor(private readonly api: ApiClient) {}
  dashboard(): Promise<ApiResult<Phase4Dashboard>> { return this.api.post<Phase4Dashboard>('/admin_academic_phase4_dashboard'); }
  setup(): Promise<ApiResult<unknown>> { return this.api.post<unknown>('/admin_academic_setup_show'); }
  structure(page = 1): Promise<ApiResult<Phase4ListResponse<unknown>>> { return this.api.post<Phase4ListResponse<unknown>>('/admin_academic_structure_list', { page }); }
  enrollmentWorkflow(): Promise<ApiResult<Phase4ListResponse<unknown>>> { return this.api.post<Phase4ListResponse<unknown>>('/admin_enrollment_workflow_list'); }
  subjectLoading(): Promise<ApiResult<Phase4ListResponse<unknown>>> { return this.api.post<Phase4ListResponse<unknown>>('/admin_subject_loading_list'); }
  timetable(): Promise<ApiResult<Phase4ListResponse<unknown>>> { return this.api.post<Phase4ListResponse<unknown>>('/admin_schedule_list'); }
}
