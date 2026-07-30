import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import {
  fetchStudents,
  fetchChildProfile,
  StudentSummary,
  ChildProfile,
  ChildStatus,
} from '../../services/adminService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const DANGER = '#E5484D';
const DANGER_SOFT = '#FCEDED';
const AMBER = '#C88A11';
const AMBER_SOFT = '#FBF1DD';

const STATUS_COLORS: Record<ChildStatus, { dot: string; chipBg: string; chipText: string; label: string }> = {
  active: { dot: EMERALD, chipBg: EMERALD_SOFT, chipText: EMERALD, label: 'Active' },
  pending: { dot: AMBER, chipBg: AMBER_SOFT, chipText: AMBER, label: 'Pending' },
  inactive: { dot: DANGER, chipBg: DANGER_SOFT, chipText: DANGER, label: 'Inactive' },
};

const AVATAR_PALETTE = [EMERALD_SOFT, '#E5EEFB', '#F3E8FB', '#FDEBE0', '#E3F6F1'];
const AVATAR_TEXT_PALETTE = [EMERALD, '#3B6FD1', '#8B4FC4', '#C4661F', '#1B9E86'];

function paletteIndex(id: number) {
  return Math.abs(id) % AVATAR_PALETTE.length;
}

function formatJoined(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Inline stroke icons, matching the app's existing SVG icon style ---
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
function IconMail({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v14H4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M4 6l8 7 8-7" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function IconPhone({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconHeart({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconCap({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M2 9l10-4 10 4-10 4L2 9z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconUser({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconIdCard({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18v12H3z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={8} cy={12} r={2} stroke={color} strokeWidth={1.6} />
      <Line x1={13} y1={10} x2={18} y2={10} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={18} y2={14} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function Avatar({
  id,
  name,
  photo,
  size = 44,
}: {
  id: number;
  name: string;
  photo: string | null;
  size?: number;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  const idx = paletteIndex(id);

  if (photo && !photoFailed) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F0F0F0' }}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: AVATAR_PALETTE[idx],
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: AVATAR_TEXT_PALETTE[idx] }}>{initial}</Text>
    </View>
  );
}

function StatusDot({ status }: { status: ChildStatus }) {
  return <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status].dot }]} />;
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

// --- Profile bottom sheet ----------------------------------------------
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>{icon}</View>
      <View style={styles.flex1}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ChildProfileSheet({
  visible,
  studentId,
  fallback,
  onClose,
}: {
  visible: boolean;
  studentId: number | null;
  fallback: StudentSummary | null;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !studentId || !token) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProfile(null);
    fetchChildProfile(token, studentId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, studentId, token]);

  const person = profile ?? fallback;
  const status: ChildStatus = person?.status ?? 'active';
  const joined = formatJoined(person?.joined_date);
  const orphanProfile = profile?.orphan_profile;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.profileSheet}>
          <View style={styles.sheetHandle} />

          {isLoading && !person ? (
            <View style={styles.profileLoadingWrap}>
              <SkeletonCircle size={72} style={{ marginBottom: 14 }} />
              <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
              <Skeleton width="65%" height={12} />
            </View>
          ) : person ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent}>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.profileCloseBtn}>
                <IconClose color={SUBTLE} />
              </TouchableOpacity>

              <View style={styles.profileHeaderCol}>
                <Avatar id={person.id} name={person.name} photo={person.photo} size={76} />
                <Text style={styles.profileName}>{person.name}</Text>
                <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status].chipBg }]}>
                  <View style={[styles.statusChipDot, { backgroundColor: STATUS_COLORS[status].dot }]} />
                  <Text style={[styles.statusChipText, { color: STATUS_COLORS[status].chipText }]}>
                    {STATUS_COLORS[status].label}
                  </Text>
                </View>
              </View>

              {error ? <Text style={styles.profileErrorText}>{error} - showing what's on hand.</Text> : null}

              <View style={styles.profileSection}>
                <InfoRow icon={<IconMail color={SUBTLE} />} label="Email" value={person.email || '—'} />
                {person.phone ? <InfoRow icon={<IconPhone color={SUBTLE} />} label="Phone" value={person.phone} /> : null}
                {joined ? <InfoRow icon={<IconCalendar color={SUBTLE} />} label="Joined" value={joined} /> : null}
                {person.orphan_id_number ? (
                  <InfoRow icon={<IconIdCard color={SUBTLE} />} label="Orphan ID" value={person.orphan_id_number} />
                ) : null}
                {profile?.class_name || profile?.section_name ? (
                  <InfoRow
                    icon={<IconCap color={SUBTLE} />}
                    label="Class"
                    value={[profile?.class_name, profile?.section_name].filter(Boolean).join(' · ')}
                  />
                ) : null}
              </View>

              {orphanProfile && (orphanProfile.guardian_name || orphanProfile.guardian_phone) ? (
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionLabel}>Guardian</Text>
                  {orphanProfile.guardian_name ? (
                    <InfoRow
                      icon={<IconUser color={SUBTLE} />}
                      label={orphanProfile.guardian_relation ?? 'Guardian'}
                      value={orphanProfile.guardian_name}
                    />
                  ) : null}
                  {orphanProfile.guardian_phone ? (
                    <InfoRow icon={<IconPhone color={SUBTLE} />} label="Guardian phone" value={orphanProfile.guardian_phone} />
                  ) : null}
                </View>
              ) : null}

              {orphanProfile && (orphanProfile.health_status || orphanProfile.special_needs) ? (
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionLabel}>Health & wellbeing</Text>
                  {orphanProfile.health_status ? (
                    <InfoRow icon={<IconHeart color={SUBTLE} />} label="Health status" value={orphanProfile.health_status} />
                  ) : null}
                  {orphanProfile.special_needs ? (
                    <InfoRow icon={<IconHeart color={SUBTLE} />} label="Special needs" value={orphanProfile.special_needs} />
                  ) : null}
                </View>
              ) : null}

              {orphanProfile?.admission_reason ? (
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionLabel}>Admission note</Text>
                  <Text style={styles.profileNoteText}>{orphanProfile.admission_reason}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.profileLoadingWrap}>
              <Text style={styles.profileErrorText}>{error ?? 'No profile found.'}</Text>
            </View>
          )}
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
  const navigation = useNavigation();
  const { token, user } = useAuth();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<StudentSummary | null>(null);

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

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

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

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <IconChevronLeft color={EMERALD} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={[styles.filterBtn, isFilterActive && styles.filterBtnActive]}
          onPress={() => setFilterSheetOpen(true)}
          hitSlop={8}
        >
          <IconFilter color={isFilterActive ? '#FFFFFF' : EMERALD} />
        </TouchableOpacity>
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
                onPress={() => setSelectedChild(item)}
              >
                <StatusDot status={status} />
                <Avatar id={item.id} name={item.name} photo={item.photo} />
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

      <ChildProfileSheet
        visible={!!selectedChild}
        studentId={selectedChild?.id ?? null}
        fallback={selectedChild}
        onClose={() => setSelectedChild(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  title: { fontSize: 18, fontWeight: '700', color: INK },
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
    backgroundColor: CANVAS,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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

  profileSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
