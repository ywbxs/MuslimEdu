import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import { GlassAvatar } from '../../components/glass/GlassKit';
import { COLORS, RADIUS, BRAND } from '../../theme/glass';

const EMERALD = BRAND.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

interface DashboardShellProps {
  title: string;
  children?: React.ReactNode;
  /** Optional extra content rendered at the very bottom of the scroll area
   * (below `children`) - used to append the profile card + logout button
   * when this dashboard is being shown inline on the Menu tab. */
  footer?: React.ReactNode;
}

/**
 * Shared wrapper for every role's dashboard: greeting + name, profile photo
 * (synced from the backend's user record, falling back to initials if
 * missing OR if the image URL fails to actually load), a role badge, and
 * whatever content that role's screen provides below it.
 *
 * Redesigned as a full-bleed spatial-glass screen: an animated gradient mesh
 * fills the whole screen edge-to-edge (behind the status bar too), with a
 * frosted glass header "floating" near the top instead of a flat white bar.
 *
 * This IS the Menu tab's content now (see MenuScreen.tsx) - there's no
 * separate "My Dashboard" page anymore, so the avatar here is just visual.
 */
export default function DashboardShell({ title, children, footer }: DashboardShellProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showPhoto = !!user?.photo && !photoFailed;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard surface="light" radius={RADIUS.xl} style={styles.header} intensity={35}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
              <Text style={styles.greetingName}>{user?.name}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{title}</Text>
              </View>
            </View>

            <GlassAvatar
              size={56}
              initial={initial}
              uri={showPhoto ? user!.photo : undefined}
            />
            {showPhoto && (
              // Hidden probe image so we can detect load failures and fall
              // back to initials, without giving GlassAvatar network logic.
              <Image
                source={{ uri: user!.photo! }}
                style={styles.probe}
                onError={() => setPhotoFailed(true)}
              />
            )}
          </View>
        </GlassCard>

        <View style={styles.body}>
          {children}
          {footer}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 130, flexGrow: 1 },
  header: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingSmall: { fontSize: 14, color: SUBTLE },
  greetingName: { fontSize: 22, fontWeight: '700', color: INK, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: EMERALD_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: EMERALD, textTransform: 'uppercase', letterSpacing: 0.5 },
  probe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  body: { flexGrow: 1 },
});

export { EMERALD, EMERALD_SOFT, INK, SUBTLE };
