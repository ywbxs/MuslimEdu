import { post, postForm } from './nextPhaseClient';

export type TeacherProfile = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  date_of_birth: string | null;
  qualification: string | null;
  designation: string | null;
  joining_date: string | null;
  bio: string | null;
  photo: string | null;
};

export type CommunicationOverview = {
  summary: { unread_messages: number; my_announcements: number; unread_notifications: number };
  recent_messages: Array<{
    id: number;
    message_thrade: number;
    sender_id: number;
    reciver_id: number;
    message: string;
    read_status: number;
    created_at: string;
  }>;
  recent_announcements: Array<Record<string, unknown>>;
};

export default {
  profile: () =>
    post<{ profile: TeacherProfile; stats: { sections: number; examinations: number; published: number } }>(
      'teacher_profile_show',
    ),

  updateProfile: (body: Record<string, unknown>) =>
    post<{ message: string }>('teacher_profile_self_update', body),

  updateProfileWithPhoto: (form: FormData) =>
    postForm<{ message: string }>('teacher_profile_self_update', form),

  changePassword: (current_password: string, new_password: string) =>
    post<{ message: string }>('teacher_password_update', {
      current_password,
      new_password,
      new_password_confirmation: new_password,
    }),

  communication: () => post<CommunicationOverview>('teacher_communication_overview'),
};
