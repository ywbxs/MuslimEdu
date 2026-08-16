import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ArrowLeftRight, Check, ChevronLeft, Plus, Search, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchSectionRoster,
  fetchEligibleStudents,
  addStudentsToSection,
  removeStudentFromSection,
  transferStudentToSection,
  fetchAllSections,
  SectionRoster,
  SectionEnrolledStudent,
  EligibleStudent,
  SectionOption,
} from '../../services/teacherClassService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';
import { RADIUS } from '../../theme/glass';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Colors now come from academicTheme.ts (emerald variant) for light/dark support.

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconPlus({ color }: { color: string }) {
  return <Plus size={19} color={color} strokeWidth={2.4} />;
}
function IconClose({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function IconSearch({ color }: { color: string }) {
  return <Search size={18} color={color} strokeWidth={2} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check size={14} color={color} strokeWidth={3} />;
}
function IconSwap({ color }: { color: string }) {
  return <ArrowLeftRight size={16} color={color} strokeWidth={2} />;
}

function RowSkeleton() {
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <SkeletonCircle size={44} baseColor={theme.skeletonBase} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="55%" height={14} borderRadius={4} baseColor={theme.skeletonBase} />
        <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 7 }} baseColor={theme.skeletonBase} />
      </View>
    </View>
  );
}

