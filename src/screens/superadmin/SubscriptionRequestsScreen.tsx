import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, CircleCheck, CircleX, Clock, Inbox, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  SubscriptionRequest,
  SubscriptionRequestStatus,
} from '../../services/superAdminService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS, COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;
const DANGER_SOFT = 'rgba(239,68,68,0.10)';
const AMBER = '#92400E';
const AMBER_SOFT = 'rgba(180,83,9,0.10)';

const QUICK_REASONS = [
  'Payment could not be verified',
  'Insufficient payment reference details',
  'Wrong plan for this school',
];

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function CloseIcon({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function EmptyIcon() {
  return <Inbox size={56} color={'#C4C9CF'} strokeWidth={1.6} />;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusChip({ status }: { status: SubscriptionRequestStatus }) {
  const meta =
    status === 'approved'
      ? { bg: EMERALD_SOFT, fg: EMERALD, label: 'Approved', Icon: CircleCheck }
      : status === 'rejected'
      ? { bg: DANGER_SOFT, fg: DANGER, label: 'Rejected', Icon: CircleX }
      : { bg: AMBER_SOFT, fg: AMBER, label: 'Pending', Icon: Clock };
  const { Icon } = meta;
  return (
    <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
      <Icon size={12} color={meta.fg} strokeWidth={2.4} />
      <Text style={[styles.statusChipText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

type BusyState = { id: number; action: 'approve' | 'reject' } | null;

function RequestCard({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: SubscriptionRequest;
  busy: BusyState;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isBusy = busy?.id === item.id;
  const isPending = item.status === 'pending';

  return (
    <View style={[styles.card, isBusy && styles.cardBusy]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.schoolName} numberOfLines={1}>
          {item.school?.title ?? 'Unknown school'}
        </Text>
        <StatusChip status={item.status} />
      </View>

      <View style={styles.detailBox}>
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Plan</Text>
          <Text style={styles.detailVal} numberOfLines={1}>
            {item.package ? `${item.package.name} (${item.package.price})` : '—'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Requested by</Text>
          <Text style={styles.detailVal} numberOfLines={1}>
            {item.requested_by?.name ?? '—'}
          </Text>
        </View>
        {!!item.payment_reference && (
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Payment note</Text>
            <Text style={styles.detailVal} numberOfLines={2}>
              {item.payment_reference}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailKey}>Submitted</Text>
          <Text style={styles.detailVal}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      {item.status === 'rejected' && !!item.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason given</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
      )}

      {isPending && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={onReject} disabled={isBusy}>
            {isBusy && busy?.action === 'reject' ? (
              <ActivityIndicator size="small" color={DANGER} />
            ) : (
              <Text style={styles.rejectBtnText}>Reject</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={onApprove} disabled={isBusy}>
            {isBusy && busy?.action === 'approve' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.approveBtnText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ApproveSheet({
  item,
  submitting,
  onConfirm,
  onClose,
}: {
  item: SubscriptionRequest | null;
  submitting: boolean;
  onConfirm: (paidAmount: string, paymentMethod: string) => void;
  onClose: () => void;
}) {
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  React.useEffect(() => {
    if (item) {
      setPaidAmount(item.package ? String(item.package.price) : '');
      setPaymentMethod(item.payment_reference ?? '');
    }
  }, [item]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <KeyboardAwareModal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={close} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Approve request</Text>
            <TouchableOpacity onPress={close} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetBody}>
            {item?.school?.title} will be activated on {item?.package?.name}.
          </Text>

          <Text style={styles.fieldLabel}>Amount Paid</Text>
          <TextInput style={styles.fieldInput} value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" />

          <Text style={styles.fieldLabel}>Payment Method</Text>
          <TextInput style={styles.fieldInput} value={paymentMethod} onChangeText={setPaymentMethod} placeholder="e.g. bank transfer" placeholderTextColor={SUBTLE} />

          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={() => onConfirm(paidAmount, paymentMethod)}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Approve & Activate</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareModal>
  );
}

function RejectSheet({
  item,
  submitting,
  onConfirm,
  onClose,
}: {
  item: SubscriptionRequest | null;
  submitting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  const close = () => {
    if (submitting) return;
    setReason('');
    onClose();
  };

  return (
    <KeyboardAwareModal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={close} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Reject request</Text>
            <TouchableOpacity onPress={close} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetBody}>{item?.school?.title} will be told why, so they can resubmit.</Text>

          <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
            <View style={styles.quickWrap}>
              {QUICK_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                    onPress={() => setReason(active ? '' : r)}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Or write your own reason (optional)"
              placeholderTextColor={SUBTLE}
              multiline
              maxLength={300}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, styles.dangerButton, submitting && { opacity: 0.6 }]}
            onPress={() => onConfirm(reason.trim())}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Reject</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareModal>
  );
}

type TabKey = SubscriptionRequestStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

/** Superadmin-only: review queue for admin-submitted subscription requests (SubscribeScreen.tsx). */
export default function SubscriptionRequestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [rows, setRows] = useState<SubscriptionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('pending');
  const [busy, setBusy] = useState<BusyState>(null);
  const [approveTarget, setApproveTarget] = useState<SubscriptionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubscriptionRequest | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setRows(await fetchSubscriptionRequests(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription requests.');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));
    }, [load]),
  );

  const counts = useMemo(
    () =>
      rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {} as Record<TabKey, number>),
    [rows],
  );
  const visible = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  const handleApprove = async (paidAmount: string, paymentMethod: string) => {
    if (!token || !approveTarget) return;
    setBusy({ id: approveTarget.id, action: 'approve' });
    try {
      const updated = await approveSubscriptionRequest(token, {
        request_id: approveTarget.id,
        paid_amount: paidAmount.trim() ? Number(paidAmount) : undefined,
        payment_method: paymentMethod.trim() || undefined,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setApproveTarget(null);
    } catch (err) {
      Alert.alert("Couldn't approve", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!token || !rejectTarget) return;
    setBusy({ id: rejectTarget.id, action: 'reject' });
    try {
      const updated = await rejectSubscriptionRequest(token, rejectTarget.id, reason || undefined);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setRejectTarget(null);
    } catch (err) {
      Alert.alert("Couldn't reject", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const emptyCopy: Record<TabKey, string> = {
    pending: 'No subscription requests waiting for review.',
    approved: 'No approved requests yet.',
    rejected: 'No rejected requests.',
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Subscription Requests</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          const n = counts[t.key] ?? 0;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {n > 0 ? (
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{n}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1].map((i) => (
            <Skeleton key={i} width="100%" height={160} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load().finally(() => setIsRefreshing(false));
              }}
              tintColor={EMERALD}
            />
          }
          renderItem={({ item }) => (
            <RequestCard item={item} busy={busy} onApprove={() => setApproveTarget(item)} onReject={() => setRejectTarget(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{emptyCopy[tab]}</Text>
            </View>
          }
        />
      )}

      <ApproveSheet
        item={approveTarget}
        submitting={busy?.action === 'approve'}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
      />
      <RejectSheet
        item={rejectTarget}
        submitting={busy?.action === 'reject'}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 4,
    backgroundColor: 'rgba(17,24,39,0.05)',
    borderRadius: RADIUS.pill,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  tabActive: { backgroundColor: '#FFFFFF', ...SHADOW.level1 },
  tabText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  tabTextActive: { color: INK, fontWeight: '800' },
  tabCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.09)',
  },
  tabCountActive: { backgroundColor: EMERALD },
  tabCountText: { fontSize: 10.5, fontWeight: '800', color: SUBTLE },
  tabCountTextActive: { color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.level1,
  },
  cardBusy: { opacity: 0.6 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  schoolName: { flex: 1, fontSize: 16, fontWeight: '800', color: INK },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  detailBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(17,24,39,0.035)',
    gap: 6,
  },
  detailRow: { flexDirection: 'row', gap: 10 },
  detailKey: { width: 92, fontSize: 12, color: SUBTLE, fontWeight: '600' },
  detailVal: { flex: 1, fontSize: 12.5, color: INK, fontWeight: '600' },

  reasonBox: { marginTop: 12, backgroundColor: 'rgba(17,24,39,0.04)', borderRadius: RADIUS.sm, padding: 12 },
  reasonLabel: { fontSize: 10.5, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  reasonText: { fontSize: 13, color: INK, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, height: 46, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: DANGER_SOFT },
  rejectBtnText: { color: DANGER, fontWeight: '700', fontSize: 14.5 },
  approveBtn: { backgroundColor: EMERALD },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 14, paddingHorizontal: 30 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { fontSize: 13, color: SUBTLE, lineHeight: 18, marginBottom: 6 },

  formSheet: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },

  quickWrap: { gap: 8, marginTop: 12 },
  quickChip: { borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: HAIRLINE, paddingHorizontal: 14, paddingVertical: 11 },
  quickChipActive: { borderColor: DANGER, backgroundColor: DANGER_SOFT },
  quickChipText: { fontSize: 13, color: INK, fontWeight: '600' },
  quickChipTextActive: { color: DANGER, fontWeight: '700' },
  reasonInput: {
    marginTop: 10,
    marginBottom: 4,
    minHeight: 74,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(17,24,39,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    color: INK,
    textAlignVertical: 'top',
  },

  submitButton: { backgroundColor: EMERALD, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  dangerButton: { backgroundColor: DANGER },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
