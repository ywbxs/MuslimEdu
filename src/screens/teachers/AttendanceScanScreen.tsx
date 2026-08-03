import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner, Code } from 'react-native-vision-camera';
import Svg, { Polyline, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import {
  scanAttendance,
  fetchAttendanceRoster,
  applyRecordsToCachedRoster,
  RosterStudent,
} from '../../services/teacherAttendanceService';
import { enqueueAttendanceScan } from '../../services/offlineQueue';
import { parseStudentIdQrPayload } from '../../services/studentIdCardService';
import UserAvatar from '../../components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const DANGER = COLORS.danger;

// Ignore a repeat read of the same code within this window - a code sits in
// frame for many camera frames in a row, and without this the same student
// would get "scanned" (and re-POSTed) dozens of times a second.
const RESCAN_COOLDOWN_MS = 3000;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCheckCircle({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 12l2.5 2.5L16 9" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface ScannedEntry {
  student_id: number;
  student_name: string;
  photo: string | null;
  check_in_time: string | null;
}

function PermissionGate({ onRequest }: { onRequest: () => void }) {
  const { t } = useLocale();
  return (
    <View style={styles.centerWrap}>
      <Text style={styles.permTitle}>{t('attendance_scan.permission_title', 'Camera access needed')}</Text>
      <Text style={styles.permBody}>
        {t('attendance_scan.permission_body', 'To scan student ID/QR codes, allow this app to use your camera.')}
      </Text>
      <TouchableOpacity style={styles.permBtn} onPress={onRequest} activeOpacity={0.85}>
        <Text style={styles.permBtnText}>{t('attendance_scan.grant_access', 'Grant Access')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Camera + QR/barcode scanner for the "Scan ID / QR" attendance method.
 * Each successful, non-duplicate scan calls teacher_attendance_scan (one
 * POST per student, not a batch) and appends to a running "checked in"
 * list so the teacher gets immediate feedback without leaving the camera
 * view. Uses react-native-vision-camera's built-in code scanner - no
 * frame-processor plugin needed for QR/barcode.
 */
export default function AttendanceScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, subjectId, classLabel, subjectLabel, date } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline } = useOfflineQueue();

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [scanned, setScanned] = useState<ScannedEntry[]>([]);
  const [banner, setBanner] = useState<{ text: string; isError: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const lastScans = useRef<Map<string, number>>(new Map());
  // Kept in memory (and cached on disk by fetchAttendanceRoster itself) so a
  // scanned code can be resolved to a student locally while offline, the
  // same way teacher_attendance_scan resolves it server-side.
  const rosterRef = useRef<RosterStudent[]>([]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (!token || !sectionId) return;
    fetchAttendanceRoster(token, sectionId, subjectId, date)
      .then((roster) => {
        rosterRef.current = roster.students;
      })
      .catch(() => {
        // Best-effort warm-up only - if this fails (e.g. first-ever load
        // with no connection and nothing cached yet), offline scanning just
        // won't be able to resolve a code until a roster load succeeds once.
      });
  }, [token, sectionId, subjectId, date]);

  const handleCode = useCallback(
    async (raw: string) => {
      const now = Date.now();
      const lastAt = lastScans.current.get(raw);
      if (lastAt && now - lastAt < RESCAN_COOLDOWN_MS) return;
      lastScans.current.set(raw, now);

      if (!token || !sectionId || isProcessing) return;
      setIsProcessing(true);
      try {
        if (!isOnline) {
          const code = parseStudentIdQrPayload(raw);
          const student = rosterRef.current.find((s) => s.code === code);
          if (!student) {
            setBanner({ text: t('attendance_scan.offline_no_match', 'No matching student in the cached roster.'), isError: true });
            return;
          }
          const checkInTime = new Date().toTimeString().slice(0, 5);
          enqueueAttendanceScan(token, sectionId, subjectId, date, raw);
          applyRecordsToCachedRoster(token, sectionId, subjectId, date, [
            { student_id: student.student_id, status: 'present', check_in_time: checkInTime },
          ]).catch(() => {});
          setScanned((prev) => {
            const withoutDup = prev.filter((p) => p.student_id !== student.student_id);
            return [
              { student_id: student.student_id, student_name: student.student_name, photo: student.photo, check_in_time: checkInTime },
              ...withoutDup,
            ];
          });
          setBanner({ text: t('attendance_scan.offline_checked_in', 'Checked in offline - will sync automatically.'), isError: false });
          return;
        }

        const result = await scanAttendance(token, sectionId, subjectId, date, raw);
        setScanned((prev) => {
          const withoutDup = prev.filter((p) => p.student_id !== result.student.student_id);
          return [
            {
              student_id: result.student.student_id,
              student_name: result.student.student_name,
              photo: result.student.photo,
              check_in_time: result.student.check_in_time,
            },
            ...withoutDup,
          ];
        });
        setBanner({ text: result.message, isError: false });
      } catch (err) {
        setBanner({ text: err instanceof Error ? err.message : t('attendance_scan.scan_error', 'Could not check in that code.'), isError: true });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setBanner(null), 2500);
      }
    },
    [token, sectionId, subjectId, date, isProcessing, isOnline, t],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'ean-13'],
    onCodeScanned: (codes: Code[]) => {
      const value = codes.find((c) => !!c.value)?.value;
      if (value) handleCode(value);
    },
  });

  // Each scan already checks the student in immediately (one POST per scan,
  // see handleCode above) - this button is the teacher's explicit "I'm done
  // scanning this batch" action. The brief loading state is deliberate, not
  // padding: it gives the camera view a beat to tear down cleanly before the
  // roster screen mounts, instead of the two transitions colliding.
  const handleFinish = () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setTimeout(() => {
      (navigation as any).replace('TeacherAttendanceRoster', {
        sectionId,
        subjectId,
        classLabel,
        subjectLabel,
        date,
      });
    }, 400);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('attendance_scan.title', 'Scan ID / QR')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subjectLabel ?? ''}</Text>
        </View>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{scanned.length}</Text>
        </View>
      </View>

      <View style={styles.cameraWrap}>
        {!hasPermission ? (
          <PermissionGate onRequest={requestPermission} />
        ) : !device ? (
          <View style={styles.centerWrap}>
            <Text style={styles.permBody}>{t('attendance_scan.no_camera', 'No camera is available on this device.')}</Text>
          </View>
        ) : (
          <>
            <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} codeScanner={codeScanner} />
            <View style={styles.scanFrame} pointerEvents="none" />
          </>
        )}

        {banner ? (
          <View style={[styles.banner, banner.isError ? styles.bannerError : styles.bannerOk]}>
            <Text style={styles.bannerText} numberOfLines={2}>{banner.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.listWrap}>
        <Text style={styles.listTitle}>
          {t('attendance_scan.checked_in', '{count} checked in').replace('{count}', String(scanned.length))}
        </Text>
        <FlatList
          data={scanned}
          keyExtractor={(item) => String(item.student_id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.scannedCard}>
              <UserAvatar name={item.student_name} photo={item.photo} size={44} dotColor={EMERALD} />
              <Text style={styles.scannedName} numberOfLines={1}>{item.student_name}</Text>
              <View style={styles.scannedCheck}>
                <IconCheckCircle color={EMERALD} />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyHint}>{t('attendance_scan.empty_hint', 'Point the camera at a student ID card to check them in.')}</Text>
          }
        />

        <TouchableOpacity
          style={[styles.finishButton, (scanned.length === 0 || isFinishing) && styles.finishButtonDisabled]}
          onPress={handleFinish}
          disabled={scanned.length === 0 || isFinishing}
          activeOpacity={0.85}
        >
          {isFinishing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.finishButtonText}>
              {t('attendance_scan.save_and_view', 'Save & View Attendance Status')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0B0D10' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
  countChip: {
    minWidth: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countChipText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  cameraWrap: { flex: 1, position: 'relative' },
  scanFrame: {
    position: 'absolute',
    top: '28%',
    left: '15%',
    right: '15%',
    height: '30%',
    borderWidth: 3,
    borderColor: EMERALD,
    borderRadius: RADIUS.lg,
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  permBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  permBtn: { backgroundColor: EMERALD, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 13 },
  permBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },

  banner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: RADIUS.md,
    padding: 14,
    ...SHADOW.level2,
  },
  bannerOk: { backgroundColor: 'rgba(15,157,88,0.92)' },
  bannerError: { backgroundColor: 'rgba(229,72,77,0.92)' },
  bannerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5, textAlign: 'center' },

  listWrap: { backgroundColor: SURFACE, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  listTitle: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  scannedCard: { alignItems: 'center', width: 68 },
  scannedName: { fontSize: 11, color: INK, marginTop: 6, fontWeight: '600' },
  scannedCheck: { position: 'absolute', top: -2, right: 2 },
  emptyHint: { fontSize: 12.5, color: SUBTLE, paddingHorizontal: 16, lineHeight: 18 },

  finishButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.md,
    marginHorizontal: 16,
    marginTop: SPACING.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: { opacity: 0.5 },
  finishButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
