import { API_BASE_URL } from '../config/api';

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

/**
 * Mints a short-lived signed link to a printable "whole student status"
 * HTML report (attendance summary, enrollment/fee status) - see
 * ReportController's docblock for why this is a browser-openable link
 * rather than an in-app PDF: no verified PDF/print module in this app, no
 * SSH/composer access to add a PDF-rendering package server-side either.
 * Open the returned url with React Native's Linking.openURL(); the device
 * browser's own "Print > Save as PDF" produces the actual PDF file.
 */
export async function fetchStudentReportLink(token: string, studentId: number): Promise<string> {
  const data = await authedPost('/admin_student_report_link', token, { student_id: studentId });
  return data.url;
}
