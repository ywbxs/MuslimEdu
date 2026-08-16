import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import { COLORS } from '../../theme/spatial';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';

function BackArrowIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2} />;
}

/**
 * Shown in place of any academic-subsystem screen when the signed-in user
 * belongs to an orphan school (see ACADEMIC_ROUTES in utils/orphanSchool).
 *
 * Orphan schools have no classes, sections, subjects, grading or enrollment
 * pipeline, so these screens have nothing to load - previously they rendered
 * empty pickers and failed requests instead of saying so.
 *
 * `onBack` is passed in rather than read from useNavigation(): RootNavigator
 * renders this from the navigator's `screenLayout`, which sits outside the
 * per-screen navigation context that hook needs.
 */
export default function AcademicUnavailableScreen({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backButton}>
            <BackArrowIcon />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>
          {t('academic_unavailable.header', 'Not available')}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>🏠</Text>
          </View>
          <Text style={styles.cardTitle}>
            {t('academic_unavailable.title', 'This section is for schools with classes')}
          </Text>
          <Text style={styles.cardDescription}>
            {t(
              'academic_unavailable.description',
              'Your institution is set up as an orphan school, so classes, subjects, grading and enrollment are turned off. Monthly reports and child profiles are used instead.',
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: INK },
  body: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 100 },
  card: { backgroundColor: EMERALD_SOFT, borderRadius: 24, padding: 28, alignItems: 'center' },
  emojiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: { fontSize: 28 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 8, textAlign: 'center' },
  cardDescription: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
});
