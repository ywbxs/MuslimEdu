// Base URL for the Manhaje API.
// Confirmed working endpoint during Phase 1 testing:
// https://manhaje.com/apps/api/login
export const API_BASE_URL = 'https://manhaje.com/apps/api';

// --- Image asset base --------------------------------------------------
// CONFIRMED from the live web app: it serves uploaded files from
//   https://manhaje.com/apps/public/assets/uploads/...
// (the login page's own logo loads from that exact path). So every RELATIVE
// image path the API returns must resolve against this base - NOT against
// the /api origin. Getting this wrong is what made every backend image 404
// and silently render as an empty gray box.
const DOMAIN = 'https://manhaje.com';
const ASSET_BASE_PATH = 'apps/public'; // -> https://manhaje.com/apps/public/<path>

export const ENDPOINTS = {
  login: `${API_BASE_URL}/login`,
  me: `${API_BASE_URL}/me`,
  logout: `${API_BASE_URL}/logout`,
  logoutAll: `${API_BASE_URL}/logout-all`,
};

/**
 * Turns a backend image path into a loadable absolute URL.
 *
 * The API stores/returns image fields (profile photos, report photos) as
 * paths that vary in shape:
 *   - already absolute:      "https://.../x.png"      -> returned as-is
 *   - relative to public:    "assets/uploads/x.png"   -> prefixed with base
 *   - with a public/ prefix: "public/assets/x.png"    -> deduped, then prefixed
 *   - with an apps/ prefix:  "/apps/public/x.png"      -> deduped, then prefixed
 *
 * React Native's <Image> can't load a relative path, so it silently shows
 * nothing - that's the "images don't sync" bug. Run every backend image URL
 * through this before handing it to <Image source={{ uri }} />.
 *
 * Returns null for empty/nullish input so callers can render a fallback.
 */
export function absoluteUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  if (/^data:/i.test(path)) return path; // inline base64, leave alone

  let p = path.replace(/^\/+/, ''); // strip any leading slashes
  p = p.replace(/^apps\//i, ''); // drop a leading apps/ if the API included it
  p = p.replace(/^public\//i, ''); // drop a leading public/ if the API included it

  return `${DOMAIN}/${ASSET_BASE_PATH}/${p}`;
}
