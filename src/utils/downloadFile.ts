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

/**
 * Downloads a remote image straight into the app - no browser, no
 * "open with" hand-off via Linking.openURL (which is what silently
 * launched a browser tab before). Saves to the device's public Downloads
 * folder on Android, or the app's own Documents folder on iOS (visible
 * from the Files app under "On My iPhone/iPad > <app name>", since there
 * is no public "Downloads" location on iOS without a camera-roll/media
 * library dependency this app doesn't currently have installed).
 *
 * Returns the saved file's local path.
 */
export async function downloadImageToDevice(url: string): Promise<string> {
  const hasPermission = await ensureAndroidWritePermission();
  if (!hasPermission) {
    throw new Error('Storage permission was denied, so the photo could not be saved.');
  }

  const fileName = fileNameFromUrl(url);
  const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const destPath = `${dir}/${fileName}`;

  const { statusCode } = await RNFS.downloadFile({ fromUrl: url, toFile: destPath }).promise;
  if (statusCode && statusCode >= 400) {
    throw new Error(`Download failed (${statusCode}).`);
  }
  return destPath;
}
