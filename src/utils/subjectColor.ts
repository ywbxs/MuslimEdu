// Same 8-color preset SubjectFormScreen's admin color picker offers
// (COLOR_PRESETS in SubjectFormScreen.tsx) - kept as a separate copy here
// rather than importing across an admin/student boundary. Subjects the
// admin never assigned a color to fall back to a deterministic pick from
// this same set (hashed off subject_id) so cards still read as distinct
// colors, not a wall of gray, and a given subject keeps the same fallback
// color across renders/sessions instead of shuffling randomly.
const FALLBACK_PALETTE = [
  '#4F46E5', '#0EA5E9', '#1FAE64', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6',
];

export function resolveSubjectColor(subjectId: number | null | undefined, adminColor?: string | null): string {
  if (adminColor) return adminColor;
  const id = subjectId ?? 0;
  return FALLBACK_PALETTE[Math.abs(id) % FALLBACK_PALETTE.length];
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
