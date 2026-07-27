import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchStudents, StudentSummary, ChildStatus } from '../../services/adminService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';
import { ChildActionModal, ChildProfileSheet } from '../../components/ChildProfileSheet';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;
const DANGER = COLORS.danger;
const DANGER_SOFT = 'rgba(239,68,68,0.12)';
const AMBER = '#D97706';
const AMBER_SOFT = 'rgba(217,119,6,0.12)';

const STATUS_COLORS: Record<ChildStatus, { dot: string; chipBg: string; chipText: string; label: string }> = {
  active: { dot: EMERALD, chipBg: EMERALD_SOFT, chipText: EMERALD, label: 'Active' },
  pending: { dot: AMBER, chipBg: AMBER_SOFT, chipText: AMBER, label: 'Pending' },
  inactive: { dot: DANGER, chipBg: DANGER_SOFT, chipText: DANGER, label: 'Inactive' },
};

function formatJoined(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Inline stroke icons, matching the app's existing SVG icon style ---
function IconPlus({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconSearch({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={21} y1={21} x2={16.2} y2={16.2} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconFilter({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16l-6.5 8v6l-3 1.5v-7.5L4 5z" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendar({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v16H4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconClose({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheck({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
// --- Filter sheet -----------------------------------------------------
type FilterValue = 'all' | ChildStatus;

function FilterSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: FilterValue;
  onSelect: (v: FilterValue) => void;
  onClose: () => void;
}) {
  const options: { key: FilterValue; label: string }[] = [
    { key: 'all', label: 'All children' },
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'inactive', label: 'Inactive' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Filter</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <IconClose color={SUBTLE} />
            </TouchableOpacity>
          </View>
          {options.map((opt) => {
            const selected = value === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.filterOptionRow}
                activeOpacity={0.7}
                onPress={() => {
                  onSelect(opt.key);
                  onClose();
                }}
              >
                <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                  {opt.label}
                </Text>
                {selected ? (
                  <View style={styles.filterCheckCircle}>
                    <IconCheck color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.filterEmptyCircle} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Admin's Children directory: search, status filter, and a tap-through
 * bottom sheet with the full child profile. There's no separate "orphans
 * only" mode - orphan status is set per-school (school_type), not per-child,
 * so an orphanage admin's list is already all orphan children. The title
 * adapts based on the logged-in admin's school.
 */
export default function StudentListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token, user } = useAuth();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSearch = (route.params as { initialSearch?: string } | undefined)?.initialSearch ?? '';
  const [query, setQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<StudentSummary | null>(null);
  const [actionChild, setActionChild] = useState<StudentSummary | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchStudents(token);
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students.');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const title = user?.is_orphan ? 'Children' : 'Students';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || (s.status ?? 'active') === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [students, query, statusFilter]);

  const isFilterActive = statusFilter !== 'all';

  const handleChildAction = (action: 'profile' | 'documents' | 'report') => {
    const child = actionChild;
    setActionChild(null);
    if (!child) return;

    if (action === 'profile') {
      setSelectedChild(child);
      return;
    }
    if (action === 'documents') {
      (navigation as any).navigate('AdminUserDocuments', {
        userId: child.id,
        userName: child.name,
      });
      return;
    }
    // action === 'report'
    (navigation as any).navigate('AdminChildReportDetail', {
      studentId: child.id,
      studentName: child.name,
    });
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <IconChevronLeft color={EMERALD} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRightRow}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => (navigation as any).navigate('Admission')}
            hitSlop={8}
          >
            <IconPlus color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, isFilterActive && styles.filterBtnActive]}
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
          >
            <IconFilter color={isFilterActive ? '#FFFFFF' : EMERALD} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <IconSearch color={SUBTLE} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${title.toLowerCase()}...`}
          placeholderTextColor={SUBTLE}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.card}>
              <SkeletonCircle size={44} style={{ marginRight: 12 }} />
              <View style={styles.cardBody}>
                <Skeleton width="55%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="75%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {students.length === 0 ? `No ${title.toLowerCase()} found.` : 'No matches for your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />
          }
          renderItem={({ item }) => {
            const status = item.status ?? 'active';
            const joined = formatJoined(item.joined_date);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => setActionChild(item)}
              >
                <UserAvatar
                  name={item.name}
                  photo={item.photo}
                  size={44}
                  ringColor={HAIRLINE}
                  dotColor={STATUS_COLORS[status].dot}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.email}</Text>
                  {joined ? (
                    <View style={styles.joinedChip}>
                      <IconCalendar color={EMERALD} />
                      <Text style={styles.joinedChipText}>Joined {joined}</Text>
                    </View>
                  ) : null}
                </View>
                <IconChevronRight color="#C4C9CF" />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <FilterSheet
        visible={filterSheetOpen}
        value={statusFilter}
        onSelect={setStatusFilter}
        onClose={() => setFilterSheetOpen(false)}
      />

      <ChildActionModal
        visible={!!actionChild}
        child={actionChild}
        onClose={() => setActionChild(null)}
        onSelect={handleChildAction}
      />

      <ChildProfileSheet
        visible={!!selectedChild}
        studentId={selectedChild?.id ?? null}
        fallback={selectedChild}
        onClose={() => setSelectedChild(null)}
        canEdit
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 18, fontWeight: '700', color: INK },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD_SOFT,
  },
  filterBtnActive: { backgroundColor: EMERALD },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 16,
    height: 46,
    gap: 10,
    ...SHADOW.level1,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK, padding: 0 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  emptyText: { color: SUBTLE, fontSize: 15, textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
  ...SHADOW.level2,
  },
  cardBody: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15.5, fontWeight: '700', color: INK },
  meta: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  joinedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: EMERALD_SOFT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 7,
    gap: 5,
  },
  joinedChipText: { fontSize: 11.5, fontWeight: '600', color: EMERALD },

  // --- Sheets (filter + profile) ---
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetBackdropTouch: { flex: 1 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADDE1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },

  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  filterOptionText: { fontSize: 15.5, color: INK, fontWeight: '500' },
  filterOptionTextSelected: { color: EMERALD, fontWeight: '700' },
  filterCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D8DBDF',
  },

  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    gap: 12,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '700', color: INK },
  actionDesc: { fontSize: 12, color: SUBTLE, marginTop: 2 },

  profileSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
    minHeight: 260,
  },
  profileScrollContent: { paddingHorizontal: 22, paddingBottom: 36, paddingTop: 4 },
  profileCloseBtn: {
    alignSelf: 'flex-end',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  profileLoadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  profileHeaderCol: { alignItems: 'center', marginBottom: 18 },
  profileName: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 12 },
  profileErrorText: { color: DANGER, fontSize: 12.5, textAlign: 'center', marginBottom: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    gap: 6,
  },
  statusChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  profileSection: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 14,
    marginTop: 4,
  },
  profileSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: { fontSize: 11.5, color: SUBTLE, fontWeight: '600' },
  infoValue: { fontSize: 14.5, color: INK, fontWeight: '600', marginTop: 1 },
  profileNoteText: { fontSize: 13.5, color: INK, lineHeight: 19 },
});
