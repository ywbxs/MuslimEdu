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
import { ArrowRight, Bell, Calendar, Camera, ChartNoAxesColumn, ChevronDown, ChevronRight, CircleCheck, Clock, FileText, IdCard, Mail, Settings, Star, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE, GLASS_BG, GLASS_BORDER, GLASS_DIVIDER, GLASS_ICON_BG } from './DashboardShell';
import { fetchReportStatus, ReportStatus } from '../../services/orphanService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import { isOrphanSchoolUser } from '../../utils/orphanSchool';
import UpcomingClassesCard from '../../components/UpcomingClassesCard';
import EnrollmentStatusCard from '../../components/EnrollmentStatusCard';
import UserAvatar from '../../components/UserAvatar';
import HeroGlow from '../../components/HeroGlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Depth layer sizing -----------------------------------------------
// The gradient hero covers the greeting + Profile card. It's a separate
// Animated layer sitting behind the ScrollView content, so it can move
// and fade independently of the cards scrolling on top of it.
const HERO_HEIGHT = 430;
const PARALLAX_FACTOR = 0.5; // background travels at half the content's scroll speed

const DARK_TOP = '#123F2E';
const DARK_BOTTOM = '#04140D';
const PALE_GREEN = '#8FD9AE';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Inline icons (react-native-svg) ---
function PersonIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <User size={size} color={color} strokeWidth={2} />;
}
function MailIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <Mail size={size} color={color} strokeWidth={2} />;
}
function IdCardIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <IdCard size={size} color={color} strokeWidth={2} />;
}
function CameraIcon({ color = PALE_GREEN, size = 16 }: { color?: string; size?: number }) {
  return <Camera size={size} color={color} strokeWidth={2} />;
}
function DocCheckIcon({ color = '#FFFFFF', size = 24 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}
function ArrowRightIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
}
function ChevronRightIcon({ color = EMERALD, size = 15 }: { color?: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.2} />;
}
function ChevronDownIcon({ color = SUBTLE, size = 14 }: { color?: string; size?: number }) {
  return <ChevronDown size={size} color={color} strokeWidth={2.2} />;
}
function CalendarIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Calendar size={size} color={color} strokeWidth={2} />;
}
function ProgressBarsIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <ChartNoAxesColumn size={size} color={color} strokeWidth={2} />;
}
function BellIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Bell size={size} color={color} strokeWidth={2} />;
}
function DocumentIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}
function UploadDocumentIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}
function StarIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Star size={size} color={color} strokeWidth={2} />;
}
function CheckCircleIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <CircleCheck size={size} color={color} strokeWidth={2} />;
}
function ClockIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Clock size={size} color={color} strokeWidth={2} />;
}
function GearIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Settings size={size} color={color} strokeWidth={2} />;
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
  solid,
  onPress,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  badge?: number;
  solid?: boolean;
  onPress: () => void;
}) {
  const fg = solid ? '#FFFFFF' : EMERALD;
  return (
    <TouchableOpacity
      style={[styles.quickCard, solid ? styles.quickCardSolid : styles.quickCardSoft]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={[styles.quickIconWrap, solid ? styles.quickIconWrapSolid : styles.quickIconWrapSoft]}>
        {icon}
        {!!badge && badge > 0 ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.quickTitle, solid ? styles.quickTitleSolid : null]}>{title}</Text>
      <Text style={[styles.quickDescription, solid ? styles.quickDescriptionSolid : null]}>{description}</Text>
      <View style={styles.quickArrowRow}>
        <View style={[styles.quickArrowButton, solid ? styles.quickArrowButtonSolid : styles.quickArrowButtonSoft]}>
          <ArrowRightIcon color={fg} size={16} />
        </View>
      </View>
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

interface StudentDashboardProps {
  footer?: React.ReactNode;
}

export default function StudentDashboard({ footer }: StudentDashboardProps = {}) {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  // The dark hero background is a separate absolutely-positioned layer
  // behind the ScrollView, sized to cover the greeting + profile card.
  // Those two are variable height (profile card rows are conditional on
  // which fields the user has), so a fixed HERO_HEIGHT falls short
  // whenever the card is taller than the default 3-field case, leaving
  // "Quick Actions" rendered half over the dark background's rounded
  // bottom edge. Measure the real height instead of guessing it.
  const [heroHeight, setHeroHeight] = useState(HERO_HEIGHT);

  const isOrphan = isOrphanSchoolUser(user);

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
    Alert.alert(
      t('student_dashboard.coming_soon_title', 'Coming soon'),
      t('student_dashboard.coming_soon_message', "{title} isn't wired up yet - tell me which to build out next.").replace(
        '{title}',
        title,
      ),
    );
  }, [t]);

  // Quick Actions grid - built as an array (like AdminDashboard's Manage
  // grid) so the first entry can always render as the highlighted "solid"
  // card, matching the Manage screen's card design.
  interface QuickAction {
    key: string;
    title: string;
    description: string;
    icon: (color: string) => React.ReactElement;
    badge?: number;
    onPress: () => void;
  }
  const quickActions: QuickAction[] = [
    // My Reports - orphan students only.
    ...(isOrphan
      ? [
          {
            key: 'myReports',
            title: t('student_dashboard.my_reports_title', 'My Reports'),
            description: t('student_dashboard.my_reports_desc', 'View your report submissions'),
            icon: (c: string) => <DocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('OrphanReport'),
          },
        ]
      : []),
    // Academic progress (attendance/grades/memorization) - hidden for
    // orphan schools, which have no classes/subjects/grading.
    ...(!isOrphan
      ? [
          {
            key: 'myProgress',
            title: t('student_dashboard.my_progress_title', 'My Progress'),
            description: t('student_dashboard.my_progress_desc', 'Track your learning progress'),
            icon: (c: string) => <ProgressBarsIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('MyProgress'),
          },
          {
            key: 'mySchedule',
            title: t('student_dashboard.my_schedule_title', 'My Schedule'),
            description: t('student_dashboard.my_schedule_desc', 'See your weekly class timetable'),
            icon: (c: string) => <CalendarIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentSchedule'),
          },
          {
            key: 'myIdCard',
            title: t('student_dashboard.my_id_card_title', 'My ID Card'),
            description: t('student_dashboard.my_id_card_desc', 'View and export your QR ID card'),
            icon: (c: string) => <IdCardIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentIdCard'),
          },
          {
            key: 'myGrades',
            title: t('student_dashboard.my_grades_title', 'My Grades'),
            description: t('student_dashboard.my_grades_desc', 'See your grades and GPA by subject'),
            icon: (c: string) => <StarIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('AcademicHub', { initialTab: 'grades' }),
          },
        ]
      : []),
    {
      key: 'notifications',
      title: t('student_dashboard.notifications_title', 'Notifications'),
      description: t('student_dashboard.notifications_desc', 'Stay updated with important alerts'),
      icon: (c: string) => <BellIcon color={c} size={20} />,
      badge: 0,
      onPress: () => (navigation as any).navigate('Notifications'),
    },
    // Document requests (report card/COR/certificate) don't apply to an
    // orphan school - there's no class-based academics to issue them from
    // (same gating as My Progress/Schedule/ID Card above), so orphan
    // children only get the upload tile. Regular schools get both: request
    // an official document from the school, or upload one of their own
    // (ID, medical records, etc.) - the two flows aren't mutually exclusive.
    ...(!isOrphan
      ? [
          {
            key: 'documents',
            title: t('student_dashboard.documents_title', 'Documents'),
            description: t('student_dashboard.documents_desc', 'Request report cards, COR and certificates'),
            icon: (c: string) => <DocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentDocuments'),
          },
          {
            key: 'uploadDocuments',
            title: t('student_dashboard.upload_documents_title', 'Upload Documents'),
            description: t(
              'student_dashboard.upload_documents_desc',
              'Submit your ID, medical records and other files',
            ),
            icon: (c: string) => <UploadDocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentUploadDocuments'),
          },
        ]
      : [
          {
            key: 'uploadDocuments',
            title: t('student_dashboard.upload_documents_title', 'Upload Documents'),
            description: t(
              'student_dashboard.upload_documents_desc_orphan',
              'Submit your ID, guardian consent and other files',
            ),
            icon: (c: string) => <UploadDocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentUploadDocuments'),
          },
        ]),
    {
      key: 'services',
      title: t('student_dashboard.services_title', 'Services'),
      description: t('student_dashboard.services_desc', 'Guidance, counselling and other requests'),
      icon: (c: string) => <CheckCircleIcon color={c} size={20} />,
      onPress: () => (navigation as any).navigate('StudentServices'),
    },
    {
      key: 'settings',
      title: t('student_dashboard.settings_title', 'Settings'),
      description: t('student_dashboard.settings_desc', 'Language, theme, privacy and password'),
      icon: (c: string) => <GearIcon color={c} size={20} />,
      onPress: () => (navigation as any).navigate('AccountSettings'),
    },
  ];

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
    inputRange: [0, heroHeight],
    outputRange: [0, -heroHeight * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.55, heroHeight],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.flex}>
      <Animated.View
        style={[
          styles.bgLayer,
          { height: heroHeight, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
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
        </Svg>
        <HeroGlow />
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
        <View
          onLayout={(e) => {
            // The measured height already includes glassCard's own
            // marginBottom (RN's column layout counts trailing margin
            // toward the parent's auto height), so the dark layer's
            // bottom edge lands exactly where the card's margin ends.
            const measured = e.nativeEvent.layout.height;
            if (Math.abs(measured - heroHeight) > 1) setHeroHeight(measured);
          }}
        >
          {/* Greeting */}
          <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
            <View>
              <Text style={styles.greetingSmall}>{t('student_dashboard.greeting', 'Assalamu Alaykum,')}</Text>
              <Text style={styles.greetingName}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
              <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={62} fillColor={EMERALD} dotColor={null} />
            </TouchableOpacity>
          </View>

          {/* Profile - glass card over the dark hero */}
          <View style={styles.glassCard}>
            <View style={styles.glassHeaderRow}>
              <View style={styles.glassHeaderLeft}>
                <UserAvatar
                  name={user?.name ?? ''}
                  photo={user?.photo}
                  size={44}
                  ringColor={GLASS_BORDER}
                  fillColor={GLASS_ICON_BG}
                  dotColor={null}
                  style={styles.profileAvatarSpacing}
                />
                <View>
                  <Text style={styles.glassTitle}>{t('student_dashboard.profile_title', 'Profile')}</Text>
                  <Text style={styles.glassSubtitle}>
                    {t('student_dashboard.profile_subtitle', 'Your personal information')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => (navigation as any).navigate('EditProfile')}
                hitSlop={8}
              >
                <CameraIcon color={PALE_GREEN} size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.glassDivider} />
            <GlassRow icon={<PersonIcon />} label={t('student_dashboard.name_label', 'Name')} value={user?.name} />
            <View style={styles.glassDivider} />
            <GlassRow icon={<MailIcon />} label={t('student_dashboard.email_label', 'Email')} value={user?.email} />
            {user?.code ? (
              <>
                <View style={styles.glassDivider} />
                <GlassRow
                  icon={<IdCardIcon />}
                  label={t('student_dashboard.student_code_label', 'Student Code')}
                  value={user.code}
                />
              </>
            ) : null}
          </View>
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
              <Text style={styles.reportTitle}>{t('student_dashboard.monthly_report_title', 'Monthly Report')}</Text>
              <Text style={styles.reportSubtitle}>
                {status?.submitted_this_month
                  ? t(
                      'student_dashboard.monthly_report_submitted',
                      'Submitted for this month - view your history any time',
                    )
                  : t(
                      'student_dashboard.monthly_report_pending',
                      'Submit how your month went, and see your submission history',
                    )}
              </Text>
            </View>
            <View style={styles.reportArrowButton}>
              <ArrowRightIcon color={EMERALD} size={18} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Today's class schedule preview - regular schools only; orphan
            schools have no class/schedule concept (same gating as the "My
            Schedule" Quick Action tile below). Shown above Quick Actions so
            "what's happening today" is the first thing a student sees. */}
        {!isOrphan && token ? <UpcomingClassesCard token={token} /> : null}

        {/* Quick Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('student_dashboard.quick_actions', 'Quick Actions')}</Text>
          <TouchableOpacity
            style={styles.viewAllRow}
            onPress={() => handlePlaceholderPress(t('student_dashboard.viewing_all_actions', 'Viewing all quick actions'))}
          >
            <Text style={styles.viewAllText}>{t('common.view_all', 'View All')}</Text>
            <ChevronRightIcon color={EMERALD} size={15} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          {quickActions.map((action, index) => (
            <QuickActionCard
              key={action.key}
              icon={action.icon(index === 0 ? '#FFFFFF' : EMERALD)}
              title={action.title}
              description={action.description}
              badge={action.badge}
              solid={index === 0}
              onPress={action.onPress}
            />
          ))}
        </View>

        {/* Enrollment status - has the school assigned this student a
            teacher/subject/room/schedule yet? Same gating as above. */}
        {!isOrphan && token ? <EnrollmentStatusCard token={token} /> : null}

        {/* This Month Overview - orphan students only (it's report-backed) */}
        {isOrphan ? (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeaderRow}>
              <Text style={styles.overviewTitle}>{t('student_dashboard.month_overview_title', 'This Month Overview')}</Text>
              <TouchableOpacity
                style={styles.monthPill}
                onPress={() => handlePlaceholderPress(t('student_dashboard.choosing_month', 'Choosing a different month'))}
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
                <StatItem
                  icon={<DocumentIcon color={EMERALD} size={20} />}
                  value={reportsSubmitted}
                  label={t('student_dashboard.reports_submitted_label', 'Reports Submitted')}
                />
                <StatItem
                  icon={<StarIcon color={EMERALD} size={20} />}
                  value={averageScore}
                  unit={averageScore !== '-' ? '%' : undefined}
                  label={t('student_dashboard.average_score_label', 'Average Score')}
                />
                <StatItem
                  icon={<CheckCircleIcon color={EMERALD} size={20} />}
                  value="-"
                  label={t('student_dashboard.activities_completed_label', 'Activities Completed')}
                />
                <StatItem
                  icon={<ClockIcon color={EMERALD} size={20} />}
                  value="-"
                  label={t('student_dashboard.time_spent_label', 'Time Spent')}
                />
              </View>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                {t(
                  'student_dashboard.stats_note',
                  'Reports Submitted and Average Score are wired to your real submission history. Activities Completed and Time Spent will connect once those features are built.',
                )}
              </Text>
            </View>
          </View>
        ) : null}
        {footer}
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
  profileAvatarSpacing: { marginRight: 12 },
  glassTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  glassSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GLASS_ICON_BG,
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

  // Matches the "Manage" grid card design (AdminDashboard): big rounded
  // icon badge, bold title + description, circular arrow button bottom
  // right, and a solid-emerald variant for the single highlighted card.
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  quickCard: {
    width: '48%',
    borderRadius: 22,
    padding: 16,
    minHeight: 176,
    marginBottom: 14,
  },
  quickCardSolid: { backgroundColor: EMERALD },
  quickCardSoft: { backgroundColor: EMERALD_SOFT },
  quickIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  quickIconWrapSolid: { backgroundColor: 'rgba(255,255,255,0.16)' },
  quickIconWrapSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },
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
  quickTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 5 },
  quickTitleSolid: { color: '#FFFFFF' },
  quickDescription: { fontSize: 12.5, color: SUBTLE, lineHeight: 17 },
  quickDescriptionSolid: { color: 'rgba(255,255,255,0.8)' },
  quickArrowRow: { marginTop: 'auto', alignItems: 'flex-end' },
  quickArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickArrowButtonSolid: { backgroundColor: 'rgba(255,255,255,0.2)' },
  quickArrowButtonSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },

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
