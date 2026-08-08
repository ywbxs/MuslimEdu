import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

async function requestAndroidPermission(): Promise<boolean> {
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: 'Used to show accurate prayer times for where you are right now.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Resolves the device's current GPS coordinates, or null if permission was
 * denied, the platform has no location hardware, or a fix couldn't be
 * obtained in time. Callers should treat null as "fall back to another
 * location source" (e.g. the school's address), not as an error to surface.
 *
 * iOS permission prompting is handled by the OS the first time
 * getCurrentPosition() is called (per the library's own iOS Info.plist
 * usage-description flow) - only Android needs the explicit
 * PermissionsAndroid.request() call here.
 */
export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  if (Platform.OS === 'android') {
    const granted = await requestAndroidPermission();
    if (!granted) return null;
  }

  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
