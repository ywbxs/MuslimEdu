import { API_BASE_URL } from '../config/api';
import { PickedImage } from './postService';

/**
 * Nudity/violence screening for photos picked in the post composer, before
 * they're ever added to a post. Runs server-side (POST /moderate_image) -
 * NOT on-device and NOT a direct client call to a 3rd-party vision API,
 * since that would mean shipping a moderation provider's API key inside the
 * app bundle where anyone could extract it. Following this repo's
 * established "ship the frontend, document the contract, backend catches
 * up" convention (see widgetAnnouncementService.ts / examinationService.ts)
 * since this route does not exist yet.
 *
 * Backend contract to implement:
 *   POST /moderate_image  (any authenticated role, multipart `image`)
 *     -> { safe: boolean, reasons: string[] }
 *   `reasons` is present (and safe is false) when the image was flagged -
 *   expected values include "nudity" and "violence", but the client only
 *   needs `safe` to decide whether to block the photo; `reasons` is shown
 *   to the user as-is when present. The server should call an actual image
 *   moderation provider (e.g. a SafeSearch-style API) with credentials kept
 *   server-side, never embedded in the app.
 */
const MODERATION_TIMEOUT_MS = 20000;

export class ModeratedContentError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(
      reasons.length > 0
        ? `This photo was flagged for ${reasons.join(', ')} and can't be posted.`
        : "This photo can't be posted - it didn't pass our content review.",
    );
    this.name = 'ModeratedContentError';
    this.reasons = reasons;
  }
}

/**
 * Resolves once the image has been checked. Throws ModeratedContentError if
 * flagged. If the moderation call itself fails (network error, or the
 * backend route above isn't live yet), this fails OPEN - the photo is
 * allowed through rather than blocking every post in the app on a route
 * that doesn't exist yet. Once the backend ships /moderate_image for real,
 * this same fail-open behavior only kicks in for genuine outages.
 */
export async function checkImageModeration(token: string, image: PickedImage): Promise<void> {
  const form = new FormData();
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('image', {
    uri: image.uri,
    name: image.fileName ?? 'photo.jpg',
    type: image.type ?? 'image/jpeg',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/moderate_image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch {
    return; // network error / timeout - fail open, see doc comment above
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) return; // route not live yet / server error - fail open

  const data = await response.json().catch(() => null);
  if (!data) return;

  if (data.safe === false) {
    throw new ModeratedContentError(Array.isArray(data.reasons) ? data.reasons : []);
  }
}
