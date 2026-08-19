import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import { ChevronLeft, X, Check, ChevronRight, Users } from 'lucide-react-native';
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
import { COLORS, RADIUS, SPACING, BRAND } from '../../theme/glass';

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
function IconCheck({ color, size = 15 }: { color: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={3} />;
}
function IconChevronRight({ color = SUBTLE, size = 18 }: { color?: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.2} />;
}
function IconUsers({ color = SUBTLE, size = 30 }: { color?: string; size?: number }) {
  return <Users size={size} color={color} strokeWidth={1.6} />;
}

function RowSkeleton({ isLast }: { isLast?: boolean }) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <SkeletonCircle size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={13} style={{ marginBottom: 6, borderRadius: 4 }} />
        <Skeleton width="35%" height={10} style={{ borderRadius: 4 }} />
      </View>
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
        <View style={styles.listContent}>
          <View style={styles.listCardWrap}>
            {[0, 1, 2, 3].map((i) => <RowSkeleton key={i} isLast={i === 3} />)}
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <IconUsers />
          </View>
          <Text style={styles.emptyText}>{t('staff_id_cards.empty', 'No staff found.')}</Text>
        </View>
      ) : (
        <View style={styles.listCardWrap}>
          <FlatList
            data={rows}
            keyExtractor={(item) => `${item.role}-${item.id}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.row, index !== rows.length - 1 && styles.rowDivider]}
                activeOpacity={0.7}
                onPress={() => setSelected(item)}
              >
                <UserAvatar name={item.name} photo={item.photo} size={44} dotColor={null} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  {item.code ? <Text style={styles.rowCode} numberOfLines={1}>{item.code}</Text> : null}
                </View>
                <IconChevronRight />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelected(null)} hitSlop={10} activeOpacity={0.8}>
            <IconClose color="#FFFFFF" />
          </TouchableOpacity>

          {selected ? (
            <View style={styles.modalCardWrap} ref={cardRef} collapsable={false}>
              <StudentIdCard
                student={{
                  name: selected.name,
                  nameAr: selectedProfile?.name_ar,
                  // Prefer the freshly-fetched profile's photo over the
                  // list-summary one - admin_teacher_list/admin_accountant_
                  // list/admin_registrar_list are summary endpoints that may
                  // not carry a photo even when the person has one on file;
                  // the dedicated profile fetch is the authoritative source.
                  photo: selectedProfile?.photo ?? selected.photo,
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
                  style={styles.themeSwatchWrap}
                  onPress={() => setTheme(th)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: th.colors[1] }, theme.key === th.key && styles.themeSwatchActive]}>
                    {theme.key === th.key ? <IconCheck color="#FFFFFF" /> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85} disabled={isExporting}>
            {isExporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportBtnText}>{t('staff_id_cards.export', 'Save to Device')}</Text>}
          </TouchableOpacity>
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
  // BRAND.emeraldDeep, not EMERALD - white text on the raw #1FAE64 measures
  // 2.88:1, below WCAG AA's 4.5:1 minimum. Deep emerald measures 5.42:1.
  tabActive: { backgroundColor: BRAND.emeraldDeep, borderColor: BRAND.emeraldDeep },
  tabText: { fontSize: 13, fontWeight: '700', color: SUBTLE },
  tabTextActive: { color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: { color: SUBTLE, fontSize: 14 },

  // A single grouped card of hairline-divided rows (Contacts-app style)
  // instead of a 2-column tile grid - the grid left a large dead gap
  // whenever the list had an odd count (a single result, as in the
  // screenshot, stretched into one lonely full-width tile).
  listContent: { paddingTop: SPACING.md, flex: 1 },
  listCardWrap: {
    flex: 1,
    marginHorizontal: SPACING.md,
    backgroundColor: 'transparent',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowName: { fontSize: 15, fontWeight: '700', color: INK },
  rowCode: { fontSize: 12, color: SUBTLE, marginTop: 2 },

  // The card now floats directly on the dark backdrop, Apple Wallet-pass
  // style, instead of sitting nested inside a second white rounded box -
  // that nesting doubled the rounding/shadow and buried the card's own
  // presentation under a redundant layer of chrome.
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,20,15,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCardWrap: { marginBottom: SPACING.lg },

  themeRow: { flexDirection: 'row', gap: 14, marginBottom: SPACING.lg },
  themeSwatchWrap: { padding: 3 },
  themeSwatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  themeSwatchActive: { borderColor: '#FFFFFF' },

  exportBtn: {
    alignSelf: 'stretch',
    maxWidth: 288,
    backgroundColor: BRAND.emeraldDeep,
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
