/**
 * Gender-segregation rule shared by comments (PostCommentsScreen) and
 * messaging (ChatListScreen): applies to every role, not just students -
 * there's female staff too, so a male teacher and a female teacher are
 * segregated the same as any two students.
 *
 * Fails OPEN when either side's gender is missing (null/undefined/empty) -
 * treats it as "not opposite" rather than hiding/blocking. This matters
 * because the backend doesn't return every user's own gender everywhere
 * yet; failing closed here would hide every comment and block all
 * messaging for accounts without a gender on file yet, which is worse than
 * temporarily not enforcing the rule for those accounts.
 */
export function isOppositeGender(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return false;

  const isMale = (g: string) => g === 'male' || g === 'm';
  const isFemale = (g: string) => g === 'female' || g === 'f';

  return (isMale(na) && isFemale(nb)) || (isFemale(na) && isMale(nb));
}
