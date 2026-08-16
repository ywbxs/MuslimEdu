import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChartNoAxesColumn, ArrowRight as ArrowRightGlyph, Users, CalendarCheck, GraduationCap, Layers, BookOpen, School as SchoolGlyph, Pencil } from 'lucide-react-native';
import { fetchAcademicAnalytics, Analytics } from '../services/academicAnalyticsService';
import { fetchSetupStatus, SchoolProfile } from '../services/academicSetupService';
import { Skeleton } from './Skeleton';

const INSTITUTION_LABELS: Record<string, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphanage',
};

const EMERALD = '#1FAE64';
const PALE_GREEN = '#7FD9A8';
// Same faux-glass values MonthlyReportsCard uses - kept identical so every
// "glass on dark green" hero card in the app reads as one family.
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BG_STRONG = 'rgba(255,255,255,0.1)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

function ChartIcon({ color }: { color: string }) {
  return <ChartNoAxesColumn color={color} size={26} strokeWidth={1.8} />;
}
function ArrowRight({ color, size = 18 }: { color: string; size?: number }) {
  return <ArrowRightGlyph color={color} size={size} strokeWidth={2} />;
}
function StudentsIcon({ color }: { color: string }) {
  return <Users color={color} size={15} strokeWidth={1.8} />;
}
function AttendanceIcon({ color }: { color: string }) {
  return <CalendarCheck color={color} size={15} strokeWidth={1.8} />;
}
function TeachersIcon({ color }: { color: string }) {
  return <GraduationCap color={color} size={15} strokeWidth={1.8} />;
}
function SectionsIcon({ color }: { color: string }) {
  return <Layers color={color} size={15} strokeWidth={1.8} />;
}
function SubjectsIcon({ color }: { color: string }) {
  return <BookOpen color={color} size={15} strokeWidth={1.8} />;
}
function PencilIcon({ color }: { color: string }) {
  return <Pencil color={color} size={15} strokeWidth={1.8} />;
}

/** Circular icon button that scales down slightly on press - identical to
 *  MonthlyReportsCard's own, duplicated rather than shared since it's a
 *  10-line presentational wrapper with no state of its own to diverge on. */
