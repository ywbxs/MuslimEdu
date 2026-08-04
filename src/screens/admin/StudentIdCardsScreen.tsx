import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Polyline, Line, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudents, StudentSummary } from '../../services/adminService';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
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
function IconImage({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={4} x2={20} y2={4} stroke="transparent" />
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L15 15.2M14 14l1.6-1.6a2 2 0 0 1 2.8 0L20 14.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={8} y1={8} x2={8.01} y2={8} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheckCircle({ color, filled, size = 20 }: { color: string; filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" fill={filled ? color : '#FFFFFF'} stroke={color} strokeWidth={1.8} />
      {filled ? <Path d="M8 12.5l2.5 2.5L16 9" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
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
 *
 * Select mode lets an admin multi-select students and export all their
 * cards in one action instead of opening each one individually - each
 * selected student is rendered one at a time into an off-screen capture
 * view (batchCardRef) so react-native-view-shot only ever needs to
 * capture one on-screen node, not N simultaneous ones.
 */
export default function StudentIdCardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const cardRef = useRef<View>(null);
  const batchCardRef = useRef<View>(null);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolBackground, setSchoolBackground] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [theme, setTheme] = useState<CardTheme>(CARD_THEMES[0]);
  const [isExporting, setIsExporting] = useState(false);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchStudent, setBatchStudent] = useState<StudentSummary | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    Promise.all([fetchStudents(token), fetchMySchoolBranding(token).catch(() => null)])
      .then(([list, branding]) => {
        setStudents(list);
        setSchoolBackground(branding?.id_card_background ?? null);
        setSchoolName(branding?.name ?? null);
        setSchoolLogo(branding?.logo ?? null);
        setSchoolAddress(branding?.address ?? null);
      })
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

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Two animation-frame ticks give the just-set student's card time to
  // actually render (and its avatar image time to start loading) before
  // captureRef reads the view - a single tick isn't reliably enough on
  // Android.
  const waitForRender = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const handleBatchExport = async () => {
    const targets = students.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;

    setBatchProgress({ done: 0, total: targets.length });
    let successCount = 0;

    for (const student of targets) {
      setBatchStudent(student);
      await waitForRender();
      try {
        if (batchCardRef.current) {
          const uri = await captureRef(batchCardRef, { format: 'png', quality: 1 });
          await saveLocalFileToDevice(uri, `student-id-${student.code ?? student.id}.png`);
          successCount++;
        }
      } catch {
        // Keep going - one failed capture (e.g. a broken photo URL)
        // shouldn't stop the rest of the batch.
      }
      setBatchProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : null));
    }

    setBatchStudent(null);
    setBatchProgress(null);
    setIsSelectMode(false);
    setSelectedIds(new Set());
    Alert.alert(
      t('student_id_cards.batch_done_title', 'Export complete'),
      t('student_id_cards.batch_done_message', '{count} of {total} ID cards saved to your device.')
        .replace('{count}', String(successCount))
        .replace('{total}', String(targets.length)),
    );
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_id_cards.title', 'Student ID Cards')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => (navigation as any).navigate('IdCardTemplate')} hitSlop={10} style={styles.headerIconBtn}>
            <IconImage color={INK} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSelectMode} hitSlop={10}>
            <Text style={styles.selectToggleText}>
              {isSelectMode ? t('common.cancel', 'Cancel') : t('student_id_cards.select', 'Select')}
            </Text>
          </TouchableOpacity>
        </View>
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
          contentContainerStyle={[styles.listContent, isSelectMode && { paddingBottom: 100 }]}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('student_id_cards.empty', 'No students found.')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isChecked = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={styles.tile}
                activeOpacity={0.85}
                onPress={() => (isSelectMode ? toggleSelected(item.id) : setSelected(item))}
              >
                {isSelectMode ? (
                  <View style={styles.checkBadge}>
                    <IconCheckCircle color={EMERALD} filled={isChecked} />
                  </View>
                ) : null}
                <UserAvatar name={item.name} photo={item.photo} size={48} dotColor={null} />
                <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
                {item.code ? <Text style={styles.tileCode} numberOfLines={1}>{item.code}</Text> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {isSelectMode && selectedIds.size > 0 ? (
        <View style={[styles.selectBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Text style={styles.selectBarText}>
            {t('student_id_cards.n_selected', '{count} selected').replace('{count}', String(selectedIds.size))}
          </Text>
          <TouchableOpacity style={styles.selectBarBtn} onPress={handleBatchExport} activeOpacity={0.85} disabled={!!batchProgress}>
            {batchProgress ? (
              <Text style={styles.selectBarBtnText}>
                {t('student_id_cards.exporting_progress', 'Exporting {done}/{total}...')
                  .replace('{done}', String(batchProgress.done))
                  .replace('{total}', String(batchProgress.total))}
              </Text>
            ) : (
              <Text style={styles.selectBarBtnText}>{t('student_id_cards.export_all', 'Export All')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

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
                    schoolName,
                    schoolLogoUrl: schoolLogo,
                    schoolAddress,
                    address: selected.address ?? null,
                    dateOfBirth: selected.birthday ?? null,
                    cardType: 'student',
                  }}
                  theme={theme}
                  backgroundImageUrl={schoolBackground}
                />
              </View>
            ) : null}

            {schoolBackground ? null : (
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
            )}

            <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
              {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('student_id_cards.export', 'Save to Device')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Off-screen capture target for batch export - always mounted so
          batchCardRef stays stable across the export loop; content only
          renders while a batch is actually in progress. */}
      <View style={styles.batchCaptureWrap} ref={batchCardRef} collapsable={false}>
        {batchStudent ? (
          <StudentIdCard
            student={{
              name: batchStudent.name,
              photo: batchStudent.photo,
              code: batchStudent.code ?? String(batchStudent.id),
              className: batchStudent.class_name,
              sectionName: batchStudent.section_name,
              schoolName,
              schoolLogoUrl: schoolLogo,
              schoolAddress,
              address: batchStudent.address ?? null,
              dateOfBirth: batchStudent.birthday ?? null,
              cardType: 'student',
            }}
            theme={theme}
            backgroundImageUrl={schoolBackground}
          />
        ) : null}
      </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1, marginLeft: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconBtn: {},
  selectToggleText: { color: EMERALD, fontWeight: '700', fontSize: 14 },

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
    position: 'relative',
    ...SHADOW.level1,
  },
  tileName: { fontSize: 13, fontWeight: '700', color: INK, marginTop: 8, textAlign: 'center' },
  tileCode: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  checkBadge: { position: 'absolute', top: 8, right: 8 },

  selectBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    ...SHADOW.level2,
  },
  selectBarText: { fontSize: 13.5, fontWeight: '700', color: INK },
  selectBarBtn: { backgroundColor: EMERALD, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
  selectBarBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: SURFACE, borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', width: '100%' },
  modalCloseBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  modalCardWrap: { marginBottom: SPACING.md },

  themeRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  themeSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: EMERALD },

  exportBtn: { alignSelf: 'stretch', backgroundColor: EMERALD, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },

  batchCaptureWrap: { position: 'absolute', top: -2000, left: 0 },
});
