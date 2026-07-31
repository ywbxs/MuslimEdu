import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchMyClasses, ClassSection } from '../../services/teacherClassService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconBook({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={4} y1={20.5} x2={20} y2={20.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconPeople({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={color} strokeWidth={2} />
      <Path d="M3 20c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M16 8.2a3.2 3.2 0 1 1 0 6.2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 15.6c2.4.4 3.8 1.7 3.8 4.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ClassCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="60%" height={15} borderRadius={4} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export default function TeacherMyClassesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchMyClasses(token);
        setClasses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('teacher_my_classes.load_error', 'Could not load your classes.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_my_classes.title', 'My Classes')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => String(item.section_id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_my_classes.empty_title', 'No classes assigned yet')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('teacher_my_classes.empty_desc', "You'll see a class here once an admin makes you the class teacher for a section.")}
                </Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                (navigation as any).navigate('TeacherClassStudents', {
                  sectionId: item.section_id,
                  classLabel: `${item.class_name ?? ''} - ${item.section_name}`.trim(),
                })
              }
            >
              <View style={styles.cardIcon}>
                <IconBook color={EMERALD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.class_name ?? t('teacher_my_classes.class_fallback', 'Class')} - {item.section_name}
                </Text>
                <View style={styles.cardMetaRow}>
                  <IconPeople color={SUBTLE} />
                  <Text style={styles.cardMeta}>
                    {item.student_count ?? 0} {item.student_count === 1 ? t('teacher_my_classes.student', 'student') : t('teacher_my_classes.students', 'students')}
                  </Text>
                </View>
              </View>
              <IconChevronRight color={SUBTLE} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  listContent: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: INK },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  cardMeta: { fontSize: 12.5, color: SUBTLE },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 13.5, textAlign: 'center' },
});
