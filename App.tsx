import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LocaleProvider } from './src/context/LocaleContext';
import { OfflineQueueProvider } from './src/context/OfflineQueueContext';
import { DisplayScaleProvider } from './src/context/DisplayScaleContext';
import { NotificationProvider } from './src/context/NotificationContext';
import DisplayScaleWrapper from './src/components/DisplayScaleWrapper';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineStatusBar from './src/components/OfflineStatusBar';
import LocaleAccountSync from './src/components/LocaleAccountSync';
import { registerBackgroundHandler } from './src/services/firebaseMessaging';

// Must run at module load, before the RN CLI's generated index.js finishes
// calling AppRegistry.registerComponent (this module is imported by that
// file) - a background/quit-state FCM handler registered later than that
// point is not reliably picked up by the native side.
registerBackgroundHandler();

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <OfflineQueueProvider>
          <AuthProvider>
            <LocaleAccountSync />
            <NotificationProvider>
              <DisplayScaleProvider>
                <DisplayScaleWrapper>
                  {/* OfflineStatusBar is a normal flex sibling ABOVE the
                      navigator, not an absolute overlay - going offline pushes
                      the whole screen down by the banner's height instead of
                      floating a pill over whatever's underneath it. Shows on
                      every tab/pushed screen without each one rendering it
                      itself. */}
                  <View style={{ flex: 1 }}>
                    <OfflineStatusBar />
                    <View style={{ flex: 1 }}>
                      <RootNavigator />
                    </View>
                  </View>
                </DisplayScaleWrapper>
              </DisplayScaleProvider>
            </NotificationProvider>
          </AuthProvider>
        </OfflineQueueProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
