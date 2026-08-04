import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchMySchedule } from '../../services/academicScheduleService';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
import { saveLocalFileToDevice } from '../../utils/downloadFile';
import StudentIdCard, { CARD_THEMES, CardTheme } from '../../components/StudentIdCard';
import GlassBackground from '../../components/glass/GlassBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../theme/glass';

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

/**
 * A student/parent views their own ID card and can export it as an image.
 * The card's data (name/photo/code) comes straight from the logged-in
 * AuthUser - no new backend call needed for the card itself. Section is
 * best-effort from the student's own published schedule (fetchMySchedule,
 * already used by UpcomingClassesCard/EnrollmentStatusCard) since the
 * self-service profile endpoints don't expose class/section text.
 */
export default function StudentIdCardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const { t } = useLocale();
  const cardRef = useRef<View>(null);

  const [theme, setTheme] = useState<CardTheme>(CARD_THEMES[0]);
  const [sectionName, setSectionName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
  const [schoolBackground, setSchoolBackground] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Every role has a card - a teacher/staff account gets the "Staff ID
  // Card" label instead of "Student ID Card", same component either way.
  const isStaff = user?.role !== 'student' && user?.role !== 'parent';

  useEffect(() => {
    if (!token) return;
    if (!isStaff) {
      fetchMySchedule(token)
        .then((rows) => setSectionName(rows[0]?.section_name ?? null))
        .catch(() => {
          // Best-effort enrichment only - the card still works with just
          // name/photo/code if this fails or the student has no schedule yet.
        });
    }
    fetchMySchoolBranding(token)
      .then((branding) => {
        setSchoolName(branding.name);
        setSchoolLogo(branding.logo);
        setSchoolAddress(branding.address ?? null);
        setSchoolBackground(branding.id_card_background);
      })
      .catch(() => {
        // Best-effort - falls back to the default gradient theme below.
      });
  }, [token, isStaff]);

  if (!user) return null;

  const handleExport = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const fileName = `student-id-${user.code ?? user.id}.png`;
      const savedPath = await saveLocalFileToDevice(uri, fileName);
      Alert.alert(
        t('student_id_card.saved_title', 'Saved'),
        t('student_id_card.saved_message', 'Your ID card was saved to your device: {path}').replace('{path}', savedPath),
      );
    } catch (err) {
      Alert.alert(
        t('student_id_card.export_error_title', 'Could not export'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isStaff ? t('student_id_card.staff_title', 'My Staff ID Card') : t('student_id_card.title', 'My ID Card')}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cardWrap} ref={cardRef} collapsable={false}>
          <StudentIdCard
            student={{
              name: user.name,
              photo: user.photo ?? null,
              code: user.code ?? String(user.id),
              sectionName,
              schoolName,
              schoolLogoUrl: schoolLogo,
              schoolAddress,
              address: user.address ?? null,
              cardType: isStaff ? 'staff' : 'student',
            }}
            theme={theme}
            backgroundImageUrl={schoolBackground}
          />
        </View>

        {schoolBackground ? null : (
          <>
            <Text style={styles.themeLabel}>{t('student_id_card.theme_label', 'Background')}</Text>
            <View style={styles.themeRow}>
              {CARD_THEMES.map((th) => (
                <TouchableOpacity
                  key={th.key}
                  style={[styles.themeSwatch, { backgroundColor: th.colors[1] }, theme.key === th.key && styles.themeSwatchActive]}
                  onPress={() => setTheme(th)}
                  activeOpacity={0.85}
                />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
          {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('student_id_card.export', 'Save to Device')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },

  content: { padding: SPACING.lg, alignItems: 'center' },
  cardWrap: { marginBottom: SPACING.lg },

  themeLabel: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', marginBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.lg },
  themeSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: EMERALD },

  exportBtn: {
    alignSelf: 'stretch',
    backgroundColor: EMERALD,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
