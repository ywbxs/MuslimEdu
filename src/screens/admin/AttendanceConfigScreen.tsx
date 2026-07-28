import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
  AttendanceMethodConfig,
  AttendanceStatusConfig,
  deleteAttendanceMethod,
  deleteAttendanceStatus,
  fetchAttendanceMethods,
  fetchAttendanceStatuses,
  saveAttendanceMethod,
  saveAttendanceStatus,
} from '../../services/attendanceConfigService';

/**
 * §4.13 Attendance configuration builder — lets each school define its own
 * attendance statuses (beyond the 5 system defaults) and capture methods
 * (beyond manual/QR/face) with zero code changes, per the spec's acceptance
 * criterion. Backend: AttendanceConfigController (verified wired — see
 * MuslimEdu-status-handoff §3 Round 4).
 *
 * This screen has never been run against a live backend — see the
 * project's own definition of done.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';

type Tab = 'statuses' | 'methods';

export default function AttendanceConfigScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>('statuses');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<AttendanceStatusConfig[]>([]);
  const [methods, setMethods] = useState<AttendanceMethodConfig[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingStatus, setEditingStatus] = useState<AttendanceStatusConfig | null>(null);
  const [editingMethod, setEditingMethod] = useState<AttendanceMethodConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields (shared by both status & method forms; unused fields ignored)
  const [fCode, setFCode] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fCountsPresent, setFCountsPresent] = useState(true);
  const [fRequiresRemark, setFRequiresRemark] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([fetchAttendanceStatuses(token), fetchAttendanceMethods(token)]);
      setStatuses(s);
      setMethods(m);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load attendance configuration.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openNewStatus = () => {
    setEditingStatus(null);
    setEditingMethod(null);
    setFCode('');
    setFLabel('');
    setFCountsPresent(true);
    setFRequiresRemark(false);
    setFormVisible(true);
  };

  const openEditStatus = (s: AttendanceStatusConfig) => {
    setEditingStatus(s);
    setEditingMethod(null);
    setFCode(s.code);
    setFLabel(s.label);
    setFCountsPresent(s.counts_as_present);
    setFRequiresRemark(s.requires_remark);
    setFormVisible(true);
  };

  const openNewMethod = () => {
    setEditingMethod(null);
    setEditingStatus(null);
    setFCode('');
    setFLabel('');
    setFormVisible(true);
  };

  const openEditMethod = (m: AttendanceMethodConfig) => {
    setEditingMethod(m);
    setEditingStatus(null);
    setFCode(m.code);
    setFLabel(m.label);
    setFormVisible(true);
  };

  const onSave = async () => {
    if (!token) return;
    if (!fLabel.trim()) {
      Alert.alert('Label required', 'Give this a display label first.');
      return;
    }
    setSaving(true);
    try {
      if (tab === 'statuses') {
        const saved = await saveAttendanceStatus(token, {
          id: editingStatus?.id,
          code: editingStatus ? undefined : fCode.trim().toLowerCase().replace(/\s+/g, '_'),
          label: fLabel.trim(),
          counts_as_present: fCountsPresent,
          requires_remark: fRequiresRemark,
        });
        setStatuses((prev) => {
          const others = prev.filter((s) => s.id !== saved.id);
          return [...others, saved].sort((a, b) => a.sort_order - b.sort_order);
        });
      } else {
        const saved = await saveAttendanceMethod(token, {
          id: editingMethod?.id,
          code: editingMethod ? undefined : fCode.trim().toLowerCase().replace(/\s+/g, '_'),
          label: fLabel.trim(),
        });
        setMethods((prev) => {
          const others = prev.filter((m) => m.id !== saved.id);
          return [...others, saved].sort((a, b) => a.sort_order - b.sort_order);
        });
      }
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteStatus = (s: AttendanceStatusConfig) => {
    if (s.is_system_default) {
      Alert.alert('System default', 'This status is built-in and can only be deactivated, not deleted.');
      return;
    }
    Alert.alert('Delete status?', `"${s.label}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteAttendanceStatus(token, s.id);
            setStatuses((prev) => prev.filter((x) => x.id !== s.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const confirmDeleteMethod = (m: AttendanceMethodConfig) => {
    if (m.is_system_default) {
      Alert.alert('Built-in method', 'The manual capture method cannot be deleted.');
      return;
    }
    Alert.alert('Delete method?', `"${m.label}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteAttendanceMethod(token, m.id);
            setMethods((prev) => prev.filter((x) => x.id !== m.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const toggleActive = async (
    row: AttendanceStatusConfig | AttendanceMethodConfig,
    which: Tab
  ) => {
    if (!token) return;
    try {
      if (which === 'statuses') {
        const s = row as AttendanceStatusConfig;
        const saved = await saveAttendanceStatus(token, {
          id: s.id,
          label: s.label,
          counts_as_present: s.counts_as_present,
          requires_remark: s.requires_remark,
          is_active: !s.is_active,
        });
        setStatuses((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      } else {
        const m = row as AttendanceMethodConfig;
        const saved = await saveAttendanceMethod(token, { id: m.id, label: m.label, is_active: !m.is_active });
        setMethods((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      }
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>Loading attendance configuration…</Text>
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

  const rows = tab === 'statuses' ? statuses : methods;
  const isEmpty = rows.length === 0;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Attendance Configuration</Text>
          <Text style={styles.headerSub}>Statuses and capture methods for your school</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'statuses' && styles.tabActive]}
          onPress={() => setTab('statuses')}
        >
          <Text style={[styles.tabText, tab === 'statuses' && styles.tabTextActive]}>Statuses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'methods' && styles.tabActive]}
          onPress={() => setTab('methods')}
        >
          <Text style={[styles.tabText, tab === 'methods' && styles.tabTextActive]}>Capture Methods</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {tab === 'statuses'
                ? 'No attendance statuses yet. The 5 defaults will appear the first time this loads for your school.'
                : 'No capture methods yet. Manual, QR, and Face Recognition defaults will appear the first time this loads for your school.'}
            </Text>
          </View>
        ) : (
          rows.map((row) => {
            const isStatus = tab === 'statuses';
            const s = row as AttendanceStatusConfig;
            const m = row as AttendanceMethodConfig;
            return (
              <View key={row.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexCol}>
                    <Text style={styles.rowTitle}>{row.label}</Text>
                    <Text style={styles.rowSub}>
                      {row.code}
                      {row.is_system_default ? ' · built-in' : ''}
                      {isStatus ? (s.counts_as_present ? ' · counts as present' : ' · counts as absent') : ''}
                      {isStatus && s.requires_remark ? ' · remark required' : ''}
                    </Text>
                  </View>
                  <Switch
                    value={row.is_active}
                    onValueChange={() => toggleActive(row, tab)}
                    trackColor={{ false: '#D8DED9', true: EMERALD }}
                  />
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => (isStatus ? openEditStatus(s) : openEditMethod(m))}>
                    <Text style={styles.actionLink}>Edit</Text>
                  </TouchableOpacity>
                  {!row.is_system_default && (
                    <TouchableOpacity
                      onPress={() => (isStatus ? confirmDeleteStatus(s) : confirmDeleteMethod(m))}
                    >
                      <Text style={[styles.actionLink, styles.deleteLink]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={tab === 'statuses' ? openNewStatus : openNewMethod}
        >
          <Text style={styles.addBtnText}>{tab === 'statuses' ? '+ Add Status' : '+ Add Method'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {tab === 'statuses'
                ? editingStatus
                  ? 'Edit Status'
                  : 'New Status'
                : editingMethod
                ? 'Edit Method'
                : 'New Method'}
            </Text>

            {!editingStatus && !editingMethod && (
              <>
                <Text style={styles.label}>Code</Text>
                <TextInput
                  style={styles.input}
                  value={fCode}
                  onChangeText={setFCode}
                  placeholder="e.g. field_trip"
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>Lowercase, no spaces — used in records and can't be changed later.</Text>
              </>
            )}

            <Text style={styles.label}>Label</Text>
            <TextInput style={styles.input} value={fLabel} onChangeText={setFLabel} placeholder="Display name" />

            {tab === 'statuses' && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Counts as present</Text>
                  <Switch value={fCountsPresent} onValueChange={setFCountsPresent} trackColor={{ false: '#D8DED9', true: EMERALD }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Requires a remark</Text>
                  <Switch value={fRequiresRemark} onValueChange={setFRequiresRemark} trackColor={{ false: '#D8DED9', true: EMERALD }} />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
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

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: '#FFFFFF' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: '#F1F3F2' },
  tabActive: { backgroundColor: EMERALD },
  tabText: { fontSize: 13.5, fontWeight: '700', color: SUBTLE },
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
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 10 },
  hint: { fontSize: 11.5, color: SUBTLE, marginTop: 3 },
  input: { marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
