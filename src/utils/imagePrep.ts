import RNFS from 'react-native-fs';
import ImageResizer from '@bam.tech/react-native-image-resizer';

export const MAX_PHOTO_BYTES = 200 * 1024; // 200 KB
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
 * Shrinks a photo down to MAX_PHOTO_BYTES (200KB) - tries progressively
 * smaller widths and lower JPEG quality until it fits. Shared by both the
 * profile-photo uploader and post photo uploads, since the target size and
 * approach are identical either way.
 */
async function prepareImage(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  knownSize?: number | null,
): Promise<PreparedPhoto> {
  const name = fileName || uri.split('/').pop() || 'photo.jpg';
  assertAllowedPhotoType(name, mimeType);

  const originalExt = extensionOf(name) || 'jpg';
  let currentUri = uri;
  let size = knownSize && knownSize > 0 ? knownSize : await fileSize(currentUri);
  const originallyOversized = size > MAX_PHOTO_BYTES;

  if (!originallyOversized) {
    return {
      uri: currentUri,
      fileName: name,
      type: mimeType || mimeFromExtension(originalExt),
      size,
      wasCompressed: false,
    };
  }

  const widths = [1280, 1024, 800, 640, 480, 360];
  const qualities = [80, 70, 60, 50, 40, 30];

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
      if (candidateSize <= MAX_PHOTO_BYTES) {
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

/** Same 200KB compression as prepareProfilePhoto, used for post photos (up to 6 per post). */
export async function preparePostPhoto(
  uri: string,
  fileName?: string | null,
  mimeType?: string | null,
  knownSize?: number | null,
): Promise<PreparedPhoto> {
  return prepareImage(uri, fileName, mimeType, knownSize);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
