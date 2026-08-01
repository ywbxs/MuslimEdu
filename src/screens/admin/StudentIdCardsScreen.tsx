import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Polyline, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudents, StudentSummary } from '../../services/adminService';
import { saveLocalFileToDevice } from '../../utils/downloadFile';
import StudentIdCard, { CARD_THEMES, CardTheme } from '../../components/StudentIdCard';
import UserAvatar from '../../components/UserAvatar';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import GlassBackground from '../../components/glass/GlassBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
function IconClose({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function TileSkeleton() {
  return (
    <View style={styles.tile}>
      <SkeletonCircle size={48} />
      <Skeleton width="70%" height={12} style={{ marginTop: 10 }} />
    </View>
  );
}

/**
 * Admin bento grid of every student's ID card - "sync all students
 * automatically" just means every student already has a card the moment
 * they have a `code` (a field every user already has), so this is purely a
 * browsing/export UI, nothing to generate or persist server-side.
 */
export default function StudentIdCardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const cardRef = useRef<View>(null);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [theme, setTheme] = useState<CardTheme>(CARD_THEMES[0]);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    fetchStudents(token)
      .then(setStudents)
      .catch((err) => setError(err instanceof Error ? err.message : t('student_id_cards.load_error', 'Could not load students.')))
      .finally(() => setIsLoading(false));
  }, [token, t]);

  useEffect(load, [load]);

  const handleExport = async () => {
    if (!cardRef.current || !selected) return;
    setIsExporting(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const fileName = `student-id-${selected.code ?? selected.id}.png`;
      const savedPath = await saveLocalFileToDevice(uri, fileName);
      Alert.alert(
        t('student_id_cards.saved_title', 'Saved'),
        t('student_id_cards.saved_message', "{name}'s ID card was saved to your device: {path}")
          .replace('{name}', selected.name)
          .replace('{path}', savedPath),
      );
    } catch (err) {
      Alert.alert(
        t('student_id_cards.export_error_title', 'Could not export'),
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
        <Text style={styles.headerTitle}>{t('student_id_cards.title', 'Student ID Cards')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => <TileSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('student_id_cards.empty', 'No students found.')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={() => setSelected(item)}>
              <UserAvatar name={item.name} photo={item.photo} size={48} dotColor={null} />
              <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
              {item.code ? <Text style={styles.tileCode} numberOfLines={1}>{item.code}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelected(null)} hitSlop={10}>
              <IconClose color={SUBTLE} />
            </TouchableOpacity>

            {selected ? (
              <View style={styles.modalCardWrap} ref={cardRef} collapsable={false}>
                <StudentIdCard
                  student={{
                    name: selected.name,
                    photo: selected.photo,
                    code: selected.code ?? String(selected.id),
                    className: selected.class_name,
                    sectionName: selected.section_name,
                  }}
                  theme={theme}
                />
              </View>
            ) : null}

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

            <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
              {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('student_id_cards.export', 'Save to Device')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },
  emptyText: { color: SUBTLE, fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.md, gap: SPACING.sm },
  listContent: { padding: SPACING.md },
  row: { gap: SPACING.sm },
  tile: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOW.level1,
  },
  tileName: { fontSize: 13, fontWeight: '700', color: INK, marginTop: 8, textAlign: 'center' },
  tileCode: { fontSize: 11, color: SUBTLE, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: SURFACE, borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', width: '100%' },
  modalCloseBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  modalCardWrap: { marginBottom: SPACING.md },

  themeRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  themeSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: EMERALD },

  exportBtn: { alignSelf: 'stretch', backgroundColor: EMERALD, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
