import { API_BASE_URL, absoluteUrl } from '../config/api';

/**
 * M4 report export. Backend returns { filename, csv } as JSON rather than
 * a streamed file — this app has no verified file-download/sharing native
 * module (checked before building; none exists), so the CSV text is
 * shared via React Native's built-in Share API instead of saved as a
 * binary file. See ReportExportController's docblock for why this is CSV
 * and not PDF.
 *
 * Never executed against a live server.
 */

function firstErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return null;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('You appear to be offline. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(firstErrorMessage(data) ?? 'You do not have permission to do this.');
  }

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

export interface CsvReport {
  filename: string;
  csv: string;
}

export async function fetchStudentProgressCsv(token: string, studentId: number): Promise<CsvReport> {
  return authedPost('/report_student_progress_csv', token, { student_id: studentId });
}

export async function fetchClassProgressCsv(token: string, sectionId: number): Promise<CsvReport> {
  return authedPost('/report_class_progress_csv', token, { section_id: sectionId });
}

export interface StudentReportData {
  student: {
    id: number;
    name: string;
    email: string;
    photo: string | null;
    class_name: string | null;
    section_name: string | null;
  };
  generated_at: string;
  attendance: { status: string; count: number }[];
  payments: {
    fee_name: string | null;
    status: 'unpaid' | 'paid' | 'waived';
    amount: string | number | null;
    payment_mode: string | null;
    receipt_number: string | null;
  }[];
}

/**
 * "Whole student status" report data - rendered natively inside the app
 * (StudentReportScreen), not opened in an external browser. A plain
 * Sanctum-authenticated JSON endpoint, same convention as every other
 * route in this API; the app builds its own React Native UI from the
 * data instead of relying on a PDF/HTML/WebView renderer that doesn't
 * exist in this project.
 */
export async function fetchStudentReportData(token: string, studentId: number): Promise<StudentReportData> {
  const data = await authedPost('/admin_student_report_data', token, { student_id: studentId });
  return {
    ...data,
    student: { ...data.student, photo: absoluteUrl(data.student?.photo) },
  };
}
