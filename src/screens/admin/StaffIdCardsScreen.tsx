import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import { ChevronLeft, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchTeacherList, fetchTeacherProfile, StaffSummary, TeacherProfile } from '../../services/adminTeacherService';
import { fetchCashierAccounts, fetchCashierProfile, CashierAccount, CashierProfile } from '../../services/feeService';
import { fetchRegistrarAccounts, fetchRegistrarProfile, RegistrarAccount, RegistrarProfile } from '../../services/registrarService';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
import { saveLocalFileToDevice } from '../../utils/downloadFile';
import StudentIdCard, { CARD_THEMES, CardTheme } from '../../components/StudentIdCard';
import UserAvatar from '../../components/UserAvatar';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import GlassBackground from '../../components/glass/GlassBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const BORDER = COLORS.border;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconClose({ color, size = 18 }: { color: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.2} />;
}

function TileSkeleton() {
  return (
    <View style={styles.tile}>
      <SkeletonCircle size={48} />
      <Skeleton width="70%" height={12} style={{ marginTop: 10 }} />
    </View>
  );
}

type StaffRole = 'teacher' | 'accountant' | 'registrar';

interface StaffRow {
  id: number;
  role: StaffRole;
  name: string;
  photo: string | null;
  code: string | null;
}

const ROLE_TABS: { key: StaffRole; label: string }[] = [
  { key: 'teacher', label: 'Teachers' },
  { key: 'accountant', label: 'Cashiers' },
  { key: 'registrar', label: 'Registrars' },
];

/**
 * Admin browsing screen for staff ID cards - teachers, cashiers, and
 * registrars each have their own list+profile endpoints (see
 * adminTeacherService/feeService/registrarService), switched between with a
 * role tab bar. Reuses the same redesigned StudentIdCard component as the
 * student cards screen, with personType="staff" and role-appropriate data.
 */
export default function StaffIdCardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const cardRef = useRef<View>(null);

  const [activeRole, setActiveRole] = useState<StaffRole>('teacher');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolBackground, setSchoolBackground] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<TeacherProfile | CashierProfile | RegistrarProfile | null>(null);
  const [theme, setTheme] = useState<CardTheme>(CARD_THEMES[0]);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setIsLoading(true);

    const listFetch: Promise<StaffRow[]> =
      activeRole === 'teacher'
        ? fetchTeacherList(token).then((list) => list.map((r) => ({ id: r.id, role: 'teacher' as const, name: r.name, photo: r.photo, code: r.code })))
        : activeRole === 'accountant'
        ? fetchCashierAccounts(token).then((list) => list.map((r) => ({ id: r.id, role: 'accountant' as const, name: r.name, photo: r.photo, code: r.code })))
        : fetchRegistrarAccounts(token).then((list) => list.map((r) => ({ id: r.id, role: 'registrar' as const, name: r.name, photo: r.photo ?? null, code: r.code })));

    Promise.all([listFetch, fetchMySchoolBranding(token).catch(() => null)])
      .then(([list, branding]) => {
        setRows(list);
        setSchoolName(branding?.name ?? null);
        setSchoolAddress(branding?.address ?? null);
        setSchoolLogo(branding?.logo ?? null);
        setSchoolBackground(branding?.id_card_background ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('staff_id_cards.load_error', 'Could not load staff.')))
      .finally(() => setIsLoading(false));
  }, [token, activeRole, t]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!selected || !token) {
      setSelectedProfile(null);
      return;
    }
    let cancelled = false;
    const profileFetch =
      selected.role === 'teacher'
        ? fetchTeacherProfile(token, selected.id)
        : selected.role === 'accountant'
        ? fetchCashierProfile(token, selected.id)
        : fetchRegistrarProfile(token, selected.id);
    profileFetch
      .then((profile) => {
        if (!cancelled) setSelectedProfile(profile);
      })
      .catch(() => {
        // Best-effort - the card falls back to the row's summary fields.
      });
    return () => {
      cancelled = true;
    };
  }, [selected, token]);

  const handleExport = async () => {
    if (!cardRef.current || !selected) return;
    setIsExporting(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const fileName = `staff-id-${selected.code ?? selected.id}.png`;
      const savedPath = await saveLocalFileToDevice(uri, fileName);
      Alert.alert(
        t('staff_id_cards.saved_title', 'Saved'),
        t('staff_id_cards.saved_message', "{name}'s ID card was saved to your device: {path}")
          .replace('{name}', selected.name)
          .replace('{path}', savedPath),
      );
    } catch (err) {
      Alert.alert(
        t('staff_id_cards.export_error_title', 'Could not export'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('staff_id_cards.title', 'Staff ID Cards')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabRow}>
        {ROLE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeRole === tab.key && styles.tabActive]}
            onPress={() => setActiveRole(tab.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeRole === tab.key && styles.tabTextActive]}>
              {t(`staff_id_cards.tab_${tab.key}`, tab.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => <TileSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.role}-${item.id}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('staff_id_cards.empty', 'No staff found.')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={() => setSelected(item)}>
              <UserAvatar name={item.name} photo={item.photo} size={48} dotColor={null} />
              <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
              {item.code ? <Text style={styles.tileCode} numberOfLines={1}>{item.code}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelected(null)} hitSlop={10}>
              <IconClose color={SUBTLE} />
            </TouchableOpacity>

            {selected ? (
              <View style={styles.modalCardWrap} ref={cardRef} collapsable={false}>
                <StudentIdCard
                  student={{
                    name: selected.name,
                    nameAr: selectedProfile?.name_ar,
                    photo: selected.photo,
                    code: selected.code ?? String(selected.id),
                    personType: 'staff',
                    schoolName,
                    schoolAddress,
                    schoolLogoUrl: schoolLogo,
                    dob: (selectedProfile as TeacherProfile | CashierProfile)?.birthday,
                    address: (selectedProfile as TeacherProfile | CashierProfile)?.address,
                    emergencyContactName: selectedProfile?.emergency_contact_name,
                    emergencyContactPhone: selectedProfile?.emergency_contact_phone,
                    signatureUrl: selectedProfile?.signature,
                  }}
                  theme={theme}
                  backgroundImageUrl={schoolBackground}
                />
              </View>
            ) : null}

            {schoolBackground ? null : (
              <View style={styles.themeRow}>
                {CARD_THEMES.map((th) => (
                  <TouchableOpacity
                    key={th.key}
                    style={[styles.themeSwatch, { backgroundColor: th.colors[1] }, theme.key === th.key && styles.themeSwatchActive]}
                    onPress={() => setTheme(th)}
                    activeOpacity={0.85}
                  />
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
              {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('staff_id_cards.export', 'Save to Device')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, flex: 1, marginLeft: 8 },

  tabRow: { flexDirection: 'row', padding: SPACING.md, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  tabText: { fontSize: 13, fontWeight: '700', color: SUBTLE },
  tabTextActive: { color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },
  emptyText: { color: SUBTLE, fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.md, gap: SPACING.sm },
  listContent: { padding: SPACING.md },
  row: { gap: SPACING.sm },
  tile: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOW.level1,
  },
  tileName: { fontSize: 13, fontWeight: '700', color: INK, marginTop: 8, textAlign: 'center' },
  tileCode: { fontSize: 11, color: SUBTLE, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: SURFACE, borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', width: '100%' },
  modalCloseBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  modalCardWrap: { marginBottom: SPACING.md },

  themeRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  themeSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: EMERALD },

  exportBtn: { alignSelf: 'stretch', backgroundColor: EMERALD, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