// --- Add-students modal: search + multi-select from students not yet in this section ---
function AddStudentsModal({
  visible,
  sectionId,
  onClose,
  onAdded,
}: {
  visible: boolean;
  sectionId: number | undefined;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<EligibleStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (q: string) => {
      if (!token || !sectionId) return;
      setLoading(true);
      try {
        const data = await fetchEligibleStudents(token, sectionId, q);
        setCandidates(data);
      } catch (err) {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_students.load_students_error', 'Could not load students.'));
      } finally {
        setLoading(false);
      }
    },
    [token, sectionId, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (visible) {
        setSelectedIds([]);
        setSearch('');
        load('');
      }
    }, [visible, load])
  );

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSearchChange = (text: string) => {
    setSearch(text);
    load(text);
  };

  const handleConfirm = async () => {
    if (!token || !sectionId || selectedIds.length === 0) return;
    setSaving(true);
    try {
      await addStudentsToSection(token, sectionId, selectedIds);
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert(t('section_students.add_error', 'Could not add students'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.backButton}>
            <IconClose color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('section_students.add_students', 'Add Students')}</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.searchBar}>
          <IconSearch color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('section_students.search_placeholder', 'Search by name or email')}
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={handleSearchChange}
          />
        </View>

        {loading ? (
          <View style={styles.listContent}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('section_students.no_students_found', 'No students found')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('section_students.no_students_found_desc', 'Everyone matching this search is already enrolled here, or none exist yet.')}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const checked = selectedIds.includes(item.id);
              const elsewhere = item.current_section_id != null;
              return (
                <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => toggle(item.id)}>
                  <UserAvatar name={item.name} photo={item.photo} size={44} dotColor={null} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowEmail} numberOfLines={1}>
                      {elsewhere ? t('section_students.in_another_section', 'Currently in another section') : item.email}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? <IconCheck color={theme.onAccent} /> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, (selectedIds.length === 0 || saving) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={selectedIds.length === 0 || saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.confirmButtonText}>
                {selectedIds.length > 0
                  ? (selectedIds.length > 1
                      ? t('section_students.add_n_students', 'Add {n} students')
                      : t('section_students.add_one_student', 'Add {n} student')
                    ).replace('{n}', String(selectedIds.length))
                  : t('section_students.select_students', 'Select students')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Transfer modal: pick a different section for one student ---
function TransferModal({
  visible,
  student,
  currentSectionId,
  onClose,
  onTransferred,
}: {
  visible: boolean;
  student: SectionEnrolledStudent | null;
  currentSectionId: number | undefined;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!visible || !token) return;
      setLoading(true);
      fetchAllSections(token)
        .then((data) => setSections(data.filter((s) => s.id !== currentSectionId)))
        .catch((err) => Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_students.load_sections_error', 'Could not load sections.')))
        .finally(() => setLoading(false));
    }, [visible, token, currentSectionId, t])
  );

  const handlePick = async (section: SectionOption) => {
    if (!token || !student) return;
    setMovingId(section.id);
    try {
      await transferStudentToSection(token, student.id, section.id);
      onTransferred();
      onClose();
    } catch (err) {
      Alert.alert(t('section_students.transfer_error', 'Could not transfer'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setMovingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.backButton}>
            <IconClose color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('section_students.move', 'Move {name}').replace('{name}', student?.name ?? '')}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={styles.listContent}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('section_students.no_other_sections', 'No other sections')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const full = item.capacity != null && item.current_enrollment >= item.capacity;
              return (
                <TouchableOpacity
                  style={[styles.row, full && { opacity: 0.5 }]}
                  activeOpacity={0.8}
                  disabled={full || movingId != null}
                  onPress={() => handlePick(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowEmail}>
                      {item.class_name ?? t('section_students.unassigned_class', 'Unassigned class')} · {item.current_enrollment}
                      {item.capacity ? `/${item.capacity}` : ''} {t('section_students.students_suffix', 'students')}
                      {full ? ` · ${t('section_students.full', 'Full')}` : ''}
                    </Text>
                  </View>
                  {movingId === item.id ? <ActivityIndicator color={theme.accent} /> : <IconSwap color={theme.textSecondary} />}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

export default function SectionStudentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [roster, setRoster] = useState<SectionRoster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [transferTarget, setTransferTarget] = useState<SectionEnrolledStudent | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token || !sectionId) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSectionRoster(token, sectionId);
        setRoster(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('section_students.load_roster_error', 'Could not load the section roster.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, sectionId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const handleRemove = (student: SectionEnrolledStudent) => {
    Alert.alert(
      t('section_students.remove_title', 'Remove student'),
      t('section_students.remove_message', 'Remove {name} from this section?').replace('{name}', student.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('section_students.remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            if (!token || !sectionId) return;
            try {
              await removeStudentFromSection(token, sectionId, student.id);
              load({ silent: true });
            } catch (err) {
              Alert.alert(t('section_students.remove_error', 'Could not remove'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {roster ? `${roster.class_name ?? ''} · ${roster.section_name}` : t('section_students.title', 'Students')}
        </Text>
        <TouchableOpacity onPress={() => setAddVisible(true)} hitSlop={10} style={styles.addButton}>
          <IconPlus color={theme.accent} />
        </TouchableOpacity>
      </View>

      {roster ? (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {t('section_students.enrolled_count', '{current}{capacity} students enrolled')
              .replace('{current}', String(roster.current_enrollment))
              .replace('{capacity}', roster.capacity ? ` / ${roster.capacity}` : '')}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.listContent}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : (
        <FlatList
          data={roster?.students ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('section_students.empty_title', 'No students enrolled yet')}</Text>
                <Text style={styles.emptyDesc}>{t('section_students.empty_desc', 'Tap the + button to add students to this section.')}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <UserAvatar name={item.name} photo={item.photo} size={44} dotColor={null} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setTransferTarget(item)} hitSlop={8}>
                <IconSwap color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => handleRemove(item)} hitSlop={8}>
                <IconClose color={theme.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <AddStudentsModal
        visible={addVisible}
        sectionId={roster?.section_id ?? sectionId}
        onClose={() => setAddVisible(false)}
        onAdded={() => load({ silent: true })}
      />
      <TransferModal
        visible={!!transferTarget}
        student={transferTarget}
        currentSectionId={roster?.section_id ?? sectionId}
        onClose={() => setTransferTarget(null)}
        onTransferred={() => load({ silent: true })}
      />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { width: 32 },
  addButton: { width: 32, alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginHorizontal: 8 },
  summaryBar: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  summaryText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  listContent: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.elevation2,
  },
  rowName: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary },
  rowEmail: { fontSize: 12.5, color: theme.textSecondary, marginTop: 3 },
  iconButton: { padding: 6, marginLeft: 4 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: theme.dangerSoft, borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: theme.danger, fontSize: 13.5, textAlign: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.elevation1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: theme.textPrimary },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: theme.accent, borderColor: theme.accent },
  footer: { padding: 16, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  confirmButton: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmButtonDisabled: { backgroundColor: theme.accentSoft },
  confirmButtonText: { color: theme.onAccent, fontSize: 15, fontWeight: '700' },
});
