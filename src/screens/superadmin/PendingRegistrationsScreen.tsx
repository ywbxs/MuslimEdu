import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  PendingRegistration,
  fetchPendingSchoolRegistrations,
  approveSchoolRegistration,
  rejectSchoolRegistration,
} from '../../services/schoolRegistrationService';
import { Skeleton } from '../../components/Skeleton';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const DANGER = COLORS.danger;

const INSTITUTION_LABELS: Record<string, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}

function RegistrationCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: PendingRegistration;
  onApprove: (item: PendingRegistration) => void;
  onReject: (item: PendingRegistration) => void;
  busy: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.schoolName}>{item.school_name}</Text>
          <Text style={styles.institutionLabel}>{INSTITUTION_LABELS[item.institution_type] ?? item.institution_type}</Text>
        </View>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      {!!item.school_address && <Text style={styles.address}>{item.school_address}</Text>}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Admin applying</Text>
      <Text style={styles.adminName}>{item.admin_name}</Text>
      <Text style={styles.adminMeta}>{item.admin_email}{item.admin_phone ? ` · ${item.admin_phone}` : ''}</Text>

      <View style={styles.thumbRow}>
        {item.id_document_url ? (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: item.id_document_url }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.thumbLabel}>ID</Text>
          </View>
        ) : null}
        {item.selfie_url ? (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: item.selfie_url }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.thumbLabel}>Selfie</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => onReject(item)} disabled={busy}>
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => onApprove(item)} disabled={busy}>
          <Text style={styles.approveBtnText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Superadmin review queue for "Register Your School" self-service signups
 * (SchoolRegistrationScreen.tsx) - a school + its first admin exist only as
 * a pending application (backend contract documented in
 * schoolRegistrationService.ts, not yet implemented) until approved here.
 * Approving is expected to create the real School + admin User records
 * server-side so the admin can log in right after.
 */
export default function PendingRegistrationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await fetchPendingSchoolRegistrations(token);
      setRegistrations(rows.filter((r) => r.status === 'pending'));
    } catch (err: any) {
      Alert.alert("Couldn't load applications", err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onApprove = (item: PendingRegistration) => {
    Alert.alert('Approve application?', `${item.school_name} will be created with ${item.admin_name} as its admin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          if (!token) return;
          setBusyId(item.id);
          setRegistrations((prev) => prev.filter((r) => r.id !== item.id));
          try {
            await approveSchoolRegistration(token, item.id);
          } catch (err: any) {
            Alert.alert("Couldn't approve", err?.message ?? 'Please try again.');
            load();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const onReject = (item: PendingRegistration) => {
    Alert.alert('Reject application?', `${item.school_name}'s application will be rejected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setBusyId(item.id);
          setRegistrations((prev) => prev.filter((r) => r.id !== item.id));
          try {
            await rejectSchoolRegistration(token, item.id);
          } catch (err: any) {
            Alert.alert("Couldn't reject", err?.message ?? 'Please try again.');
            load();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Registrations</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={registrations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RegistrationCard item={item} onApprove={onApprove} onReject={onReject} busy={busyId === item.id} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={180} borderRadius={RADIUS.md} />
              <Skeleton width="100%" height={180} borderRadius={RADIUS.md} />
            </View>
          ) : (
            <Text style={styles.emptyText}>No pending applications.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  list: { padding: 16, paddingBottom: 40 },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: 16, ...SHADOW.level1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  schoolName: { fontSize: 16, fontWeight: '800', color: INK },
  institutionLabel: { fontSize: 12, color: EMERALD, fontWeight: '700', marginTop: 2 },
  date: { fontSize: 11.5, color: SUBTLE },
  address: { fontSize: 12.5, color: SUBTLE, marginTop: 6 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  sectionLabel: { fontSize: 11, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  adminName: { fontSize: 14.5, fontWeight: '700', color: INK, marginTop: 4 },
  adminMeta: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  thumbRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  thumbWrap: { alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: RADIUS.sm, backgroundColor: '#EDEFF2' },
  thumbLabel: { fontSize: 10.5, color: SUBTLE, marginTop: 4, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FCEDED' },
  rejectBtnText: { color: DANGER, fontWeight: '700', fontSize: 13.5 },
  approveBtn: { backgroundColor: EMERALD },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
});
