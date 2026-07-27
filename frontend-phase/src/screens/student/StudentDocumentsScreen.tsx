import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import studentPortalService, { StudentDocument } from '../../services/studentPortalService';
import { C, relativeTime, tintFor } from '../nextPhaseTheme';

const LABEL = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function StudentDocumentsScreen() {
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [summary, setSummary] = useState({ requested: 0, issued: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [copies, setCopies] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await studentPortalService.documents();
      setDocs(res.documents);
      setTypes(res.document_types);
      setSummary(res.summary);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!selectedType) {
      Alert.alert('Pick a document', 'Choose what you need before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await studentPortalService.requestDocument(selectedType, purpose.trim() || undefined, Number(copies) || 1);
      setModalOpen(false);
      setSelectedType(null);
      setPurpose('');
      setCopies('1');
      load();
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = (doc: StudentDocument) => {
    Alert.alert('Cancel request', doc.label, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          try {
            await studentPortalService.cancelDocument(doc.id);
            load();
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const open = (doc: StudentDocument) => {
    if (!doc.download_url) return;
    Linking.openURL(doc.download_url).catch(() =>
      Alert.alert('Cannot open', 'No app on this device can open that file.'),
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        data={docs}
        keyExtractor={d => String(d.id)}
        contentContainerStyle={docs.length === 0 ? { flexGrow: 1 } : { paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={C.green}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={s.title}>My documents</Text>
            <Text style={s.sub}>Request official paperwork and download it once the office issues it.</Text>

            <View style={s.stats}>
              <Stat label='Pending' value={summary.requested} tint={C.amber} />
              <Stat label='Issued' value={summary.issued} tint={C.green} />
              <Stat label='Rejected' value={summary.rejected} tint={C.red} />
            </View>

            {error ? <Text style={s.banner}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No requests yet</Text>
            <Text style={s.emptyBody}>Tap the button below to request a transcript or certificate.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tint = tintFor(item.status);

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{item.label}</Text>
                <View style={[s.pill, { backgroundColor: tint.bg }]}>
                  <Text style={[s.pillText, { color: tint.fg }]}>{item.status}</Text>
                </View>
              </View>

              {item.purpose ? <Text style={s.cardBody}>{item.purpose}</Text> : null}

              <Text style={s.meta}>
                {item.reference_no ? item.reference_no + ' · ' : ''}
                {item.copies} cop{item.copies === 1 ? 'y' : 'ies'} · {relativeTime(item.created_at)}
              </Text>

              {item.rejected_reason ? <Text style={s.reject}>{item.rejected_reason}</Text> : null}

              <View style={s.actions}>
                {item.download_url ? (
                  <TouchableOpacity style={s.action} onPress={() => open(item)}>
                    <Text style={[s.actionText, { color: C.green }]}>Download</Text>
                  </TouchableOpacity>
                ) : null}
                {item.status === 'requested' ? (
                  <TouchableOpacity style={s.action} onPress={() => cancel(item)}>
                    <Text style={[s.actionText, { color: C.red }]}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity style={s.fab} onPress={() => setModalOpen(true)}>
        <Text style={s.fabText}>Request a document</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType='slide' transparent onRequestClose={() => setModalOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Request a document</Text>

            <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps='handled'>
              <Text style={s.label}>What do you need</Text>
              <View style={s.chipWrap}>
                {types.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, selectedType === t && s.chipActive]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[s.chipText, selectedType === t && s.chipTextActive]}>{LABEL(t)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>What is it for</Text>
              <TextInput
                style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={purpose}
                onChangeText={setPurpose}
                multiline
                placeholder='University application, visa, employer...'
                placeholderTextColor='#9AA8A3'
              />

              <Text style={s.label}>Copies</Text>
              <TextInput
                style={[s.input, { width: 90 }]}
                value={copies}
                onChangeText={v => setCopies(v.replace(/[^0-9]/g, ''))}
                keyboardType='number-pad'
                maxLength={2}
              />
            </ScrollView>

            <View style={s.sheetActions}>
              <TouchableOpacity style={s.secondary} onPress={() => setModalOpen(false)}>
                <Text style={s.secondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primary, submitting && s.disabled]} onPress={submit} disabled={submitting}>
                {submitting ? <ActivityIndicator color='#FFFFFF' /> : <Text style={s.primaryText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  title: { fontSize: 25, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 4, lineHeight: 19 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 14, marginBottom: 6 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 13,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 3 },
  banner: {
    backgroundColor: C.amberSoft,
    color: C.amber,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 11,
    borderRadius: 10,
    fontSize: 13,
  },
  card: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 9,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: '700', color: C.ink },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBody: { color: C.muted, marginTop: 6, lineHeight: 19 },
  meta: { fontSize: 12, color: C.muted, marginTop: 7 },
  reject: { color: C.red, fontSize: 12.5, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  action: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody: { color: C.muted, textAlign: 'center', marginTop: 7, lineHeight: 20 },
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: C.green,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  fabText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,16,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: C.ink, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 14, marginBottom: 7 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13 },
  chipTextActive: { color: C.green, fontWeight: '700' },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: C.ink,
    fontSize: 15,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primary: { flex: 1, backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  secondary: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: C.ink, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
