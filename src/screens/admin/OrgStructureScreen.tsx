import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  Faculty,
  FacultyDraft,
  Stream,
  StreamDraft,
  deleteFaculty,
  deleteStream,
  fetchFaculties,
  fetchStreams,
  saveFaculty,
  saveStream,
} from '../../services/orgStructureService';
import {
  PickerDepartment,
  Program,
  fetchDepartmentsForPicker,
  fetchPrograms,
} from '../../services/adminAcademicCatalogService';

/**
 * §4.1 leftovers: faculties/colleges/institutes (the tier above Department)
 * and streams/specializations (a subdivision below Department/Program).
 * Program<->Curriculum linking isn't a screen of its own — it's the new
 * Program picker added to CurriculumFormScreen.
 *
 * Never executed against a live backend.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';

type Tab = 'faculties' | 'streams';

const TYPE_FALLBACKS: Record<string, string> = {
  faculty: 'Faculty',
  college: 'College',
  institute: 'Institute',
};

export default function OrgStructureScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();
  const typeLabel = (type: string) => t(`org_structure.type_${type}`, TYPE_FALLBACKS[type] ?? type);

  const [tab, setTab] = useState<Tab>('faculties');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [departments, setDepartments] = useState<PickerDepartment[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [facultyFormVisible, setFacultyFormVisible] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [streamFormVisible, setStreamFormVisible] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [saving, setSaving] = useState(false);

  const [fName, setFName] = useState('');
  const [fCode, setFCode] = useState('');
  const [fType, setFType] = useState<'faculty' | 'college' | 'institute'>('faculty');

  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sKind, setSKind] = useState<'stream' | 'specialization'>('stream');
  const [sDepartmentId, setSDepartmentId] = useState<number | null>(null);
  const [sProgramId, setSProgramId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [f, s, d, p] = await Promise.all([
        fetchFaculties(token),
        fetchStreams(token),
        fetchDepartmentsForPicker(token),
        fetchPrograms(token),
      ]);
      setFaculties(f);
      setStreams(s);
      setDepartments(d);
      setPrograms(p);
    } catch (e: any) {
      setError(e?.message ?? t('org_structure.load_error', 'Could not load org structure.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const departmentName = useCallback(
    (id: number) => departments.find((d) => d.id === id)?.name ?? t('org_structure.department_fallback', 'Department {id}').replace('{id}', String(id)),
    [departments, t]
  );

  // --- Faculty form ---

  const openNewFaculty = () => {
    setEditingFaculty(null);
    setFName('');
    setFCode('');
    setFType('faculty');
    setFacultyFormVisible(true);
  };

  const openEditFaculty = (f: Faculty) => {
    setEditingFaculty(f);
    setFName(f.name);
    setFCode(f.code ?? '');
    setFType(f.type);
    setFacultyFormVisible(true);
  };

  const onSaveFaculty = async () => {
    if (!token) return;
    if (!fName.trim()) {
      Alert.alert(t('org_structure.name_required', 'Name required'), t('org_structure.name_required_message', 'Give this a name first.'));
      return;
    }
    setSaving(true);
    try {
      const draft: FacultyDraft = {
        id: editingFaculty?.id,
        name: fName.trim(),
        code: fCode.trim() || null,
        type: fType,
      };
      const saved = await saveFaculty(token, draft);
      setFaculties((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [...others, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setFacultyFormVisible(false);
    } catch (e: any) {
      Alert.alert(t('org_structure.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteFaculty = (f: Faculty) => {
    Alert.alert(t('org_structure.delete_title', 'Delete this?'), t('org_structure.delete_message', '"{name}" will be removed.').replace('{name}', f.name), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('org_structure.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteFaculty(token, f.id);
            setFaculties((prev) => prev.filter((x) => x.id !== f.id));
          } catch (e: any) {
            Alert.alert(t('org_structure.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  // --- Stream form ---

  const openNewStream = () => {
    setEditingStream(null);
    setSName('');
    setSCode('');
    setSKind('stream');
    setSDepartmentId(departments[0]?.id ?? null);
    setSProgramId(null);
    setStreamFormVisible(true);
  };

  const openEditStream = (s: Stream) => {
    setEditingStream(s);
    setSName(s.name);
    setSCode(s.code ?? '');
    setSKind(s.kind);
    setSDepartmentId(s.department_id);
    setSProgramId(s.program_id);
    setStreamFormVisible(true);
  };

  const onSaveStream = async () => {
    if (!token || !sDepartmentId) {
      Alert.alert(t('org_structure.missing_info', 'Missing info'), t('org_structure.choose_department', 'Choose a department first.'));
      return;
    }
    if (!sName.trim()) {
      Alert.alert(t('org_structure.name_required', 'Name required'), t('org_structure.name_required_message', 'Give this a name first.'));
      return;
    }
    setSaving(true);
    try {
      const draft: StreamDraft = {
        id: editingStream?.id,
        department_id: sDepartmentId,
        program_id: sProgramId,
        name: sName.trim(),
        code: sCode.trim() || null,
        kind: sKind,
      };
      const saved = await saveStream(token, draft);
      setStreams((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [...others, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setStreamFormVisible(false);
    } catch (e: any) {
      Alert.alert(t('org_structure.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteStream = (s: Stream) => {
    Alert.alert(t('org_structure.delete_title', 'Delete this?'), t('org_structure.delete_message', '"{name}" will be removed.').replace('{name}', s.name), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('org_structure.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteStream(token, s.id);
            setStreams((prev) => prev.filter((x) => x.id !== s.id));
          } catch (e: any) {
            Alert.alert(t('org_structure.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('org_structure.loading', 'Loading org structure…')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('org_structure.load_failed_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('org_structure.title', 'Org Structure')}</Text>
          <Text style={styles.headerSub}>{t('org_structure.subtitle', 'Faculties, colleges, institutes, streams')}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'faculties' && styles.tabActive]}
          onPress={() => setTab('faculties')}
        >
          <Text style={[styles.tabText, tab === 'faculties' && styles.tabTextActive]}>
            {t('org_structure.tab_faculties', 'Faculties / Colleges')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'streams' && styles.tabActive]}
          onPress={() => setTab('streams')}
        >
          <Text style={[styles.tabText, tab === 'streams' && styles.tabTextActive]}>
            {t('org_structure.tab_streams', 'Streams / Specializations')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {tab === 'faculties' ? (
          faculties.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t(
                  'org_structure.empty_faculties',
                  'No faculties, colleges, or institutes yet. Add one, then assign departments to it from the department editor.',
                )}
              </Text>
            </View>
          ) : (
            faculties.map((f) => (
              <View key={f.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexCol}>
                    <Text style={styles.rowTitle}>{f.name}</Text>
                    <Text style={styles.rowSub}>
                      {typeLabel(f.type)}
                      {f.code ? ` · ${f.code}` : ''} ·{' '}
                      {f.departments_count === 1
                        ? t('org_structure.one_department', '1 department')
                        : t('org_structure.n_departments', '{n} departments').replace('{n}', String(f.departments_count ?? 0))}
                      {f.status !== 'active' ? ` · ${t('org_structure.inactive', 'inactive')}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => openEditFaculty(f)}>
                    <Text style={styles.actionLink}>{t('common.edit', 'Edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteFaculty(f)}>
                    <Text style={[styles.actionLink, styles.deleteLink]}>{t('org_structure.delete', 'Delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : streams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('org_structure.empty_streams', 'No streams or specializations yet. Add one under a department, optionally tied to a section/class.')}
            </Text>
          </View>
        ) : (
          streams.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{s.name}</Text>
                  <Text style={styles.rowSub}>
                    {s.kind === 'specialization' ? t('org_structure.specialization', 'Specialization') : t('org_structure.stream', 'Stream')} ·{' '}
                    {s.department?.name ?? departmentName(s.department_id)}
                    {s.program?.name ? ` · ${s.program.name}` : ''}
                    {s.status !== 'active' ? ` · ${t('org_structure.inactive', 'inactive')}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => openEditStream(s)}>
                  <Text style={styles.actionLink}>{t('common.edit', 'Edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteStream(s)}>
                  <Text style={[styles.actionLink, styles.deleteLink]}>{t('org_structure.delete', 'Delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={tab === 'faculties' ? openNewFaculty : openNewStream}>
          <Text style={styles.addBtnText}>
            {tab === 'faculties' ? t('org_structure.add_faculty', '+ Add Faculty / College') : t('org_structure.add_stream', '+ Add Stream / Specialization')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Faculty form modal */}
      <KeyboardAwareModal visible={facultyFormVisible} animationType="slide" transparent onRequestClose={() => setFacultyFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingFaculty ? t('common.edit', 'Edit') : t('org_structure.new_faculty', 'New Faculty / College / Institute')}</Text>

            <Text style={styles.label}>{t('org_structure.type_label', 'Type')}</Text>
            <View style={styles.chipRow}>
              {(['faculty', 'college', 'institute'] as const).map((facultyType) => (
                <TouchableOpacity
                  key={facultyType}
                  style={[styles.chip, fType === facultyType && styles.chipActive]}
                  onPress={() => setFType(facultyType)}
                >
                  <Text style={[styles.chipText, fType === facultyType && styles.chipTextActive]}>{typeLabel(facultyType)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('org_structure.name_label', 'Name')}</Text>
            <TextInput style={styles.input} value={fName} onChangeText={setFName} placeholder={t('org_structure.faculty_name_placeholder', 'e.g. College of Engineering')} />

            <Text style={styles.label}>{t('org_structure.code_label', 'Code (optional)')}</Text>
            <TextInput style={styles.input} value={fCode} onChangeText={setFCode} placeholder="e.g. ENG" autoCapitalize="characters" />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFacultyFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveFaculty} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>{t('common.save', 'Save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* Stream form modal */}
      <KeyboardAwareModal visible={streamFormVisible} animationType="slide" transparent onRequestClose={() => setStreamFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingStream ? t('common.edit', 'Edit') : t('org_structure.new_stream', 'New Stream / Specialization')}</Text>

            <Text style={styles.label}>{t('org_structure.kind_label', 'Kind')}</Text>
            <View style={styles.chipRow}>
              {(['stream', 'specialization'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.chip, sKind === k && styles.chipActive]}
                  onPress={() => setSKind(k)}
                >
                  <Text style={[styles.chipText, sKind === k && styles.chipTextActive]}>
                    {k === 'stream' ? t('org_structure.stream', 'Stream') : t('org_structure.specialization', 'Specialization')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('org_structure.department_label', 'Department')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {departments.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, sDepartmentId === d.id && styles.chipActive]}
                  onPress={() => setSDepartmentId(d.id)}
                >
                  <Text style={[styles.chipText, sDepartmentId === d.id && styles.chipTextActive]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('org_structure.program_label', 'Section/Class (optional)')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, sProgramId === null && styles.chipActive]}
                onPress={() => setSProgramId(null)}
              >
                <Text style={[styles.chipText, sProgramId === null && styles.chipTextActive]}>{t('common.none', 'None')}</Text>
              </TouchableOpacity>
              {programs.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, sProgramId === p.id && styles.chipActive]}
                  onPress={() => setSProgramId(p.id)}
                >
                  <Text style={[styles.chipText, sProgramId === p.id && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('org_structure.name_label', 'Name')}</Text>
            <TextInput style={styles.input} value={sName} onChangeText={setSName} placeholder={t('org_structure.stream_name_placeholder', 'e.g. Science Stream')} />

            <Text style={styles.label}>{t('org_structure.code_label', 'Code (optional)')}</Text>
            <TextInput style={styles.input} value={sCode} onChangeText={setSCode} placeholder="e.g. SCI" autoCapitalize="characters" />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setStreamFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveStream} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>{t('common.save', 'Save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  center: { flex: 1, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: EMERALD, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: '#FFFFFF' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: '#F1F3F2' },
  tabActive: { backgroundColor: EMERALD },
  tabText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, textAlign: 'center' },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  actionLink: { fontSize: 13, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  addBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '88%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 10 },
  input: { marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipScroll: { marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFBFA', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
