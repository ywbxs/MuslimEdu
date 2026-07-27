import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import studentPortalService, { ServiceDefinition, ServiceRequest } from '../../services/studentPortalService';
import { C, relativeTime, tintFor } from '../nextPhaseTheme';

const PRIORITIES: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];

export default function StudentServicesScreen() {
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [summary, setSummary] = useState({ open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<ServiceDefinition | null>(null);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await studentPortalService.services();
      setServices(res.services);
      setRequests(res.requests);
      setSummary(res.summary);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load student services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openSheet = (service: ServiceDefinition) => {
    setActive(service);
    setSubject(service.label);
    setDetails('');
    setPriority('normal');
  };

  const submit = async () => {
    if (!active) return;

    if (!subject.trim()) {
      Alert.alert('Subject required', 'Give your request a short title.');
      return;
    }
    if (active.needs_details && !details.trim()) {
      Alert.alert('Details required', 'This request type needs a short explanation.');
      return;
    }

    setSubmitting(true);
    try {
      await studentPortalService.createServiceRequest({
        service_key: active.key,
        subject: subject.trim(),
        details: details.trim() || undefined,
        priority,
      });
      setActive(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = (req: ServiceRequest) => {
    Alert.alert('Cancel request', req.subject, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          try {
            await studentPortalService.cancelServiceRequest(req.id);
            load();
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
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
        data={requests}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ paddingBottom: 30 }}
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
            <Text style={s.title}>Student services</Text>
            <Text style={s.sub}>Raise a request with the office and track where it got to.</Text>

            <View style={s.stats}>
              <Stat label='Open' value={summary.open} tint={C.amber} />
              <Stat label='In progress' value={summary.in_progress} tint={C.blue} />
              <Stat label='Resolved' value={summary.resolved} tint={C.green} />
            </View>

            {error ? <Text style={s.banner}>{error}</Text> : null}

            <Text style={s.section}>What do you need</Text>
            <View style={s.grid}>
              {services.map(service => (
                <TouchableOpacity key={service.key} style={s.tile} onPress={() => openSheet(service)}>
                  <Text style={s.tileTitle}>{service.label}</Text>
                  <Text style={s.tileMeta}>usually {service.sla_days} working days</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.section}>My requests</Text>
            {requests.length === 0 ? <Text style={s.emptyLine}>Nothing raised yet.</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const tint = tintFor(item.status);

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {item.subject}
                </Text>
                <View style={[s.pill, { backgroundColor: tint.bg }]}>
                  <Text style={[s.pillText, { color: tint.fg }]}>{item.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>

              {item.details ? (
                <Text style={s.cardBody} numberOfLines={4}>
                  {item.details}
                </Text>
              ) : null}

              <Text style={s.meta}>
                {item.service_label}
                {item.reference_no ? ' · ' + item.reference_no : ''} · {relativeTime(item.created_at)}
              </Text>

              {item.resolution_note ? (
                <View style={s.resolution}>
                  <Text style={s.resolutionLabel}>Office response</Text>
                  <Text style={s.resolutionBody}>{item.resolution_note}</Text>
                </View>
              ) : null}

              {item.status === 'open' || item.status === 'in_progress' ? (
                <TouchableOpacity style={s.action} onPress={() => cancel(item)}>
                  <Text style={[s.actionText, { color: C.red }]}>Cancel request</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />

      <Modal visible={active !== null} animationType='slide' transparent onRequestClose={() => setActive(null)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{active?.label}</Text>
            <Text style={s.sheetSub}>Typically answered within {active?.sla_days} working days.</Text>

            <ScrollView style={{ maxHeight: 330 }} keyboardShouldPersistTaps='handled'>
              <Text style={s.label}>Subject</Text>
              <TextInput style={s.input} value={subject} onChangeText={setSubject} placeholderTextColor='#9AA8A3' />

              <Text style={s.label}>Details{active?.needs_details ? '' : ' (optional)'}</Text>
              <TextInput
                style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]}
                value={details}
                onChangeText={setDetails}
                multiline
                placeholder='Give the office everything it needs to act on this.'
                placeholderTextColor='#9AA8A3'
              />

              <Text style={s.label}>Priority</Text>
              <View style={s.chipWrap}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.chip, priority === p && s.chipActive]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[s.chipText, priority === p && s.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.sheetActions}>
              <TouchableOpacity style={s.secondary} onPress={() => setActive(null)}>
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
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 14 },
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
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    fontSize: 13,
  },
  section: { color: C.muted, fontWeight: '800', fontSize: 12, marginHorizontal: 18, marginTop: 22, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: 14, marginTop: 10 },
  tile: {
    width: '48%',
    backgroundColor: C.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    padding: 13,
  },
  tileTitle: { color: C.ink, fontWeight: '700', fontSize: 14 },
  tileMeta: { color: C.muted, fontSize: 11.5, marginTop: 5 },
  emptyLine: { color: C.muted, marginHorizontal: 18, marginTop: 10, fontSize: 13.5 },
  card: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 9,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: '700', color: C.ink },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBody: { color: C.muted, marginTop: 7, lineHeight: 19 },
  meta: { fontSize: 12, color: C.muted, marginTop: 8 },
  resolution: { backgroundColor: C.greenSoft, borderRadius: 10, padding: 11, marginTop: 11 },
  resolutionLabel: { fontSize: 11, fontWeight: '800', color: C.green, letterSpacing: 0.4 },
  resolutionBody: { color: C.ink, marginTop: 5, lineHeight: 19 },
  action: {
    alignSelf: 'flex-start',
    marginTop: 11,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,16,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: C.ink },
  sheetSub: { color: C.muted, marginTop: 4, fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 14, marginBottom: 7 },
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
  chipWrap: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: C.green, fontWeight: '700' },
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
