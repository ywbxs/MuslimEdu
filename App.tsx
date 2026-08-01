import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LocaleProvider } from './src/context/LocaleContext';
import { OfflineQueueProvider } from './src/context/OfflineQueueContext';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineStatusBar from './src/components/OfflineStatusBar';

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <OfflineQueueProvider>
          <AuthProvider>
            {/* OfflineStatusBar floats above whatever screen is active, so
                it shows on every tab/pushed screen without each one having
                to render it itself. */}
            <View style={{ flex: 1 }}>
              <RootNavigator />
              <OfflineStatusBar />
            </View>
          </AuthProvider>
        </OfflineQueueProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
