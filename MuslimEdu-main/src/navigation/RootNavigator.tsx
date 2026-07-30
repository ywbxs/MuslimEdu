import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import StudentListScreen from '../screens/students/StudentListScreen';
import OrphanReportScreen from '../screens/orphan/OrphanReportScreen';
import AdminOrphanOverviewScreen from '../screens/orphan/AdminOrphanOverviewScreen';
import AdminChildReportDetailScreen from '../screens/orphan/AdminChildReportDetailScreen';
import AdmissionScreen from '../screens/admin/AdmissionScreen';
import MainTabs from './MainTabs';
import AppLaunchSkeleton from '../components/AppLaunchSkeleton';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // While the saved-session check runs, show a skeleton shell instead of a
  // blank/spinner screen - same perceived wait, but it reads as "loading
  // content" rather than "app is stuck", and there's no hard flash once
  // the real screen fades in.
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
  }, [isLoading, fadeAnim]);

  if (isLoading) {
    return <AppLaunchSkeleton />;
  }

  return (
    <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {user ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
              <Stack.Screen
                name="StudentsList"
                component={StudentListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Admission"
                component={AdmissionScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="OrphanReport"
                component={OrphanReportScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminOrphanOverview"
                component={AdminOrphanOverviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminChildReportDetail"
                component={AdminChildReportDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
