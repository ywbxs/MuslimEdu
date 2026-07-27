/**
 * SubjectLoadingQueueScreen
 *
 * The registrar queue. Filter by workflow status, open a load, approve or
 * return it. Read-only for advisers (they only see their own advisees).
 *
 * Navigate with: navigation.navigate('SubjectLoadingQueue')
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import subjectLoadingService from '../../services/subjectLoadingService';

const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#12805C',
  greenSoft: '#E7F4EF',
  amber: '#B4790B',
  amberSoft: '#FDF3DF',
  red: '#C0392B',
  redSoft: '#FCEBE9',
  blue: '#1F6FB2',
  blueSoft: '#E8F1F8',
};

const FILTERS = [
  {key: '', label: 'All'},
  {key: 'draft', label: 'Draft'},
  {key: 'submitted', label: 'For approval'},
  {key: 'approved', label: 'Approved'},
  {key: 'rejected', label: 'Returned'},
  {key: 'cancelled', label: 'Cancelled'},
];

function toneFor(status: string) {
  if (status === 'approved') {
    return {bg: C.greenSoft, fg: C.green};
  }
  if (status === 'submitted') {
    return {bg: C.blueSoft, fg: C.blue};
  }
  if (status === 'rejected' || status === 'cancelled') {
    return {bg: C.redSoft, fg: C.red};
  }
  return {bg: C.amberSoft, fg: C.amber};
}

type Props = {navigation: any};

export default function SubjectLoadingQueueScreen({navigation}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setError(null);
      const res = await subjectLoadingService.list({
        status: status || undefined,
        search: search || undefined,
        per_page: 50,
      });
      setRows(res.loadings || []);
      setCounts(res.counts || {});
    } catch (e: any) {
      setError(e.message || 'Could not load the subject loading queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, search]);

  useEffect(() => {
    setLoading(true);
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchRows);
    return unsub;
  }, [navigation, fetchRows]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Subject Loading</Text>
        <Text style={s.subtitle}>
          {counts.submitted || 0} waiting for approval
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={{paddingHorizontal: 14}}>
        {FILTERS.map(f => {
          const active = f.key === status;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[s.chip, active ? s.chipActive : null]}
              onPress={() => setStatus(f.key)}>
              <Text style={[s.chipText, active ? s.chipTextActive : null]}>
                {f.label}
                {f.key && counts[f.key] ? ' ' + counts[f.key] : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TextInput
        style={s.search}
        placeholder={'Search student name'}
        placeholderTextColor={C.muted}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={fetchRows}
        returnKeyType={'search'}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size={'large'} color={C.green} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRows();
              }}
            />
          }
          contentContainerStyle={{paddingBottom: 30}}
          renderItem={({item}) => {
            const tone = toneFor(item.status);
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('SubjectLoadingDetail', {
                    loadingId: item.id,
                  })
                }>
                <View style={{flex: 1}}>
                  <Text style={s.rowTitle}>
                    {item.student_name || 'Student #' + item.student_id}
                  </Text>
                  <Text style={s.rowMeta}>
                    {item.total_subjects} subjects · {item.total_units} units
                    {item.load_number ? ' · ' + item.load_number : ''}
                  </Text>
                  {item.has_override ? (
                    <Text style={s.overrideTag}>Contains an override</Text>
                  ) : null}
                </View>
                <View style={[s.badge, {backgroundColor: tone.bg}]}>
                  <Text style={[s.badgeText, {color: tone.fg}]}>
                    {String(item.status).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>Nothing here yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg},
  center: {alignItems: 'center', justifyContent: 'center', padding: 40},
  header: {paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8},
  title: {fontSize: 24, fontWeight: '700', color: C.ink},
  subtitle: {fontSize: 13, color: C.muted, marginTop: 2},
  filterRow: {maxHeight: 44, marginTop: 6},
  chip: {
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.line,
    height: 34,
  },
  chipActive: {backgroundColor: C.green, borderColor: C.green},
  chipText: {fontSize: 12, color: C.muted, fontWeight: '600'},
  chipTextActive: {color: '#FFFFFF'},
  search: {
    margin: 14,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowTitle: {fontSize: 15, fontWeight: '600', color: C.ink},
  rowMeta: {fontSize: 12, color: C.muted, marginTop: 3},
  overrideTag: {fontSize: 11, color: C.amber, marginTop: 4, fontWeight: '600'},
  badge: {borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5},
  badgeText: {fontSize: 10, fontWeight: '700'},
  muted: {color: C.muted},
  error: {color: C.red, paddingHorizontal: 18, paddingBottom: 8},
});
