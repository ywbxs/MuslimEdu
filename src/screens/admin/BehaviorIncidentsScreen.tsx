import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  BehaviorCategory,
  BehaviorIncident,
  BehaviorSeverity,
  BehaviorStatus,
  IncidentDraft,
  deleteBehaviorIncident,
  fetchBehaviorCategories,
  fetchBehaviorIncidents,
  notifyParentOfIncident,
  saveBehaviorIncident,
} from '../../services/behaviorService';
import {
  ClassSection,
  ClassStudent,
  fetchAllSections,
  fetchClassStudents,
  fetchMyClasses,
} from '../../services/teacherClassService';

/**
 * M4 Behavior & discipline module — per the handoff, this had no table,
 * routes, or screens at all before this round. Admins see every incident
 * in their school; teachers see incidents they reported plus incidents
 * for sections where they're the homeroom teacher (see BehaviorController).
 *
 * "Notify parent" only records that a human marked it done — it does not
 * send anything. Actual parent communication is separate, still-unbuilt
 * work per the roadmap.
 *
 * Never executed against a live backend.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const ADMIN_ROLES = [1, 2];

const SEVERITY_LABELS: Record<BehaviorSeverity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
};

const STATUS_LABELS: Record<BehaviorStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

export default function BehaviorIncidentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role_id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<BehaviorIncident[]>([]);
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);

  const [statusFilter, setStatusFilter] = useState<BehaviorStatus | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<BehaviorIncident | null>(null);
  const [saving, setSaving] = useState(false);

  const [fSectionId, setFSectionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [fStudentId, setFStudentId] = useState<number | null>(null);
  const [fCategoryId, setFCategoryId] = useState<number | null>(null);
  const [fSeverity, setFSeverity] = useState<BehaviorSeverity>('minor');
  const [fDescription, setFDescription] = useState('');
  const [fActionTaken, setFActionTaken] = useState('');
  const [fIncidentDate, setFIncidentDate] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [inc, cats, secs] = await Promise.all([
        fetchBehaviorIncidents(token, { status: statusFilter }),
        fetchBehaviorCategories(token),
        isAdmin
          ? fetchAllSections(token).then((rows) => rows.map((r) => ({ id: r.id, name: r.name })))
          : fetchMyClasses(token).then((rows: ClassSection[]) =>
              rows.map((r) => ({ id: r.section_id, name: r.section_name }))
            ),
      ]);
      setIncidents(inc);
      setCategories(cats);
      setSections(secs);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load behavior incidents.');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryLabel = useCallback(
    (id: number) => categories.find((c) => c.id === id)?.label ?? 'Category',
    [categories]
  );

  const loadRoster = async (sectionId: number) => {
    if (!token) return;
    setRosterLoading(true);
    try {
      const r = await fetchClassStudents(token, sectionId);
      setRoster(r.students);
    } catch (e: any) {
      Alert.alert("Couldn't load students", e?.message ?? 'Please try again.');
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFSectionId(null);
    setRoster([]);
    setFStudentId(null);
    setFCategoryId(categories[0]?.id ?? null);
    setFSeverity('minor');
    setFDescription('');
    setFActionTaken('');
    setFIncidentDate(new Date().toISOString().slice(0, 10));
    setFormVisible(true);
  };

  const openEdit = (inc: BehaviorIncident) => {
    setEditing(inc);
    setFSectionId(inc.section_id);
    setRoster(inc.student ? [{ id: inc.student.id, name: inc.student.name, email: inc.student.email ?? '', photo: null, phone: null, gender: null, address: null }] : []);
    setFStudentId(inc.student_id);
    setFCategoryId(inc.behavior_category_id);
    setFSeverity(inc.severity);
    setFDescription(inc.description);
    setFActionTaken(inc.action_taken ?? '');
    setFIncidentDate(inc.incident_date?.slice(0, 10) ?? '');
    setFormVisible(true);
  };

  const onSelectSection = (sectionId: number) => {
    setFSectionId(sectionId);
    setFStudentId(null);
    loadRoster(sectionId);
  };

  const onSave = async () => {
    if (!token) return;
    if (!editing && !fStudentId) {
      Alert.alert('Missing info', 'Pick a section and a student first.');
      return;
    }
    if (!fCategoryId || !fDescription.trim() || !fIncidentDate.trim()) {
      Alert.alert('Missing info', 'Category, description, and date are all required.');
      return;
    }
    setSaving(true);
    try {
      const draft: IncidentDraft = {
        id: editing?.id,
        student_id: editing ? undefined : fStudentId ?? undefined,
        section_id: fSectionId,
        behavior_category_id: fCategoryId,
        severity: fSeverity,
        description: fDescription.trim(),
        action_taken: fActionTaken.trim() || null,
        incident_date: fIncidentDate.trim(),
      };
      const saved = await saveBehaviorIncident(token, draft);
      setIncidents((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [saved, ...others];
      });
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (inc: BehaviorIncident) => {
    Alert.alert('Delete this incident?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteBehaviorIncident(token, inc.id);
            setIncidents((prev) => prev.filter((x) => x.id !== inc.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const onNotifyParent = async (inc: BehaviorIncident) => {
    if (!token) return;
    try {
      const saved = await notifyParentOfIncident(token, inc.id);
      setIncidents((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    }
  };

  const advanceStatus = async (inc: BehaviorIncident, status: BehaviorStatus) => {
    if (!token) return;
    try {
      const saved = await saveBehaviorIncident(token, {
        id: inc.id,
        behavior_category_id: inc.behavior_category_id,
        severity: inc.severity,
        description: inc.description,
        action_taken: inc.action_taken,
        incident_date: inc.incident_date.slice(0, 10),
        status,
      });
      setIncidents((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>Loading behavior incidents…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't load this</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusOptions: (BehaviorStatus | null)[] = [null, 'open', 'reviewed', 'resolved', 'escalated'];

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Behavior & Discipline</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? 'All incidents in your school' : 'Incidents you reported or your homeroom'}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {statusOptions.map((s) => (
          <TouchableOpacity
            key={s ?? 'all'}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s ? STATUS_LABELS[s] : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {incidents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No behavior incidents on record.</Text>
          </View>
        ) : (
          incidents.map((inc) => (
            <View key={inc.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{inc.student?.name ?? `Student ${inc.student_id}`}</Text>
                  <Text style={styles.rowSub}>
                    {inc.category?.label ?? categoryLabel(inc.behavior_category_id)} · {SEVERITY_LABELS[inc.severity]} ·{' '}
                    {inc.incident_date?.slice(0, 10)}
                    {inc.section?.name ? ` · ${inc.section.name}` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusBadge,
                    inc.status === 'resolved'
                      ? styles.statusResolved
                      : inc.status === 'escalated'
                      ? styles.statusEscalated
                      : inc.status === 'reviewed'
                      ? styles.statusReviewed
                      : styles.statusOpen,
                  ]}
                >
                  {STATUS_LABELS[inc.status]}
                </Text>
              </View>
              <Text style={styles.description}>{inc.description}</Text>
              {!!inc.action_taken && <Text style={styles.actionTaken}>Action taken: {inc.action_taken}</Text>}
              <Text style={styles.reportedBy}>
                Reported by {inc.reporter?.name ?? 'a teacher'}
                {inc.parent_notified_at ? ' · Parent notified' : ''}
              </Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => openEdit(inc)}>
                  <Text style={styles.actionLink}>Edit</Text>
                </TouchableOpacity>
                {inc.status !== 'resolved' && (
                  <TouchableOpacity onPress={() => advanceStatus(inc, 'resolved')}>
                    <Text style={styles.actionLink}>Mark resolved</Text>
                  </TouchableOpacity>
                )}
                {!inc.parent_notified_at && (
                  <TouchableOpacity onPress={() => onNotifyParent(inc)}>
                    <Text style={styles.actionLink}>Notify parent</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => confirmDelete(inc)}>
                  <Text style={[styles.actionLink, styles.deleteLink]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Log Incident</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Incident' : 'Log Incident'}</Text>

              {!editing && (
                <>
                  <Text style={styles.label}>Section</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {sections.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.chip, fSectionId === s.id && styles.chipActive]}
                        onPress={() => onSelectSection(s.id)}
                      >
                        <Text style={[styles.chipText, fSectionId === s.id && styles.chipTextActive]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Student</Text>
                  {rosterLoading ? (
                    <ActivityIndicator color={EMERALD} style={{ marginTop: 8 }} />
                  ) : (
                    <ScrollView style={styles.studentList} nestedScrollEnabled>
                      {roster.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.studentRow, fStudentId === s.id && styles.studentRowActive]}
                          onPress={() => setFStudentId(s.id)}
                        >
                          <Text style={[styles.studentRowText, fStudentId === s.id && styles.studentRowTextActive]}>
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, fCategoryId === c.id && styles.chipActive]}
                    onPress={() => {
                      setFCategoryId(c.id);
                      if (c.default_severity) setFSeverity(c.default_severity);
                    }}
                  >
                    <Text style={[styles.chipText, fCategoryId === c.id && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Severity</Text>
              <View style={styles.chipRow}>
                {(['minor', 'moderate', 'major'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, fSeverity === s && styles.chipActive]}
                    onPress={() => setFSeverity(s)}
                  >
                    <Text style={[styles.chipText, fSeverity === s && styles.chipTextActive]}>{SEVERITY_LABELS[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={fIncidentDate} onChangeText={setFIncidentDate} placeholder="2026-07-28" />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={fDescription}
                onChangeText={setFDescription}
                multiline
                placeholder="What happened"
              />

              <Text style={styles.label}>Action taken (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={fActionTaken}
                onChangeText={setFActionTaken}
                multiline
                placeholder="What was done about it"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  filterRow: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F3F2', marginRight: 8 },
  filterChipActive: { backgroundColor: EMERALD },
  filterChipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  filterChipTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  description: { fontSize: 13, color: INK, marginTop: 10, lineHeight: 18 },
  actionTaken: { fontSize: 12, color: SUBTLE, marginTop: 6, fontStyle: 'italic' },
  reportedBy: { fontSize: 11, color: SUBTLE, marginTop: 8 },

  statusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  statusOpen: { color: '#9A6700', backgroundColor: '#FEF3C7' },
  statusReviewed: { color: '#1E40AF', backgroundColor: '#DBEAFE' },
  statusResolved: { color: '#166534', backgroundColor: '#DCFCE7' },
  statusEscalated: { color: DANGER, backgroundColor: '#FEE2E2' },

  actionsRow: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, flexWrap: 'wrap' },
  actionLink: { fontSize: 12.5, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  addBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 12 },
  chipScroll: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFBFA', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },
  studentList: { marginTop: 8, maxHeight: 140, borderWidth: 1, borderColor: BORDER, borderRadius: 12 },
  studentRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: BORDER },
  studentRowActive: { backgroundColor: EMERALD_SOFT },
  studentRowText: { fontSize: 13.5, color: INK },
  studentRowTextActive: { color: EMERALD, fontWeight: '700' },
  input: { marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