function PressScaleCircle({
  onPress,
  children,
  size = 44,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.9)}
      onPressOut={() => animateTo(1)}
      android_ripple={{ color: 'rgba(255,255,255,0.15)', radius: size / 2 }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.arrowCircle,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statChipIconWrap}>{icon}</View>
      <View>
        <Text style={styles.statChipValue}>{value}</Text>
        <Text style={styles.statChipLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      {icon}
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function schoolInitials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SchoolIdentityStrip({ school, onEdit }: { school: SchoolProfile; onEdit: () => void }) {
  const institutionLabel = school.institution_type ? INSTITUTION_LABELS[school.institution_type] : null;
  return (
    <View style={styles.schoolStrip}>
      {school.logo ? (
        <Image source={{ uri: school.logo }} style={styles.schoolLogo} />
      ) : (
        <View style={styles.schoolLogoFallback}>
          {school.name ? (
            <Text style={styles.schoolInitials}>{schoolInitials(school.name)}</Text>
          ) : (
            <SchoolGlyph color={PALE_GREEN} size={18} strokeWidth={1.8} />
          )}
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.schoolName} numberOfLines={1}>
          {school.name ?? 'Your school'}
        </Text>
        {institutionLabel ? <Text style={styles.schoolType}>{institutionLabel}</Text> : null}
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={10}
        android_ripple={{ color: 'rgba(255,255,255,0.15)', radius: 18 }}
        style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
      >
        <PencilIcon color={PALE_GREEN} />
      </Pressable>
    </View>
  );
}

/**
 * The admin dashboard's Academic Analytics widget - same dark-glass hero
 * treatment as MonthlyReportsCard (orphan schools' equivalent), fetching
 * real numbers via POST /admin_academic_analytics_dashboard so this never
 * shows placeholder stats. Shown for every non-orphan school (mahad,
 * madrasa, markaz, regular_school) since they all share the class-based
 * academic subsystem this reports on - the same boundary orphanSchool.ts
 * already draws for the rest of the academic tile set, not a narrower
 * regular_school-only cut.
 */
export default function AnalyticsCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [data, setData] = useState<Analytics | null>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = () => {
    setError(null);
    setIsLoading(true);
    fetchAcademicAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics.'))
      .finally(() => setIsLoading(false));
    // School identity (name/logo) is a nice-to-have on this card - never
    // let it block or fail the actual analytics load if it errors.
    fetchSetupStatus(token)
      .then((status) => setSchool(status.school))
      .catch(() => {});
  };

  useEffect(load, [token]);

  const students = data?.summary.students ?? 0;
  const teachers = data?.summary.teachers ?? 0;
  const sections = data?.summary.sections ?? 0;
  const subjects = data?.summary.subjects ?? 0;
  const attendanceRate = data?.summary.attendance_rate ?? null;
  const hasData = students > 0 || attendanceRate != null;
  const hasSchoolInfo = teachers > 0 || sections > 0 || subjects > 0;

  useEffect(() => {
    if (isLoading || error) return;
    fadeIn.setValue(0);
    progressAnim.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: attendanceRate ?? 0, duration: 320, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, attendanceRate]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const goToAnalytics = () => (navigation as any).navigate('AcademicAnalytics');
  const editSchoolProfile = () => (navigation as any).navigate('InstitutionProfile');

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Skeleton width={56} height={56} style={{ borderRadius: 16 }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Skeleton width={110} height={11} style={{ marginBottom: 8, borderRadius: 4 }} />
            <Skeleton width="80%" height={16} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
        </View>
        <View style={[styles.statsRow, { marginTop: 18 }]}>
          <Skeleton width="48%" height={54} style={{ borderRadius: 14 }} />
          <Skeleton width="48%" height={54} style={{ borderRadius: 14 }} />
        </View>
        <Skeleton width="100%" height={40} style={{ borderRadius: 20, marginTop: 16 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.card, { opacity: fadeIn }]}>
      {school ? <SchoolIdentityStrip school={school} onEdit={editSchoolProfile} /> : null}

      <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToAnalytics}>
        <View style={styles.iconBox}>
          <ChartIcon color={PALE_GREEN} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.label}>SCHOOL ANALYTICS</Text>
          <Text style={styles.title}>Academic Analytics</Text>
        </View>
        <PressScaleCircle onPress={goToAnalytics}>
          <ArrowRight color={PALE_GREEN} />
        </PressScaleCircle>
      </TouchableOpacity>

      <Text style={styles.subtitle}>Students, attendance, and grades at a glance.</Text>

      {hasData ? (
        <>
          <View style={styles.statsRow}>
            <StatChip icon={<StudentsIcon color={PALE_GREEN} />} value={String(students)} label="Students" />
            <StatChip
              icon={<AttendanceIcon color={PALE_GREEN} />}
              value={attendanceRate == null ? '—' : `${attendanceRate}%`}
              label="Attendance"
            />
          </View>

          {hasSchoolInfo ? (
            <View style={styles.schoolInfoSection}>
              <Text style={styles.schoolInfoLabel}>SCHOOL OVERVIEW</Text>
              <View style={styles.miniStatsRow}>
                <MiniStat icon={<TeachersIcon color={PALE_GREEN} />} value={String(teachers)} label="Teachers" />
                <View style={styles.miniStatDivider} />
                <MiniStat icon={<SectionsIcon color={PALE_GREEN} />} value={String(sections)} label="Sections" />
                <View style={styles.miniStatDivider} />
                <MiniStat icon={<SubjectsIcon color={PALE_GREEN} />} value={String(subjects)} label="Subjects" />
              </View>
            </View>
          ) : null}

          {attendanceRate != null ? (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Attendance rate</Text>
                <Text style={styles.progressPct}>{attendanceRate}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.emptyText}>No academic activity yet - stats will show up here once there is.</Text>
      )}

      <Pressable
        onPress={goToAnalytics}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.manageBtnText}>View Analytics</Text>
        <ArrowRight color={EMERALD} size={15} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 26,
    padding: 18,
    marginHorizontal: 20,
  },
  schoolStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  schoolLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  schoolLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolInitials: { color: PALE_GREEN, fontSize: 14, fontWeight: '800' },
  schoolName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  schoolType: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: PALE_GREEN, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 21 },
  arrowCircle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG_STRONG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 9,
  },
  statChipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChipValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', lineHeight: 20 },
  statChipLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },

  schoolInfoSection: {
    marginTop: 16,
    backgroundColor: GLASS_BG_STRONG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  schoolInfoLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  miniStatsRow: { flexDirection: 'row', alignItems: 'center' },
  miniStat: { flex: 1, alignItems: 'center', gap: 4 },
  miniStatDivider: { width: 1, height: 34, backgroundColor: GLASS_BORDER },
  miniStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 19 },
  miniStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '600' },

  progressSection: { marginTop: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  progressPct: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PALE_GREEN },

  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, marginTop: 16, lineHeight: 18 },

  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 12,
    marginTop: 18,
  },
  manageBtnText: { color: EMERALD, fontSize: 14, fontWeight: '700' },

  errorText: { color: '#F4A7A7', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});
