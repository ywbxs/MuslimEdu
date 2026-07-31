import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LocaleProvider } from './src/context/LocaleContext';
import { OfflineQueueProvider } from './src/context/OfflineQueueContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <OfflineQueueProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </OfflineQueueProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
