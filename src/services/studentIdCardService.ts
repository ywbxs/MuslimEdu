/**
 * Every student already has a unique `code` (the same per-user field used
 * for staff/cashier codes elsewhere in this app) - so a student's ID/QR
 * card needs no new backend data or generation step at all. This just
 * defines the one shared QR payload format, so the card (encode) and the
 * scan screen (decode, see teacherAttendanceService.scanAttendance) agree
 * on it without duplicating the prefix string in two places.
 */
const QR_PREFIX = 'MUSLIMEDU:STUDENT:';

export function buildStudentIdQrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

export function parseStudentIdQrPayload(payload: string): string {
  return payload.startsWith(QR_PREFIX) ? payload.slice(QR_PREFIX.length) : payload;
}
