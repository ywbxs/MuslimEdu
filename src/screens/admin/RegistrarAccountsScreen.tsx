import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus, Search, UserRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchRegistrarAccounts, addRegistrar, RegistrarAccount } from '../../services/registrarService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import AccountWizardSheet, { WizardStepDef, wizardFieldStyles } from '../../components/wizard/AccountWizardSheet';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function SearchIcon({ color }: { color: string }) {
  return <Search size={17} color={color} strokeWidth={2} />;
}
function PlusIcon({ color }: { color: string }) {
  return <Plus size={19} color={color} strokeWidth={2.4} />;
}
function EmptyIcon() {
  return <UserRound size={56} color={"#C4C9CF"} strokeWidth={1.6} />;
}

const RegistrarRow = React.memo(function RegistrarRow({ item }: { item: RegistrarAccount }) {
  const { t } = useLocale();
  const active = item.status === 1;
  return (
    <View style={styles.row}>
      <UserAvatar name={item.name} photo={item.photo} size={48} ringColor={HAIRLINE} dotColor={active ? EMERALD : DANGER} />
      <View style={[styles.flex1, { marginLeft: 14 }]}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
        {item.phone ? <Text style={styles.rowPhone} numberOfLines={1}>{item.phone}</Text> : null}
      </View>
      <View style={[styles.statusPill, active ? styles.statusPillOk : styles.statusPillMissing]}>
        <Text style={active ? styles.statusPillTextOk : styles.statusPillTextMissing}>
          {active ? t('registrar_accounts.status_active', 'Active') : t('registrar_accounts.status_inactive', 'Inactive')}
        </Text>
      </View>
    </View>
  );
});

function AddRegistrarSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setNameAr('');
    setEmail('');
    setPassword('');
    setPhone('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const created = await addRegistrar(token, {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactPhone.trim() || undefined,
      });
      resetForm();
      onClose();
      onCreated();
      const message = created.code
        ? t('registrar_accounts.registrar_added_message_with_code', '{name} can now log in with the email and password you set. Staff code: {code}').replace('{name}', name.trim()).replace('{code}', created.code)
        : t('registrar_accounts.registrar_added_message', '{name} can now log in with the email and password you set.').replace('{name}', name.trim());
      Alert.alert(t('registrar_accounts.registrar_added_title', 'Registrar added'), message);
    } catch (err) {
      Alert.alert(t('registrar_accounts.add_error_title', 'Could not add registrar'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStepDef[] = [
    {
      key: 'identity',
      label: t('registrar_accounts.step_identity', 'Identity'),
      render: () => (
        <>
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.full_name_label', 'Full Name')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.full_name_placeholder', 'e.g. Amina binti Yusuf')}
            placeholderTextColor={SUBTLE}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.name_ar_label', 'Arabic Name (optional)')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.name_ar_placeholder', 'الاسم بالعربية')}
            placeholderTextColor={SUBTLE}
            value={nameAr}
            onChangeText={setNameAr}
          />
        </>
      ),
    },
    {
      key: 'account',
      label: t('registrar_accounts.step_account', 'Account'),
      render: () => (
        <>
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.email_label', 'Email')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.email_placeholder', 'registrar@example.com')}
            placeholderTextColor={SUBTLE}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.password_label', 'Password')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.password_placeholder', 'At least 6 characters')}
            placeholderTextColor={SUBTLE}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </>
      ),
    },
    {
      key: 'contact',
      label: t('registrar_accounts.step_contact', 'Contact'),
      render: () => (
        <>
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.phone_label', 'Phone (optional)')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.phone_placeholder', 'e.g. 012-345 6789')}
            placeholderTextColor={SUBTLE}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.emergency_contact_name_label', 'Emergency Contact Name (optional)')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.emergency_contact_name_placeholder', 'e.g. Fatimah binti Ahmad')}
            placeholderTextColor={SUBTLE}
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            autoCapitalize="words"
          />
          <Text style={wizardFieldStyles.label}>{t('registrar_accounts.emergency_contact_phone_label', 'Emergency Contact Phone (optional)')}</Text>
          <TextInput
            style={wizardFieldStyles.input}
            placeholder={t('registrar_accounts.emergency_contact_phone_placeholder', 'e.g. 012-345 6789')}
            placeholderTextColor={SUBTLE}
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            keyboardType="phone-pad"
          />
        </>
      ),
    },
  ];

  const validateStep = (stepIndex: number): string | null => {
    if (stepIndex === 0 && !name.trim()) {
      return t('registrar_accounts.error_name_required', 'Full name is required.');
    }
    if (stepIndex === 1) {
      if (!email.trim() || !password.trim()) {
        return t('registrar_accounts.error_required_fields', 'Name, email, and password are required.');
      }
      if (password.trim().length < 6) {
        return t('registrar_accounts.error_password_length', 'Password must be at least 6 characters.');
      }
    }
    return null;
  };

  return (
    <AccountWizardSheet
      visible={visible}
      onClose={handleClose}
      title={t('registrar_accounts.add_registrar_title', 'Add Registrar')}
      steps={steps}
      validateStep={validateStep}
      onFinish={handleCreate}
      finishing={isSubmitting}
      finishLabel={t('registrar_accounts.add_registrar_title', 'Add Registrar')}
    />
  );
}

/** Admin-only: list + create Registrar accounts. */
export default function RegistrarAccountsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [registrars, setRegistrars] = useState<RegistrarAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchRegistrarAccounts(token);
      setRegistrars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrar_accounts.load_error', 'Failed to load registrars.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrars;
    return registrars.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [registrars, query]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('registrar_accounts.header_title', 'Registrars')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddSheetOpen(true)} hitSlop={8}>
          <PlusIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('registrar_accounts.search_placeholder', 'Search registrars...')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <SkeletonCircle size={48} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => <RegistrarRow item={item} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('registrar_accounts.empty_title', 'No registrars found')}</Text>
              <Text style={styles.emptyBody}>
                {query ? t('registrar_accounts.empty_body_search', 'Try a different search term.') : t('registrar_accounts.empty_body_none', 'Registrars added to your school will show up here.')}
              </Text>
            </View>
          }
        />
      )}

      <AddRegistrarSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} onCreated={load} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  ...SHADOW.level1,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK, padding: 0 },

  listContent: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level2,
  },
  rowName: { fontSize: 15.5, fontWeight: '700', color: INK },
  rowEmail: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  rowPhone: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillMissing: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusPillTextOk: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },
  statusPillTextMissing: { fontSize: 11.5, color: DANGER, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
