import RNFS from 'react-native-fs';
import ImageResizer from '@bam.tech/react-native-image-resizer';

export const MAX_PHOTO_BYTES = 200 * 1024; // 200 KB
// Post composer photos compress tighter than everything else that shares
// prepareImage below (profile photos, ID/selfie verification, report
// attachments) - a post can carry up to 20 of them, so keeping each one
// small matters a lot more than it does for a single profile photo.
export const MAX_POST_COMPOSER_PHOTO_BYTES = 100 * 1024; // 100 KB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png'];

export interface PreparedPhoto {
  uri: string;
  fileName: string;
  type: string;
  size: number;
  wasCompressed: boolean;
}

export class InvalidPhotoTypeError extends Error {
  constructor() {
    super('Only JPG, JPEG, or PNG images are allowed.');
    this.name = 'InvalidPhotoTypeError';
  }
}

function extensionOf(nameOrUri: string): string {
  const clean = nameOrUri.split('?')[0];
  const match = /\.([a-zA-Z0-9]+)$/.exec(clean);
  return (match?.[1] ?? '').toLowerCase();
}

function mimeFromExtension(ext: string): string {
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

export function assertAllowedPhotoType(nameOrUri: string, mimeType?: string | null) {
  const ext = extensionOf(nameOrUri);
  const typeOk = mimeType ? ALLOWED_PHOTO_TYPES.includes(mimeType.toLowerCase()) : true;
  const extOk = ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
  if (!typeOk || !extOk) {
    throw new InvalidPhotoTypeError();
  }
}

async function fileSize(uri: string): Promise<number> {
  try {
    const stat = await RNFS.stat(uri);
    return Number(stat.size) || 0;
  } catch {
    return 0;
  }
}

/**
 * Shrinks a photo down to maxBytes (defaults to MAX_PHOTO_BYTES, 200KB) -
 * tries progressively smaller widths and lower JPEG quality until it fits.
 * Shared by the profile-photo uploader, ID/selfie verification, report
 * attachments, and post photo uploads - callers that need a tighter target
 * (the post composer) pass their own maxBytes instead of taking the default.
 */
async function prepareImage(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  knownSize?: number | null,
  maxBytes: number = MAX_PHOTO_BYTES,
): Promise<PreparedPhoto> {
  const name = fileName || uri.split('/').pop() || 'photo.jpg';
  assertAllowedPhotoType(name, mimeType);

  const originalExt = extensionOf(name) || 'jpg';
  let currentUri = uri;
  let size = knownSize && knownSize > 0 ? knownSize : await fileSize(currentUri);
  const originallyOversized = size > maxBytes;

  if (!originallyOversized) {
    return {
      uri: currentUri,
      fileName: name,
      type: mimeType || mimeFromExtension(originalExt),
      size,
      wasCompressed: false,
    };
  }

  const widths = [1280, 1024, 800, 640, 480, 360, 240];
  const qualities = [80, 70, 60, 50, 40, 30, 20];

  for (const width of widths) {
    for (const quality of qualities) {
      const result = await ImageResizer.createResizedImage(
        currentUri,
        width,
        width,
        'JPEG',
        quality,
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: true },
      );
      const candidateSize = result.size ?? (await fileSize(result.uri));
      if (candidateSize <= maxBytes) {
        return {
          uri: result.uri,
          fileName: name.replace(/\.[a-zA-Z0-9]+$/, '.jpg'),
          type: 'image/jpeg',
          size: candidateSize,
          wasCompressed: true,
        };
      }
      currentUri = result.uri;
      size = candidateSize;
    }
  }

  return {
    uri: currentUri,
    fileName: name.replace(/\.[a-zA-Z0-9]+$/, '.jpg'),
    type: 'image/jpeg',
    size,
    wasCompressed: true,
  };
}

export async function prepareProfilePhoto(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  knownSize?: number | null,
): Promise<PreparedPhoto> {
  return prepareImage(uri, fileName, mimeType, knownSize);
}

/**
 * Same compression approach as prepareProfilePhoto, used for post photos,
 * verification uploads, and report attachments. Defaults to the shared
 * 200KB target - pass maxBytes explicitly for a tighter one (the post
 * composer uses MAX_POST_COMPOSER_PHOTO_BYTES, 100KB, since it allows up
 * to 20 photos per post).
 */
export async function preparePostPhoto(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  knownSize?: number | null,
  maxBytes: number = MAX_PHOTO_BYTES,
): Promise<PreparedPhoto> {
  return prepareImage(uri, fileName, mimeType, knownSize, maxBytes);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
