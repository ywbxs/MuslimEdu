import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polyline, Polygon } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import { fetchReportStatus, ReportStatus } from '../../services/orphanService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

// --- Depth layer sizing -----------------------------------------------
// The gradient hero covers the greeting + Profile card. It's a separate
// Animated layer sitting behind the ScrollView content, so it can move
// and fade independently of the cards scrolling on top of it.
const HERO_HEIGHT = 430;
const PARALLAX_FACTOR = 0.5; // background travels at half the content's scroll speed

const DARK_TOP = '#123F2E';
const DARK_BOTTOM = '#04140D';
const PALE_GREEN = '#8FD9AE';
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';
const GLASS_DIVIDER = 'rgba(255,255,255,0.12)';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Inline icons (react-native-svg) ---
function PersonIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function MailIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M4 7l8 6 8-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IdCardIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={8.5} cy={11} r={2} stroke={color} strokeWidth={2} />
      <Line x1={13} y1={10} x2={17} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={17} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function PencilIcon({ color = PALE_GREEN, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={13} y1={7} x2={17} y2={11} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function DocCheckIcon({ color = '#FFFFFF', size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Polyline points="8.5 14 11 16.5 15.5 11.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Polyline points="14 6 20 12 14 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRightIcon({ color = EMERALD, size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronDownIcon({ color = SUBTLE, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 9 12 16 19 9" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CalendarIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ProgressBarsIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={20} x2={6} y2={13} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={20} x2={12} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18} y1={20} x2={18} y2={15} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function BellIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function DocumentIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={9} y1={13} x2={15} y2={13} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={9} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function StarIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon
        points="12 3 14.7 8.6 21 9.3 16.5 13.6 17.6 20 12 16.9 6.4 20 7.5 13.6 3 9.3 9.3 8.6"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function CheckCircleIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="8.5 12 11 14.5 15.5 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClockIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="12 7 12 12 15 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GlassRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.glassRow}>
      <View style={styles.glassRowLeft}>
        {icon}
        <Text style={styles.glassRowLabel}>{label}</Text>
      </View>
      <Text style={styles.glassRowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  badge,
  onPress,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        {icon}
        {!!badge && badge > 0 ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickDescription}>{description}</Text>
      <View style={styles.quickArrowButton}>
        <ArrowRightIcon color={EMERALD} size={16} />
      </View>
      <View style={styles.quickAccentBar} />
    </TouchableOpacity>
  );
}

function StatItem({
  icon,
  value,
  unit,
  label,
}: {
  icon: React.ReactElement;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconWrap}>{icon}</View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function StudentDashboard() {
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;

  const isOrphan = !!user?.is_orphan;

  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(isOrphan);

  useEffect(() => {
    // Regular (non-orphan) students have no monthly report feature, so we
    // never hit the report endpoint for them.
    if (!isOrphan || !token) {
      setIsLoadingStatus(false);
      return;
    }
    let cancelled = false;
    setIsLoadingStatus(true);
    fetchReportStatus(token)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Silent - the overview stats just fall back to placeholders below.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOrphan, token]);

  const handlePlaceholderPress = useCallback((title: string) => {
    Alert.alert('Coming soon', `${title} isn't wired up yet - tell me which to build out next.`);
  }, []);

  // --- Overview stats: wired to real submission history (orphan-only). ---
  const history = status?.history ?? [];
  const reportsSubmitted = String(history.length);
  const ratings = history.flatMap((r) =>
    [r.academic_rating, r.wellbeing_rating].filter((n): n is number => n != null),
  );
  const averageScore =
    ratings.length > 0
      ? `${Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100)}`
      : '-';

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()].slice(0, 3)} ${now.getFullYear()}`;

  // --- Parallax + fade for the background layer only. ---
  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.55, HERO_HEIGHT],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.flex}>
      <Animated.View
        style={[
          styles.bgLayer,
          { height: HERO_HEIGHT, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
        ]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={DARK_TOP} />
              <Stop offset="1" stopColor={DARK_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
          <Circle cx="85%" cy="12%" r="90" fill="rgba(255,255,255,0.04)" />
          <Circle cx="15%" cy="30%" r="60" fill="rgba(255,255,255,0.03)" />
        </Svg>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
            <Text style={styles.greetingName}>{user?.name}</Text>
          </View>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
            <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={62} />
          </TouchableOpacity>
        </View>

        {/* Profile - glass card over the dark hero */}
        <View style={styles.glassCard}>
          <View style={styles.glassHeaderRow}>
            <View style={styles.glassHeaderLeft}>
              <View style={styles.glassIconCircle}>
                <PersonIcon color={PALE_GREEN} size={22} />
              </View>
              <View>
                <Text style={styles.glassTitle}>Profile</Text>
                <Text style={styles.glassSubtitle}>Your personal information</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handlePlaceholderPress('Editing your profile')}
              hitSlop={8}
            >
              <PencilIcon color={PALE_GREEN} size={16} />
            </TouchableOpacity>
          </View>

          <View style={styles.glassDivider} />
          <GlassRow icon={<PersonIcon />} label="Name" value={user?.name} />
          <View style={styles.glassDivider} />
          <GlassRow icon={<MailIcon />} label="Email" value={user?.email} />
          {user?.code ? (
            <>
              <View style={styles.glassDivider} />
              <GlassRow icon={<IdCardIcon />} label="Student Code" value={user.code} />
            </>
          ) : null}
        </View>

        {/* Monthly Report hero card - orphan students only */}
        {isOrphan ? (
          <TouchableOpacity
            style={styles.reportCard}
            activeOpacity={0.9}
            onPress={() => (navigation as any).navigate('OrphanReport')}
          >
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="reportGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#12A860" />
                  <Stop offset="1" stopColor="#0B7C46" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#reportGrad)" />
            </Svg>
            <View style={styles.reportIconCircle}>
              <DocCheckIcon color="#FFFFFF" size={24} />
            </View>
            <View style={styles.reportTextWrap}>
              <Text style={styles.reportTitle}>Monthly Report</Text>
              <Text style={styles.reportSubtitle}>
                {status?.submitted_this_month
                  ? 'Submitted for this month - view your history any time'
                  : 'Submit how your month went, and see your submission history'}
              </Text>
            </View>
            <View style={styles.reportArrowButton}>
              <ArrowRightIcon color={EMERALD} size={18} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.viewAllRow}
            onPress={() => handlePlaceholderPress('Viewing all quick actions')}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRightIcon color={EMERALD} size={15} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          {/* My Reports - orphan students only */}
          {isOrphan ? (
            <QuickActionCard
              icon={<DocumentIcon color={EMERALD} size={20} />}
              title="My Reports"
              description="View your report submissions"
              onPress={() => (navigation as any).navigate('OrphanReport')}
            />
          ) : null}
          <QuickActionCard
            icon={<ProgressBarsIcon color={EMERALD} size={20} />}
            title="My Progress"
            description="Track your learning progress"
            onPress={() => handlePlaceholderPress('My Progress')}
          />
          <QuickActionCard
            icon={<BellIcon color={EMERALD} size={20} />}
            title="Notifications"
            description="Stay updated with important alerts"
            badge={0}
            onPress={() => handlePlaceholderPress('Notifications')}
          />
        </View>

        {/* This Month Overview - orphan students only (it's report-backed) */}
        {isOrphan ? (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeaderRow}>
              <Text style={styles.overviewTitle}>This Month Overview</Text>
              <TouchableOpacity
                style={styles.monthPill}
                onPress={() => handlePlaceholderPress('Choosing a different month')}
              >
                <Text style={styles.monthPillText}>{monthLabel}</Text>
                <ChevronDownIcon color={SUBTLE} size={14} />
              </TouchableOpacity>
            </View>

            {isLoadingStatus ? (
              <View style={styles.statsRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.statItem}>
                    <SkeletonCircle size={40} style={styles.mb10} />
                    <Skeleton width={30} height={20} style={styles.mb6} />
                    <Skeleton width={50} height={11} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.statsRow}>
                <StatItem icon={<DocumentIcon color={EMERALD} size={20} />} value={reportsSubmitted} label="Reports Submitted" />
                <StatItem
                  icon={<StarIcon color={EMERALD} size={20} />}
                  value={averageScore}
                  unit={averageScore !== '-' ? '%' : undefined}
                  label="Average Score"
                />
                <StatItem icon={<CheckCircleIcon color={EMERALD} size={20} />} value="-" label="Activities Completed" />
                <StatItem icon={<ClockIcon color={EMERALD} size={20} />} value="-" label="Time Spent" />
              </View>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Reports Submitted and Average Score are wired to your real submission history.
                Activities Completed and Time Spent will connect once those features are built.
              </Text>
            </View>
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    zIndex: 0,
    elevation: 0,
  },
  scrollFlex: { flex: 1, zIndex: 1, elevation: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 130 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingBottom: 24,
  },
  greetingSmall: { fontSize: 14, color: PALE_GREEN },
  greetingName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  glassCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  glassHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  glassHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  glassIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  glassTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  glassSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassDivider: { height: 1, backgroundColor: GLASS_DIVIDER, marginVertical: 4 },
  glassRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  glassRowLeft: { flexDirection: 'row', alignItems: 'center' },
  glassRowLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 10 },
  glassRowValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 20,
    marginBottom: 28,
    overflow: 'hidden',
    zIndex: 1,
  },
  reportIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reportTextWrap: { flex: 1 },
  reportTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  reportSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 5, lineHeight: 17 },
  reportArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: INK },
  viewAllRow: { flexDirection: 'row', alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '700', color: EMERALD, marginRight: 2 },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  quickTitle: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 4 },
  quickDescription: { fontSize: 11, color: SUBTLE, lineHeight: 15, marginBottom: 10 },
  quickArrowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  quickAccentBar: {
    height: 3,
    backgroundColor: EMERALD,
    marginHorizontal: -14,
    marginBottom: -14,
    marginTop: 12,
  },

  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  overviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  overviewTitle: { fontSize: 16, fontWeight: '700', color: INK },
  monthPill: { flexDirection: 'row', alignItems: 'center' },
  monthPillText: { fontSize: 13, color: SUBTLE, fontWeight: '600', marginRight: 4 },
  mb6: { marginBottom: 6 },
  mb10: { marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { flex: 1, alignItems: 'center' },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  statValue: { fontSize: 22, fontWeight: '800', color: INK },
  statUnit: { fontSize: 12, fontWeight: '700', color: INK, marginLeft: 1, marginBottom: 2 },
  statLabel: { fontSize: 11, color: SUBTLE, textAlign: 'center', marginTop: 4, lineHeight: 14 },

  noteBox: {
    marginTop: 20,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    padding: 16,
  },
  noteText: { fontSize: 13, color: INK, lineHeight: 19 },
});
