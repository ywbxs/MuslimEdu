import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid } from 'react-native';

// Android 13+ (API 33) dropped the runtime WRITE_EXTERNAL_STORAGE
// permission for this kind of write - only older versions need it
// requested explicitly.
async function ensureAndroidWritePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version >= 33) return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
      title: 'Storage permission',
      message: 'Allow the app to save photos to your device.',
      buttonPositive: 'Allow',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function fileNameFromUrl(url: string): string {
  const clean = url.split('?')[0];
  const last = clean.split('/').pop() || `photo_${Date.now()}.jpg`;
  return /\.[a-zA-Z0-9]+$/.test(last) ? last : `${last}.jpg`;
}

// The public Downloads folder isn't guaranteed to already exist as a plain
// directory react-native-fs can write straight into - Android's scoped
// storage rules (10+) and some emulators/custom ROMs can make a direct
// path write there fail with a bare ENOENT ("no such file or directory")
// instead of a clear permission error. Creating it first fixes the common
// case; the primary/fallback dir list below (see androidDirCandidates)
// covers the rest, so a save never just fails outright.
async function ensureDirExists(dir: string): Promise<void> {
  try {
    const exists = await RNFS.exists(dir);
    if (!exists) {
      await RNFS.mkdir(dir);
    }
  } catch {
    // Best-effort - if the directory truly can't be created, the write
    // that follows will surface its own error, which writeWithFallback
    // below then tries the next candidate directory for anyway.
  }
}

// Where to save on Android: the public Downloads folder first, so files
// show up in the device's own Downloads app like a normal browser
// download. If that write fails for any reason, falls back to the app's
// own external files directory, which every Android version can always
// write to without any extra permission or scoped-storage restriction -
// still easy to find via a file manager, just nested under
// Android/data/<package>/files instead of the shared Downloads list.
function androidDirCandidates(): string[] {
  return [RNFS.DownloadDirectoryPath, RNFS.ExternalDirectoryPath].filter(Boolean) as string[];
}

async function writeWithFallback(dirs: string[], fileName: string, write: (destPath: string) => Promise<void>): Promise<string> {
  let lastError: unknown;
  for (const dir of dirs) {
    await ensureDirExists(dir);
    const destPath = `${dir}/${fileName}`;
    try {
      await write(destPath);
      return destPath;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not save the file to any location on this device.');
}

/**
 * Downloads a remote image straight into the app - no browser, no
 * "open with" hand-off via Linking.openURL (which is what silently
 * launched a browser tab before). Saves to the device's public Downloads
 * folder on Android (falling back to the app's own storage if that fails -
 * see writeWithFallback), or the app's own Documents folder on iOS
 * (visible from the Files app under "On My iPhone/iPad > <app name>",
 * since there is no public "Downloads" location on iOS without a
 * camera-roll/media library native dependency this app can't add - there's
 * no android/ or ios/ native project in this repo to wire one into).
 *
 * Returns the saved file's local path.
 */
export async function downloadImageToDevice(url: string): Promise<string> {
  const hasPermission = await ensureAndroidWritePermission();
  if (!hasPermission) {
    throw new Error('Storage permission was denied, so the photo could not be saved.');
  }

  const fileName = fileNameFromUrl(url);
  const dirs = Platform.OS === 'android' ? androidDirCandidates() : [RNFS.DocumentDirectoryPath];

  return writeWithFallback(dirs, fileName, async (destPath) => {
    const { statusCode } = await RNFS.downloadFile({ fromUrl: url, toFile: destPath }).promise;
    if (statusCode && statusCode >= 400) {
      throw new Error(`Download failed (${statusCode}).`);
    }
  });
}

/**
 * Saves a file that's already local (e.g. a `react-native-view-shot`
 * capture living in a temp cache dir) into the same public/permanent
 * location downloadImageToDevice() uses - same permission handling and
 * directory fallback, just RNFS.copyFile instead of downloading from a
 * URL. Used by the student ID card screen's "export" action: the card is
 * rendered and captured on-device, not fetched from a URL, so there's
 * nothing to download.
 *
 * Returns the saved file's local path.
 */
export async function saveLocalFileToDevice(sourcePath: string, fileName: string): Promise<string> {
  const hasPermission = await ensureAndroidWritePermission();
  if (!hasPermission) {
    throw new Error('Storage permission was denied, so the image could not be saved.');
  }

  const cleanSource = sourcePath.startsWith('file://') ? sourcePath.slice('file://'.length) : sourcePath;
  const dirs = Platform.OS === 'android' ? androidDirCandidates() : [RNFS.DocumentDirectoryPath];

  return writeWithFallback(dirs, fileName, async (destPath) => {
    await RNFS.copyFile(cleanSource, destPath);
  });
}

/**
 * Saves raw text content (e.g. a hand-built PDF from pdfExport.ts) to the
 * same public/permanent location the other two save helpers use - same
 * permission handling and directory fallback, just RNFS.writeFile instead
 * of downloading or copying. 'ascii' is the right encoding for a PDF
 * built from Latin-1/WinAnsi-only text - writing it as 'utf8' would
 * re-encode any byte above 127 as multiple bytes and corrupt the file's
 * byte-offset xref table.
 *
 * Returns the saved file's local path.
 */
export async function saveTextFileToDevice(content: string, fileName: string, encoding: 'utf8' | 'ascii' = 'utf8'): Promise<string> {
  const hasPermission = await ensureAndroidWritePermission();
  if (!hasPermission) {
    throw new Error('Storage permission was denied, so the file could not be saved.');
  }

  const dirs = Platform.OS === 'android' ? androidDirCandidates() : [RNFS.DocumentDirectoryPath];

  return writeWithFallback(dirs, fileName, async (destPath) => {
    await RNFS.writeFile(destPath, content, encoding);
  });
}
