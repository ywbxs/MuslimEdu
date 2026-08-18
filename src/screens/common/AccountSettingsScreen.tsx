import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Type,
  Globe,
  Palette,
  CalendarDays,
  CalendarClock,
  ShieldCheck,
  Mail,
  Phone,
  BellRing,
  KeyRound,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { DISPLAY_SCALE_OPTIONS, useDisplayScale } from '../../context/DisplayScaleContext';
import { INK, SUBTLE } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';
import { Skeleton } from '../../components/Skeleton';
import {
  UserSettings,
  UserSettingsOptions,
  fetchUserSettings,
  saveUserSettings,
} from '../../services/studentPortalService';
import { AccountSettingField, AccountSettingOption } from './AccountSettingPickerScreen';

/**
 * M5 student portal — generic account settings (theme, language, calendar,
 * privacy, digest frequency) plus password change. Available to any
 * authenticated user, not just students. Backend: StudentPortalController::
 * settingsShow/settingsSave/passwordUpdate, verified live this session.
 *
 * Redesign: this used to be one long page of inline chip clusters for
 * every setting, all batched behind a single "Save settings" button at
 * the bottom. Rebuilt as a tappable list (icon, label, current value,
 * chevron) - each row opens a small focused screen for just that one
 * setting (AccountSettingPickerScreen, or ChangePasswordScreen for
 * security) and applies instantly, the way Settings apps actually work.
 * useFocusEffect re-fetches on return so this list always reflects
 * whatever was just changed in one of those screens.
 *
 * Toggles (show email/phone) stay inline here rather than becoming their
 * own screens - flipping a switch already IS the whole interaction, a
 * dedicated wizard page for a single on/off choice would be friction with
 * no benefit.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const EMERALD_SOFT = '#E5F8F5';

function labelize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', ar: 'العربية' };
function languageLabel(code: string) {
  return LANGUAGE_LABELS[code] ?? labelize(code);
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}

function Row({
  icon,
  title,
  value,
  onPress,
  isLast,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.row, !isLast && styles.rowDivider]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowTitle}>{title}</Text>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      <IconChevronRight color={SUBTLE} />
    </TouchableOpacity>
  );
}

function SwitchRow({
  icon,
  title,
  value,
  onValueChange,
  isLast,
}: {
  icon: React.ReactNode;
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowTitle}>{title}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D8DED9', true: BRAND.emeraldDeep }} />
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ListSkeleton() {
  return (
    <View style={styles.content}>
      {[0, 1].map((section) => (
        <View key={section} style={{ marginBottom: 20 }}>
          <Skeleton width={130} height={12} style={{ marginBottom: 10, borderRadius: 4 }} />
          <View style={styles.card}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={[styles.row, row !== 2 && styles.rowDivider]}>
                <Skeleton width={30} height={30} style={{ borderRadius: 8 }} />
                <Skeleton width="40%" height={13} style={{ borderRadius: 4, marginLeft: 12 }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();
  const { scale, setScale } = useDisplayScale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [options, setOptions] = useState<UserSettingsOptions | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchUserSettings(token);
      setSettings(data.settings);
      setOptions(data.options);
    } catch (e: any) {
      setError(e?.message ?? t('account_settings.load_error', 'Could not load your settings.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPicker = (settingField: AccountSettingField | 'display_scale', title: string, pickerOptions: AccountSettingOption[], currentKey: string) => {
    (navigation as any).navigate('AccountSettingPicker', { settingField, title, options: pickerOptions, currentKey });
  };

  const toggleField = async (field: 'show_email' | 'show_phone', value: boolean) => {
    if (!token || !settings) return;
    const previous = settings[field];
    setSettings({ ...settings, [field]: value });
    try {
      await saveUserSettings(token, { [field]: value });
    } catch {
      // Roll back - the row's own switch is the only feedback needed for
      // a failed instant-apply toggle, no separate error screen for this.
      setSettings((prev) => (prev ? { ...prev, [field]: previous } : prev));
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
        <IconChevronLeft color={BRAND.emeraldDeep} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{t('account_settings.header_title', 'Account Settings')}</Text>
        <Text style={styles.headerSub}>
          {t('account_settings.header_subtitle', 'Language, appearance, privacy and password')}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.flex}>
        {header}
        <ScrollView><ListSkeleton /></ScrollView>
      </View>
    );
  }

  if (error || !settings || !options) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('common.load_failed_title', "Couldn't load this")}</Text>
          <Text style={styles.centerText}>{error ?? t('account_settings.something_wrong', 'Something went wrong.')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const languageOptions = Array.from(new Set([...options.languages, 'en', 'ar']));
  const displayScaleOpt = DISPLAY_SCALE_OPTIONS.find((o) => Math.abs(o.value - scale) < 0.001) ?? DISPLAY_SCALE_OPTIONS[1];

  return (
    <View style={styles.flex}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel title={t('account_settings.accessibility_section', 'Accessibility')} />
        <View style={styles.card}>
          <Row
            icon={<Type size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.display_size_label', 'Text & display size')}
            value={t(`accessibility.size.${displayScaleOpt.key}`, displayScaleOpt.label)}
            isLast
            onPress={() =>
              openPicker(
                'display_scale',
                t('account_settings.display_size_label', 'Text & display size'),
                DISPLAY_SCALE_OPTIONS.map((o) => ({ key: o.key, label: t(`accessibility.size.${o.key}`, o.label) })),
                displayScaleOpt.key,
              )
            }
          />
        </View>

        <SectionLabel title={t('account_settings.language_appearance_section', 'Language & appearance')} />
        <View style={styles.card}>
          <Row
            icon={<Globe size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.language_label', 'Language')}
            value={languageLabel(settings.language)}
            onPress={() =>
              openPicker(
                'language',
                t('account_settings.language_label', 'Language'),
                languageOptions.map((code) => ({ key: code, label: languageLabel(code) })),
                settings.language,
              )
            }
          />
          <Row
            icon={<Palette size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.theme_label', 'Theme')}
            value={labelize(settings.theme)}
            onPress={() =>
              openPicker(
                'theme',
                t('account_settings.theme_label', 'Theme'),
                options.themes.map((v) => ({ key: v, label: labelize(v) })),
                settings.theme,
              )
            }
          />
          <Row
            icon={<CalendarDays size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.calendar_label', 'Calendar')}
            value={labelize(settings.calendar_type)}
            onPress={() =>
              openPicker(
                'calendar_type',
                t('account_settings.calendar_label', 'Calendar'),
                options.calendar_types.map((v) => ({ key: v, label: labelize(v) })),
                settings.calendar_type,
              )
            }
          />
          <Row
            icon={<CalendarClock size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.date_format_label', 'Date format')}
            value={settings.date_format}
            isLast
            onPress={() =>
              openPicker(
                'date_format',
                t('account_settings.date_format_label', 'Date format'),
                options.date_formats.map((v) => ({ key: v, label: v })),
                settings.date_format,
              )
            }
          />
        </View>

        <SectionLabel title={t('account_settings.privacy_section', 'Privacy')} />
        <View style={styles.card}>
          <Row
            icon={<ShieldCheck size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.profile_visibility_label', 'Profile visibility')}
            value={labelize(settings.profile_visibility)}
            onPress={() =>
              openPicker(
                'profile_visibility',
                t('account_settings.profile_visibility_label', 'Profile visibility'),
                options.profile_visibility.map((v) => ({ key: v, label: labelize(v) })),
                settings.profile_visibility,
              )
            }
          />
          <SwitchRow
            icon={<Mail size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.show_email_label', 'Show email on my profile')}
            value={settings.show_email}
            onValueChange={(v) => toggleField('show_email', v)}
          />
          <SwitchRow
            icon={<Phone size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.show_phone_label', 'Show phone on my profile')}
            value={settings.show_phone}
            onValueChange={(v) => toggleField('show_phone', v)}
          />
          <Row
            icon={<BellRing size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.digest_emails_label', 'Digest emails')}
            value={labelize(settings.digest_frequency)}
            isLast
            onPress={() =>
              openPicker(
                'digest_frequency',
                t('account_settings.digest_emails_label', 'Digest emails'),
                options.digest_frequency.map((v) => ({ key: v, label: labelize(v) })),
                settings.digest_frequency,
              )
            }
          />
        </View>

        <SectionLabel title={t('account_settings.security_section', 'Security')} />
        <View style={styles.card}>
          <Row
            icon={<KeyRound size={16} color={BRAND.emeraldDeep} strokeWidth={2} />}
            title={t('account_settings.change_password', 'Change password')}
            isLast
            onPress={() => (navigation as any).navigate('ChangePassword')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: BRAND.emeraldDeep, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  content: { padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4, marginLeft: 4 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: INK, flex: 1 },
  rowValue: { fontSize: 13.5, color: SUBTLE, marginRight: 6, maxWidth: 120 },
});
