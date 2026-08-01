import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Polyline, Rect, Circle, Line } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackground from '../../components/glass/GlassBackground';
import { COLORS, RADIUS, SHADOW, SPACING } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const BORDER = COLORS.border;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconHandTap({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 12V6a1.5 1.5 0 0 1 3 0v5M12 11V4.5a1.5 1.5 0 0 1 3 0V11M15 11.5V7a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 18 5 15v-3.5A1.5 1.5 0 0 1 6.5 10c.5 0 1 .2 1.3.6L9 12" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconQrCode({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={1.8} />
      <Rect x={14} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={1.8} />
      <Rect x={3} y={14} width={7} height={7} rx={1} stroke={color} strokeWidth={1.8} />
      <Path d="M14 14h3v3h-3zM20 14v3M14 20h3M17.5 17.5H20V20" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconFace({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={11} r={1} fill={color} />
      <Circle cx={15} cy={11} r={1} fill={color} />
      <Path d="M9 15c1 1 5 1 6 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

interface MethodTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  badge?: string;
  onPress?: () => void;
}

function MethodTile({ icon, title, description, disabled, badge, onPress }: MethodTileProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, disabled && styles.tileDisabled]}
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <View style={[styles.tileIconBox, disabled && styles.tileIconBoxDisabled]}>{icon}</View>
      <View style={styles.flex1}>
        <View style={styles.tileTitleRow}>
          <Text style={styles.tileTitle}>{title}</Text>
          {badge ? (
            <View style={styles.tileBadge}>
              <Text style={styles.tileBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.tileDesc}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Reached from TeacherAttendanceClassesScreen before the roster - lets a
 * teacher pick how they want to take today's attendance. Manual goes to
 * the existing swipe-card roster (TeacherAttendanceRosterScreen); Scan
 * ID/QR goes to AttendanceScanScreen (one camera flow covers both a
 * printed/displayed QR code and a student ID card, since the ID card's
 * core feature IS a QR code - there's no separate distinct "ID scan"
 * mechanism). Face Scan is a placeholder for now - real facial
 * recognition needs a paid cloud API or a custom on-device model, which is
 * its own project, not a quick add.
 */
export default function AttendanceMethodChooserScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, subjectId, classLabel, subjectLabel, date } = route.params ?? {};
  const { t } = useLocale();

  const forward = (screen: string) =>
    (navigation as any).navigate(screen, { sectionId, subjectId, classLabel, subjectLabel, date });

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('attendance_method_chooser.title', 'Take Attendance')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subjectLabel ?? ''}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.prompt}>{t('attendance_method_chooser.prompt', 'How do you want to take attendance today?')}</Text>

        <MethodTile
          icon={<IconHandTap color={EMERALD} />}
          title={t('attendance_method_chooser.manual_title', 'Manual')}
          description={t('attendance_method_chooser.manual_desc', 'Swipe through the roster - right for present, left for absent, up for excused, down for late.')}
          onPress={() => forward('TeacherAttendanceRoster')}
        />

        <MethodTile
          icon={<IconQrCode color={EMERALD} />}
          title={t('attendance_method_chooser.scan_title', 'Scan ID / QR')}
          description={t('attendance_method_chooser.scan_desc', "Point the camera at a student's ID card to check them in instantly.")}
          onPress={() => forward('AttendanceScan')}
        />

        <MethodTile
          icon={<IconFace color={SUBTLE} />}
          title={t('attendance_method_chooser.face_title', 'Face Scan')}
          description={t('attendance_method_chooser.face_desc', 'Facial recognition check-in is on the way.')}
          badge={t('attendance_method_chooser.coming_soon', 'Coming soon')}
          disabled
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  content: { padding: SPACING.md },
  prompt: { fontSize: 14, color: SUBTLE, marginBottom: SPACING.md, textAlign: 'center' },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.level2,
  },
  tileDisabled: { opacity: 0.55 },
  tileIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tileIconBoxDisabled: { backgroundColor: '#F1F3F2' },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileTitle: { fontSize: 15.5, fontWeight: '700', color: INK },
  tileBadge: { backgroundColor: '#F1F3F2', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tileBadgeText: { fontSize: 10.5, fontWeight: '700', color: SUBTLE },
  tileDesc: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 17 },
});
