import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';

export default function MenuScreen() {
  const { user, logout } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showPhoto = !!user?.photo && !photoFailed;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.profileCard}>
          {showPhoto ? (
            <Image
              source={{ uri: user!.photo! }}
              style={styles.avatar}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initial}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: INK },
  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 100 },
  profileCard: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: { width: 76, height: 76, borderRadius: 38, marginBottom: 14, backgroundColor: '#FFFFFF' },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: INK },
  email: { fontSize: 13, color: SUBTLE, marginTop: 4 },
  roleBadge: {
    backgroundColor: EMERALD,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  logoutButton: {
    backgroundColor: '#FDECEF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#D70015', fontSize: 15, fontWeight: '700' },
});
