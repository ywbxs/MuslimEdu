import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#EAF7EF';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';

interface DashboardShellProps {
  title: string;
  children?: React.ReactNode;
}

/**
 * Shared wrapper for every role's dashboard: greeting + name, profile photo
 * (synced from the backend's user record, falling back to initials if
 * missing OR if the image URL fails to actually load), a role badge, and
 * whatever content that role's screen provides below it.
 *
 * Logout now lives in the Menu tab, not here - tapping the avatar jumps
 * there instead.
 */
export default function DashboardShell({ title, children }: DashboardShellProps) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [photoFailed, setPhotoFailed] = useState(false);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showPhoto = !!user?.photo && !photoFailed;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
          <Text style={styles.greetingName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{title}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
          {showPhoto ? (
            <Image
              source={{ uri: user!.photo }}
              style={styles.avatar}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initial}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greetingSmall: { fontSize: 14, color: SUBTLE },
  greetingName: { fontSize: 22, fontWeight: '700', color: INK, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: EMERALD_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: EMERALD, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F2F2F7' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  // paddingBottom dropped from 110 -> 32: the old value existed purely to
  // clear the floating pill navbar. The navbar is docked now, so the
  // content just needs normal breathing room above it.
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
});

export { EMERALD, EMERALD_SOFT, INK, SUBTLE };
