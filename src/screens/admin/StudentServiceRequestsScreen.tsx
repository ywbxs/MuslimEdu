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
  AdminServiceRequest,
  fetchAdminServiceRequests,
  updateAdminServiceRequest,
} from '../../services/studentPortalService';

/**
 * M5 student portal — admin/staff handling of student service requests
 * (guidance/counselling tickets and other catalog services). Backend:
 * StudentPortalController::adminServiceRequestList/adminServiceRequestUpdate,
 * verified live this session.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const WARN = '#B7791F';
const INFO = '#2563AC';

type Filter = 'open' | 'in_progress' | 'resolved' | 'all';

function statusColor(status: AdminServiceRequest['status']) {
  if (status === 'resolved') return EMERALD;
  if (status === 'cancelled') return SUBTLE;
  if (status === 'in_progress') return INFO;
  return WARN;
}

function statusLabel(status: AdminServiceRequest['status']) {
  if (status === 'in_progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function StudentServiceRequestsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdminServiceRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<AdminServiceRequest | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminServiceRequests(token);
      setRequests(data);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load service requests.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  const onStart = async (req: AdminServiceRequest) => {
    if (!token) return;
    setBusyId(req.id);
    try {
      await updateAdminServiceRequest(token, req.id, 'in_progress');
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'in_progress' } : r)));
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const openResolve = (req: AdminServiceRequest) => {
    setResolveTarget(req);
    setResolveNote('');
    setResolveVisible(true);
  };

  const onResolve = async () => {
    if (!token || !resolveTarget) return;
    setResolving(true);
    try {
      await updateAdminServiceRequest(token, resolveTarget.id, 'resolved', resolveNote.trim() || undefined);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === resolveTarget.id ? { ...r, status: 'resolved', resolution_note: resolveNote.trim() || null } : r,
        ),
      );
      setResolveVisible(false);
    } catch (e: any) {
      Alert.alert('Could not resolve', e?.message ?? 'Please try again.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>Loading service requests…</Text>
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

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Service Requests</Text>
          <Text style={styles.headerSub}>Guidance, counselling and other student service tickets</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {(['open', 'in_progress', 'resolved', 'all'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : statusLabel(f as AdminServiceRequest['status'])}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No requests in this view.</Text>
          </View>
        ) : (
          visible.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{req.subject}</Text>
                  <Text style={styles.rowSub}>
                    {req.student?.name ?? 'Unknown student'}
                    {req.student?.code ? ` · ${req.student.code}` : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    {req.service_label} · {req.reference_no}
                  </Text>
                  {req.details ? <Text style={styles.rowSub}>{req.details}</Text> : null}
                  {req.status === 'resolved' && req.resolution_note ? (
                    <Text style={[styles.rowSub, { color: EMERALD }]}>Response: {req.resolution_note}</Text>
                  ) : null}
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(req.status)}1A` }]}>
                  <Text style={[styles.statusPillText, { color: statusColor(req.status) }]}>
                    {statusLabel(req.status)}
                  </Text>
                </View>
              </View>
              {req.status === 'open' || req.status === 'in_progress' ? (
                <View style={styles.actionsRow}>
                  {req.status === 'open' ? (
                    <TouchableOpacity onPress={() => onStart(req)} disabled={busyId === req.id}>
                      <Text style={styles.actionLink}>{busyId === req.id ? 'Working…' : 'Start working'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => openResolve(req)} disabled={busyId === req.id}>
                    <Text style={styles.actionLink}>Resolve</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={resolveVisible} animationType="slide" transparent onRequestClose={() => setResolveVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve Request</Text>
            <Text style={styles.label}>Response note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={resolveNote}
              onChangeText={setResolveNote}
              placeholder="What was done or decided"
              placeholderTextColor={SUBTLE}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setResolveVisible(false)} disabled={resolving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onResolve} disabled={resolving}>
                {resolving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Resolve</Text>}
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

  filterRow: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: BORDER },
  filterRowContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
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
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 18 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontSize: 11.5, fontWeight: '800' },

  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  actionLink: { fontSize: 13, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 6 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  textArea: { height: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
