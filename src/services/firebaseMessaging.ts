/**
 * Thin wrapper around @react-native-firebase/messaging. Every call is
 * try/caught and fails to a harmless no-op - the native module only works
 * once the real (non-placeholder) google-services.json from the Firebase
 * console is bundled (see android-config/README.md), so until then every
 * one of these calls quietly does nothing instead of crashing the app.
 */
import { Platform } from 'react-native';

type FirebaseMessagingModule = typeof import('@react-native-firebase/messaging').default;

let messagingModule: FirebaseMessagingModule | null | undefined;

function getMessaging(): FirebaseMessagingModule | null {
  if (messagingModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      messagingModule = require('@react-native-firebase/messaging').default;
    } catch {
      messagingModule = null;
    }
  }
  return messagingModule ?? null;
}

/** Asks the user for notification permission (iOS prompts; Android 13+ needs POST_NOTIFICATIONS, handled by the same call). */
export async function requestNotificationPermission(): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) return false;
  try {
    const authStatus = await messaging().requestPermission();
    return authStatus === 1 /* AUTHORIZED */ || authStatus === 2 /* PROVISIONAL */;
  } catch {
    return false;
  }
}

/** The device's current FCM registration token, or null if unavailable (no native module, permission denied, no network). */
export async function getFcmToken(): Promise<string | null> {
  const messaging = getMessaging();
  if (!messaging) return null;
  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

/** Fires `onMessage` whenever a push arrives while the app is in the foreground. Returns an unsubscribe function (or a no-op if messaging isn't available). */
export function onForegroundMessage(handler: (title: string, body: string, data: Record<string, string>) => void): () => void {
  const messaging = getMessaging();
  if (!messaging) return () => {};
  try {
    return messaging().onMessage(async (remoteMessage) => {
      handler(
        remoteMessage.notification?.title ?? '',
        remoteMessage.notification?.body ?? '',
        (remoteMessage.data as Record<string, string>) ?? {},
      );
    });
  } catch {
    return () => {};
  }
}

/** Fires when the user taps a push that opened the app from the background (not a cold start - see getInitialNotificationData for that). */
export function onNotificationOpenedFromBackground(handler: (data: Record<string, string>) => void): () => void {
  const messaging = getMessaging();
  if (!messaging) return () => {};
  try {
    return messaging().onNotificationOpenedApp((remoteMessage) => {
      handler((remoteMessage.data as Record<string, string>) ?? {});
    });
  } catch {
    return () => {};
  }
}

/** The push data that cold-started the app (tapped from a killed state), if any. */
export async function getInitialNotificationData(): Promise<Record<string, string> | null> {
  const messaging = getMessaging();
  if (!messaging) return null;
  try {
    const remoteMessage = await messaging().getInitialNotification();
    return remoteMessage ? ((remoteMessage.data as Record<string, string>) ?? {}) : null;
  } catch {
    return null;
  }
}

export function isFirebaseMessagingAvailable(): boolean {
  return getMessaging() !== null;
}

export const isIOS = Platform.OS === 'ios';

/**
 * Registers the background/quit-state message handler. Must run at module
 * load time (called from App.tsx, outside any component, before the RN CLI's
 * generated index.js calls AppRegistry.registerComponent) - React Native
 * requires this handler to be set up before the JS engine finishes its
 * initial pass, not from inside a mounted component's effect.
 */
export function registerBackgroundHandler(): void {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    messaging().setBackgroundMessageHandler(async () => {
      // Data-only handling happens on next foreground open via
      // getInitialNotificationData()/onNotificationOpenedFromBackground -
      // nothing to do here besides letting the OS show the notification,
      // which FCM does automatically for messages carrying a `notification`
      // payload.
    });
  } catch {
    // Native module not linked yet (placeholder google-services.json, or
    // running in an environment without it) - nothing to register.
  }
}
