import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Hand, QrCode, ScanFace } from 'lucide-react-native';
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
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconHandTap({ color, size = 26 }: { color: string; size?: number }) {
  return <Hand size={size} color={color} strokeWidth={1.8} />;
}
function IconQrCode({ color, size = 26 }: { color: string; size?: number }) {
  return <QrCode size={size} color={color} strokeWidth={1.8} />;
}
function IconFace({ color, size = 26 }: { color: string; size?: number }) {
  return <ScanFace size={size} color={color} strokeWidth={1.8} />;
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
