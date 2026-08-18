import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, GraduationCap, CalendarCheck, Award } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';

/**
 * The "wizard" a School Snapshot card opens into - one focused screen per
 * metric instead of the number just sitting there with nothing else to
 * do. Only ever shows real fields the analytics API already returned
 * (see `breakdown`, built by the caller from `data.attendance`/
 * `data.grades`) - this screen never invents a number the summary card
 * didn't already have, matching this whole analytics surface's own
 * "stays blank instead of inventing performance" rule.
 */

export type MetricIconKey = 'students' | 'teachers' | 'attendance' | 'grades';

export interface MetricBreakdownRow {
  label: string;
  value: string;
}

export interface AcademicMetricDetailParams {
  icon: MetricIconKey;
  title: string;
  value: string;
  sub: string;
  breakdown?: MetricBreakdownRow[];
  note?: string;
}

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function MetricIcon({ iconKey, color }: { iconKey: MetricIconKey; color: string }) {
  switch (iconKey) {
    case 'students':
      return <Users size={30} color={color} strokeWidth={1.8} />;
    case 'teachers':
      return <GraduationCap size={30} color={color} strokeWidth={1.8} />;
    case 'attendance':
      return <CalendarCheck size={30} color={color} strokeWidth={1.8} />;
    case 'grades':
      return <Award size={30} color={color} strokeWidth={1.8} />;
  }
}

export default function AcademicMetricDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { icon, title, value, sub, breakdown, note } = route.params as AcademicMetricDetailParams;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <IconChevronLeft color={BRAND.emeraldDeep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MetricIcon iconKey={icon} color={BRAND.emeraldDeep} />
          </View>
          <Text style={styles.heroValue}>{value}</Text>
          <Text style={styles.heroSub}>{sub}</Text>
        </View>

        {breakdown && breakdown.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('academic_metric_detail.breakdown', 'BREAKDOWN')}</Text>
            <View style={styles.card}>
              {breakdown.map((row, i) => (
                <View key={row.label} style={[styles.row, i !== breakdown.length - 1 && styles.rowDivider]}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyNote}>
            {note ?? t('academic_metric_detail.no_breakdown', 'No further breakdown is available for this metric yet.')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  content: { padding: 16 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroValue: { fontSize: 40, fontWeight: '900', color: INK },
  heroSub: { fontSize: 13.5, color: SUBTLE, marginTop: 6, textAlign: 'center' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLabel: { fontSize: 14, color: INK, fontWeight: '600' },
  rowValue: { fontSize: 14, color: BRAND.emeraldDeep, fontWeight: '800' },

  emptyNote: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
});
