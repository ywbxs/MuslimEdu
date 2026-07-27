import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { getDashboardForRole } from '../../navigation/roleScreens';

import { COLORS } from '../../theme/spatial';
const INK = '#1C1C1E';

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={INK} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The role dashboard (Teacher / Student / Admin / etc - what used to live
 * on the Home tab) now lives one tap deep from Menu instead, via the
 * "My Dashboard" card. Kept as its own full screen (rather than embedded
 * inline in MenuScreen) since each role dashboard is a full ScrollView with
 * its own hero header, and nesting two ScrollViews gets messy on Android.
 */
export default function LegacyDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
        <BackIcon />
      </TouchableOpacity>
      {getDashboardForRole(user.role)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  backBtn: {
    position: 'absolute',
    top: 58,
    left: 18,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
