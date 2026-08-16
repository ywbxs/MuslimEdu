import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchAdminFeeList, FeeInvoice } from '../../services/feeService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function SearchIcon({ color }: { color: string }) {
  return <Search size={17} color={color} strokeWidth={2} />;
}
function ChevronRightIcon({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}
function DocumentIcon({ color }: { color: string }) {
  return <FileText size={20} color={color} strokeWidth={1.8} />;
}
function EmptyIcon() {
  return <FileText size={56} color={"#C4C9CF"} strokeWidth={1.6} />;
}

type StatusFilter = 'all' | 'unpaid' | 'partial' | 'paid';

const STATUS_META: Record<string, { color: string; soft: string }> = {
  unpaid: { color: DANGER, soft: 'rgba(239,68,68,0.1)' },
  partial: { color: '#B8860B', soft: '#FBF2DE' },
  paid: { color: EMERALD, soft: EMERALD_SOFT },
};

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const InvoiceRow = React.memo(function InvoiceRow({
  item,
  onPress,
}: {
  item: FeeInvoice;
  onPress: (item: FeeInvoice) => void;
}) {
  const { t } = useLocale();
  const meta = STATUS_META[item.status] ?? STATUS_META.unpaid;
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => onPress(item)}>
      <View style={styles.rowIcon}>
        <DocumentIcon color={EMERALD} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowStudent} numberOfLines={1}>
          {item.student_name ?? t('admin_fee_reports.unknown_student', 'Unknown student')}
          {item.student_code ? ` · ${item.student_code}` : ''}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: meta.soft }]}>
          <Text style={[styles.statusPillText, { color: meta.color }]}>
            {money(item.paid_amount)} / {money(item.total_amount)}
          </Text>
        </View>
        {item.recorded_by_name ? (
          <Text style={styles.rowRecordedBy} numberOfLines={1}>
            {t('admin_fee_reports.recorded_by_prefix', 'Recorded by')} {item.recorded_by_name}
          </Text>
        ) : null}
      </View>
      <ChevronRightIcon color="#C4C9CF" />
    </TouchableOpacity>
  );
});

/**
 * Shared by admin (oversight) and Cashier (day-to-day collection) - the
 * dead 'fees' tile on AdminDashboard (route: null) now points here, and
 * CashierDashboard's Fee Reports / Record Payment cards both do too, the
 * latter with initialStatusFilter='unpaid' so a cashier's daily queue
 * lands pre-filtered instead of re-browsing everything each time.
 * Tapping any row opens RecordFeePaymentScreen for that invoice.
 */
export default function AdminFeeReportsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = useAuth();
  const { t } = useLocale();
  const initialStatusFilter = (route.params as { initialStatusFilter?: StatusFilter } | undefined)?.initialStatusFilter;

  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter ?? 'all');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchAdminFeeList(token);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_fee_reports.load_error', 'Failed to load fee reports.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') {
      list = list.filter((inv) => inv.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (inv) =>
          (inv.student_name ?? '').toLowerCase().includes(q) ||
          (inv.student_code ?? '').toLowerCase().includes(q) ||
          inv.title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [invoices, statusFilter, query]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('admin_fee_reports.filter_all', 'All') },
    { key: 'unpaid', label: t('admin_fee_reports.filter_unpaid', 'Unpaid') },
    { key: 'partial', label: t('admin_fee_reports.filter_partial', 'Partial') },
    { key: 'paid', label: t('admin_fee_reports.filter_paid', 'Paid') },
  ];

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('admin_fee_reports.header_title', 'Fee Reports')}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin_fee_reports.search_placeholder', 'Search student or invoice...')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={44} height={44} borderRadius={12} />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => (
            <InvoiceRow
              item={item}
              onPress={(inv) =>
                (navigation as any).navigate('RecordFeePayment', {
                  feeId: inv.id,
                  studentName: inv.student_name,
                  invoiceTitle: inv.title,
                  totalAmount: inv.total_amount,
                  paidAmount: inv.paid_amount,
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('admin_fee_reports.empty_title', 'No invoices found')}</Text>
              <Text style={styles.emptyBody}>
                {query || statusFilter !== 'all'
                  ? t('admin_fee_reports.empty_body_filtered', 'Try a different search or filter.')
                  : t('admin_fee_reports.empty_body_none', 'Invoices created for students will show up here.')}
              </Text>
            </View>
          }
        />
      )}
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
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  ...SHADOW.level1,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK, padding: 0 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  filterChipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
  filterChipTextActive: { color: '#FFFFFF' },

  listContent: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level2,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowStudent: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  rowRecordedBy: { fontSize: 11, color: SUBTLE, marginTop: 4 },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 6,
  },
  statusPillText: { fontSize: 11.5, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
