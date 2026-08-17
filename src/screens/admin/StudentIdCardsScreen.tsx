import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';
import { ChevronLeft, Image as ImageIcon, X, ChevronRight, Users, Check } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudents, fetchChildProfile, StudentSummary, ChildProfile } from '../../services/adminService';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
import { saveLocalFileToDevice } from '../../utils/downloadFile';
import StudentIdCard, { CARD_THEMES, CardTheme } from '../../components/StudentIdCard';
import UserAvatar from '../../components/UserAvatar';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import GlassBackground from '../../components/glass/GlassBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING, BRAND } from '../../theme/glass';

const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const BORDER = COLORS.border;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconClose({ color, size = 18 }: { color: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.2} />;
}
function IconImage({ color, size = 18 }: { color: string; size?: number }) {
  return <ImageIcon size={size} color={color} strokeWidth={1.8} />;
}
function IconCheckCircle({ color, filled, size = 20 }: { color: string; filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" fill={filled ? color : '#FFFFFF'} stroke={color} strokeWidth={1.8} />
      {filled ? <Path d="M8 12.5l2.5 2.5L16 9" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}
function IconChevronRight({ color = SUBTLE, size = 18 }: { color?: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.2} />;
}
function IconUsers({ color = SUBTLE, size = 30 }: { color?: string; size?: number }) {
  return <Users size={size} color={color} strokeWidth={1.6} />;
}
function IconCheck({ color, size = 15 }: { color: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={3} />;
}

function RowSkeleton({ isLast }: { isLast?: boolean }) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <SkeletonCircle size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={13} style={{ marginBottom: 6, borderRadius: 4 }} />
        <Skeleton width="35%" height={10} style={{ borderRadius: 4 }} />
      </View>
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
  const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ChildProfile | null>(null);
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
        setSchoolAddress(branding?.address ?? null);
        setSchoolLogo(branding?.logo ?? null);
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

  // Full profile (DOB, emergency contact, signature) isn't in the list
  // response - only the single-record admin_child_profile has it - so it's
  // fetched on demand the moment a student is opened. The card still
  // renders immediately with the summary fields while this resolves.
  useEffect(() => {
    if (!selected || !token) {
      setSelectedProfile(null);
      return;
    }
    let cancelled = false;
    fetchChildProfile(token, selected.id)
      .then((profile) => {
        if (!cancelled) setSelectedProfile(profile);
      })
      .catch(() => {
        // Best-effort - the card falls back to the summary fields.
      });
    return () => {
      cancelled = true;
    };
  }, [selected, token]);

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
        <View style={styles.listContent}>
          <View style={styles.listCardWrap}>
            {[0, 1, 2, 3, 4].map((i) => <RowSkeleton key={i} isLast={i === 4} />)}
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <IconUsers />
          </View>
          <Text style={styles.emptyText}>{t('student_id_cards.empty', 'No students found.')}</Text>
        </View>
      ) : (
        <View style={styles.listCardWrap}>
          <FlatList
            data={students}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={isSelectMode ? { paddingBottom: 100 } : undefined}
            renderItem={({ item, index }) => {
              const isChecked = selectedIds.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.row, index !== students.length - 1 && styles.rowDivider]}
                  activeOpacity={0.7}
                  onPress={() => (isSelectMode ? toggleSelected(item.id) : setSelected(item))}
                >
                  {isSelectMode ? (
                    <View style={styles.checkBadge}>
                      <IconCheckCircle color={BRAND.emeraldDeep} filled={isChecked} />
                    </View>
                  ) : null}
                  <UserAvatar name={item.name} photo={item.photo} size={44} dotColor={null} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    {item.code ? <Text style={styles.rowCode} numberOfLines={1}>{item.code}</Text> : null}
                  </View>
                  {!isSelectMode ? <IconChevronRight /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
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
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelected(null)} hitSlop={10} activeOpacity={0.8}>
            <IconClose color="#FFFFFF" />
          </TouchableOpacity>

          {selected ? (
            <View style={styles.modalCardWrap} ref={cardRef} collapsable={false}>
              <StudentIdCard
                student={{
                  name: selected.name,
                  nameAr: selectedProfile?.name_ar ?? selected.name_ar,
                  // Prefer the freshly-fetched profile's photo over the
                  // list-summary one - admin_student_list is a summary
                  // endpoint that may not carry a photo even when the
                  // student has one on file; admin_child_profile is the
                  // authoritative source.
                  photo: selectedProfile?.photo ?? selected.photo,
                  code: selected.code ?? String(selected.id),
                  personType: 'student',
                  className: selected.class_name,
                  sectionName: selected.section_name,
                  schoolName,
                  schoolAddress,
                  schoolLogoUrl: schoolLogo,
                  dob: selectedProfile?.birthday,
                  address: selectedProfile?.address ?? selected.address,
                  emergencyContactName: selectedProfile?.emergency_contact_name,
                  emergencyContactPhone: selectedProfile?.emergency_contact_phone,
                  signatureUrl: selectedProfile?.signature,
                }}
                theme={theme}
                backgroundImageUrl={schoolBackground}
              />
            </View>
          ) : null}

          {schoolBackground ? null : (
            <View style={styles.themeRow}>
              {CARD_THEMES.map((th) => (
                <TouchableOpacity key={th.key} style={styles.themeSwatchWrap} onPress={() => setTheme(th)} activeOpacity={0.85}>
                  <View style={[styles.themeSwatch, { backgroundColor: th.colors[1] }, theme.key === th.key && styles.themeSwatchActive]}>
                    {theme.key === th.key ? <IconCheck color="#FFFFFF" /> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
            {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('student_id_cards.export', 'Save to Device')}</Text>}
          </TouchableOpacity>
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
              nameAr: batchStudent.name_ar,
              photo: batchStudent.photo,
              code: batchStudent.code ?? String(batchStudent.id),
              personType: 'student',
              className: batchStudent.class_name,
              sectionName: batchStudent.section_name,
              schoolName,
              schoolAddress,
              schoolLogoUrl: schoolLogo,
              address: batchStudent.address,
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
  // BRAND.emeraldDeep, not EMERALD - EMERALD (#1FAE64) text on the white
  // header measures 2.88:1, below WCAG AA's 4.5:1 minimum. Deep emerald
  // measures 5.42:1.
  selectToggleText: { color: BRAND.emeraldDeep, fontWeight: '700', fontSize: 14 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: { color: SUBTLE, fontSize: 14 },

  // A single grouped card of hairline-divided rows (Contacts-app style)
  // instead of a 2-column tile grid - the grid left a dead gap whenever
  // the result count was odd, and buried the select-mode checkbox in a
  // tiny corner badge instead of a proper leading row control.
  listContent: { paddingTop: SPACING.md, flex: 1 },
  listCardWrap: {
    flex: 1,
    marginHorizontal: SPACING.md,
    backgroundColor: SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    ...SHADOW.level1,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowName: { fontSize: 15, fontWeight: '700', color: INK },
  rowCode: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  checkBadge: { marginRight: 12 },

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
  selectBarBtn: { backgroundColor: BRAND.emeraldDeep, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
  selectBarBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },

  // The card floats directly on the dark backdrop (Apple Wallet-pass
  // style) instead of nesting inside a second white rounded box, which
  // doubled the rounding/shadow and buried the card under redundant
  // chrome.
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,20,15,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCardWrap: { marginBottom: SPACING.lg },

  themeRow: { flexDirection: 'row', gap: 14, marginBottom: SPACING.lg },
  themeSwatchWrap: { padding: 3 },
  themeSwatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: '#FFFFFF' },

  exportBtn: {
    alignSelf: 'stretch',
    maxWidth: 288,
    backgroundColor: BRAND.emeraldDeep,
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },

  batchCaptureWrap: { position: 'absolute', top: -2000, left: 0 },
});
