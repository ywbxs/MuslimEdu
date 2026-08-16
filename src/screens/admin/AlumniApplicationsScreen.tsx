import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  PendingAlumniRegistration,
  fetchPendingAlumniRegistrations,
  approveAlumniRegistration,
  rejectAlumniRegistration,
} from '../../services/alumniRegistrationService';
import { Skeleton } from '../../components/Skeleton';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const DANGER = COLORS.danger;

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}

function ApplicationCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: PendingAlumniRegistration;
  onApprove: (item: PendingAlumniRegistration) => void;
  onReject: (item: PendingAlumniRegistration) => void;
  busy: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.email}{item.phone ? ` · ${item.phone}` : ''}</Text>
        </View>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Graduation Year</Text>
        <Text style={styles.detailValue}>{item.graduation_year}</Text>
      </View>
      {!!item.program && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Program / Degree</Text>
          <Text style={styles.detailValue}>{item.program}</Text>
        </View>
      )}
      {!!item.notes && (
        <View style={styles.notesWrap}>
          <Text style={styles.notesText}>{item.notes}</Text>
        </View>
      )}

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
 * Admin (school-scoped, not superadmin) review queue for "Create Alumni
 * Account" self-service signups (AlumniRegistrationScreen.tsx) - a former
 * student of THIS school is this school's decision, not a platform-wide
 * one, unlike SchoolRegistrationScreen's superadmin-reviewed applications.
 * Backend scopes the list/approve/reject routes to the calling admin's own
 * school_id server-side (see alumniRegistrationService.ts's documented
 * contract) - this screen never needs to filter or pass a school id itself.
 */
export default function AlumniApplicationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [registrations, setRegistrations] = useState<PendingAlumniRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await fetchPendingAlumniRegistrations(token);
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

  const onApprove = (item: PendingAlumniRegistration) => {
    Alert.alert('Approve application?', `${item.name} will be added as an alumni.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          if (!token) return;
          setBusyId(item.id);
          setRegistrations((prev) => prev.filter((r) => r.id !== item.id));
          try {
            await approveAlumniRegistration(token, item.id);
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

  const onReject = (item: PendingAlumniRegistration) => {
    Alert.alert('Reject application?', `${item.name}'s application will be rejected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setBusyId(item.id);
          setRegistrations((prev) => prev.filter((r) => r.id !== item.id));
          try {
            await rejectAlumniRegistration(token, item.id);
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
        <Text style={styles.headerTitle}>Alumni Applications</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={registrations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ApplicationCard item={item} onApprove={onApprove} onReject={onReject} busy={busyId === item.id} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={140} borderRadius={RADIUS.md} />
              <Skeleton width="100%" height={140} borderRadius={RADIUS.md} />
            </View>
          ) : (
            <Text style={styles.emptyText}>No pending alumni applications.</Text>
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
  name: { fontSize: 16, fontWeight: '800', color: INK },
  meta: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  date: { fontSize: 11.5, color: SUBTLE },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 12.5, color: SUBTLE },
  detailValue: { fontSize: 13, color: INK, fontWeight: '600' },
  notesWrap: { backgroundColor: '#F5F6F7', borderRadius: RADIUS.sm, padding: 10, marginTop: 8 },
  notesText: { fontSize: 12.5, color: INK, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FCEDED' },
  rejectBtnText: { color: DANGER, fontWeight: '700', fontSize: 13.5 },
  approveBtn: { backgroundColor: EMERALD },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
});
