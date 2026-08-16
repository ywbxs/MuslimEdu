import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND } from '../theme/glass';

/**
 * Small "Teacher" / "Admin" pill shown right next to a user's name wherever
 * it appears (feed posts, reposts, comments, profile header) - so staff are
 * immediately recognizable without opening their profile.
 *
 * Deliberately quiet: students/parents/etc. get no tag at all, keeping the
 * badge meaningful instead of decorating every name in the app.
 */
export default function RoleTag({ role }: { role?: string | null }) {
  const config = roleConfig(role);
  if (!config) return null;

  return (
    <View style={[styles.tag, { backgroundColor: config.bg }]}>
      <Text style={[styles.tagText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function roleConfig(role?: string | null): { label: string; color: string; bg: string } | null {
  switch (role) {
    case 'admin':
    case 'superadmin':
      return { label: 'Admin', color: BRAND.gold, bg: 'rgba(212,166,74,0.16)' };
    case 'teacher':
      return { label: 'Teacher', color: BRAND.emerald, bg: 'rgba(31,174,100,0.14)' };
    case 'shop':
      return { label: 'Shop', color: BRAND.gold, bg: 'rgba(212,166,74,0.16)' };
    case 'charity':
      return { label: 'Charity', color: '#DB4C77', bg: 'rgba(219,76,119,0.14)' };
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
