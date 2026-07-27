/**
 * Local palette for the next-phase screens.
 *
 * Deliberately self-contained rather than importing screens/teachers/academicTheme.ts:
 * these files ship as a standalone additive bundle, and a theme import that
 * drifts is the single most common reason one of these drops fails to build.
 * Values are lifted from the existing screens so it looks identical.
 */
export const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#12805C',
  greenSoft: '#E6F4EE',
  blue: '#2563EB',
  blueSoft: '#E6EEFC',
  purple: '#7C3AED',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#C0392B',
  redSoft: '#FDECEA',
};

export const STATUS_TINT: Record<string, { fg: string; bg: string }> = {
  draft: { fg: C.muted, bg: '#EEF2F0' },
  published: { fg: C.green, bg: C.greenSoft },
  completed: { fg: C.blue, bg: C.blueSoft },
  cancelled: { fg: C.red, bg: C.redSoft },
  open: { fg: C.amber, bg: C.amberSoft },
  in_progress: { fg: C.blue, bg: C.blueSoft },
  resolved: { fg: C.green, bg: C.greenSoft },
  rejected: { fg: C.red, bg: C.redSoft },
  requested: { fg: C.amber, bg: C.amberSoft },
  processing: { fg: C.blue, bg: C.blueSoft },
  issued: { fg: C.green, bg: C.greenSoft },
};

export function tintFor(status: string) {
  return STATUS_TINT[status] ?? { fg: C.muted, bg: '#EEF2F0' };
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(iso).toLocaleDateString();
}
