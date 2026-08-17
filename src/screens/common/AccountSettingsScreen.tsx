import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Type,
  Globe,
  ShieldCheck,
  KeyRound,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale, RTL_LOCALES } from '../../context/LocaleContext';
import { DISPLAY_SCALE_OPTIONS, useDisplayScale } from '../../context/DisplayScaleContext';
import { INK, SUBTLE } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';
import { Skeleton } from '../../components/Skeleton';
import {
  UserSettings,
  UserSettingsOptions,
  fetchUserSettings,
  saveUserSettings,
  updatePassword,
} from '../../services/studentPortalService';

/**
 * M5 student portal — generic account settings (theme, language, calendar,
 * privacy, digest frequency) plus password change. Available to any
 * authenticated user, not just students. Backend: StudentPortalController::
 * settingsShow/settingsSave/passwordUpdate, verified live this session.
 *
 * Language changes are pushed into the app's existing i18n plumbing
 * (LocaleContext) immediately on save, instead of requiring a restart.
 *
 * Redesign: EMERALD (#1FAE64) was used as a fill with white text/icons in
 * several places (chips, save buttons, retry button) - that combination
 * measures 2.88:1, below WCAG AA's 4.5:1 minimum, the same failure mode
 * fixed elsewhere in the app this session. Every filled control here now
 * uses BRAND.emeraldDeep (5.42:1) instead. The loading state also no
 * longer blocks on a spinner - it shows a skeleton shaped like the real
 * layout, per the section's own pattern used everywhere else in the app.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const EMERALD_SOFT = '#E5F8F5';

function labelize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

// Proper display names for language codes (labelize() alone would show
// Arabic as "Ar") - falls back to labelize() for any other code the
// backend adds later.
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', ar: 'العربية' };
function languageLabel(code: string) {
  return LANGUAGE_LABELS[code] ?? labelize(code);
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconType({ color }: { color: string }) {
  return <Type size={16} color={color} strokeWidth={2} />;
}
function IconGlobe({ color }: { color: string }) {
  return <Globe size={16} color={color} strokeWidth={2} />;
}
function IconShield({ color }: { color: string }) {
  return <ShieldCheck size={16} color={color} strokeWidth={2} />;
}
function IconKey({ color }: { color: string }) {
  return <KeyRound size={16} color={color} strokeWidth={2} />;
}
function IconCheck({ color, size = 12 }: { color: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={3} />;
}
function IconEye({ color, off }: { color: string; off: boolean }) {
  return off ? <EyeOff size={18} color={color} strokeWidth={2} /> : <Eye size={18} color={color} strokeWidth={2} />;
}

function SectionHeader({ icon, title, dark }: { icon: React.ReactNode; title: string; dark?: boolean }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, dark && styles.sectionIconWrapDark]}>{icon}</View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      {selected ? (
        <View style={styles.chipCheck}>
          <IconCheck color="#FFFFFF" />
        </View>
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  isLast,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  isLast?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={SUBTLE}
        />
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <IconEye color={SUBTLE} off={!visible} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SettingsSkeleton() {
  return (
    <View style={styles.scrollContent}>
      {[0, 1, 2].map((section) => (
        <View key={section} style={{ marginBottom: 16 }}>
          <Skeleton width={130} height={12} style={{ marginBottom: 10, borderRadius: 4 }} />
          <View style={styles.card}>
            <Skeleton width="45%" height={13} style={{ marginBottom: 10, borderRadius: 4 }} />
            <View style={styles.chipRow}>
              <Skeleton width={70} height={34} style={{ borderRadius: 999 }} />
              <Skeleton width={90} height={34} style={{ borderRadius: 999 }} />
              <Skeleton width={80} height={34} style={{ borderRadius: 999 }} />
            </View>
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
  const { t, isRTL, refresh: refreshLocale } = useLocale();
  const { scale, setScale } = useDisplayScale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [options, setOptions] = useState<UserSettingsOptions | null>(null);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
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

  useEffect(() => {
    load();
  }, [load]);

  const patch = (fields: Partial<UserSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...fields } : prev));
  };

  const onSave = async () => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      // Capture RTL-ness before the switch - I18nManager only takes full
      // visual effect on the next app launch (see LocaleContext.refresh),
      // so a flip needs its own "restart to apply" message rather than
      // the normal saved alert alone.
      const wasRTL = isRTL;
      await saveUserSettings(token, settings);
      await refreshLocale(settings.language);
      const willBeRTL = RTL_LOCALES.has(settings.language);

      if (willBeRTL !== wasRTL) {
        Alert.alert(
          t('account_settings.restart_required_title', 'Restart required'),
          t(
            'account_settings.restart_required_message',
            'Your language was saved. Restart the app for the right-to-left layout to fully apply.',
          ),
        );
      } else {
        Alert.alert(t('account_settings.saved_title', 'Saved'), t('account_settings.saved_message', 'Your settings have been updated.'));
      }
    } catch (e: any) {
      Alert.alert(
        t('account_settings.save_error_title', 'Could not save'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    if (!token) return;
    if (!currentPassword || !newPassword) {
      Alert.alert(
        t('account_settings.missing_fields_title', 'Missing fields'),
        t('account_settings.missing_fields_message', 'Enter your current password and a new password.'),
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('account_settings.password_mismatch_title', "Passwords don't match"),
        t('account_settings.password_mismatch_message', 'Re-type the new password so both fields match.'),
      );
      return;
    }
    setChangingPassword(true);
    try {
      await updatePassword(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        t('account_settings.password_updated_title', 'Password updated'),
        t('account_settings.password_updated_message', 'Your password has been changed.'),
      );
    } catch (e: any) {
      Alert.alert(
        t('account_settings.password_error_title', 'Could not change password'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setChangingPassword(false);
    }
  };

  // paddingTop lives on the header itself, not the outer container - the
  // header's white background needs to extend up through the status-bar
  // safe area too, or that strip shows the plain canvas color instead and
  // reads as a seam between two different surfaces.
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
        <ScrollView style={styles.scroll}>
          <SettingsSkeleton />
        </ScrollView>
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

  const ChipGroup = ({
    optionsList,
    value,
    onSelect,
    labelFor = labelize,
  }: {
    optionsList: string[];
    value: string;
    onSelect: (v: string) => void;
    labelFor?: (opt: string) => string;
  }) => (
    <View style={styles.chipRow}>
      {optionsList.map((opt) => (
        <Chip key={opt} label={labelFor(opt)} selected={value === opt} onPress={() => onSelect(opt)} />
      ))}
    </View>
  );

  // Arabic is always offered here even if the backend's own options list
  // hasn't been updated to include it yet - same "ship ahead, backend
  // catches up" convention used elsewhere in this app, and a missing
  // 'ar' here would otherwise silently mean no RTL option ever appears.
  const languageOptions = Array.from(new Set([...options.languages, 'en', 'ar']));

  return (
    <View style={styles.flex}>
      {header}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionHeader icon={<IconType color={BRAND.emeraldDeep} />} title={t('account_settings.accessibility_section', 'Accessibility')} />
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.display_size_label', 'Text & display size')}</Text>
          <View style={styles.chipRow}>
            {DISPLAY_SCALE_OPTIONS.map((opt) => {
              const selected = Math.abs(opt.value - scale) < 0.001;
              return (
                <Chip
                  key={opt.key}
                  label={t(`accessibility.size.${opt.key}`, opt.label)}
                  selected={selected}
                  onPress={() => setScale(opt.value)}
                />
              );
            })}
          </View>
        </View>

        <SectionHeader icon={<IconGlobe color={BRAND.emeraldDeep} />} title={t('account_settings.language_appearance_section', 'Language & appearance')} />
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.language_label', 'Language')}</Text>
          <ChipGroup optionsList={languageOptions} value={settings.language} onSelect={(v) => patch({ language: v })} labelFor={languageLabel} />

          <Text style={styles.label}>{t('account_settings.theme_label', 'Theme')}</Text>
          <ChipGroup optionsList={options.themes} value={settings.theme} onSelect={(v) => patch({ theme: v })} />

          <Text style={styles.label}>{t('account_settings.calendar_label', 'Calendar')}</Text>
          <ChipGroup
            optionsList={options.calendar_types}
            value={settings.calendar_type}
            onSelect={(v) => patch({ calendar_type: v })}
          />

          <Text style={styles.label}>{t('account_settings.date_format_label', 'Date format')}</Text>
          <ChipGroup
            optionsList={options.date_formats}
            value={settings.date_format}
            onSelect={(v) => patch({ date_format: v })}
          />
        </View>

        <SectionHeader icon={<IconShield color={BRAND.emeraldDeep} />} title={t('account_settings.privacy_section', 'Privacy')} />
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.profile_visibility_label', 'Profile visibility')}</Text>
          <ChipGroup
            optionsList={options.profile_visibility}
            value={settings.profile_visibility}
            onSelect={(v) => patch({ profile_visibility: v })}
          />

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.rowTitle}>{t('account_settings.show_email_label', 'Show email on my profile')}</Text>
            <Switch
              value={settings.show_email}
              onValueChange={(v) => patch({ show_email: v })}
              trackColor={{ false: '#D8DED9', true: BRAND.emeraldDeep }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.rowTitle}>{t('account_settings.show_phone_label', 'Show phone on my profile')}</Text>
            <Switch
              value={settings.show_phone}
              onValueChange={(v) => patch({ show_phone: v })}
              trackColor={{ false: '#D8DED9', true: BRAND.emeraldDeep }}
            />
          </View>

          <Text style={styles.label}>{t('account_settings.digest_emails_label', 'Digest emails')}</Text>
          <ChipGroup
            optionsList={options.digest_frequency}
            value={settings.digest_frequency}
            onSelect={(v) => patch({ digest_frequency: v })}
          />
        </View>

        {/* Save is the primary action for everything above - a solid pill
            standing apart from the cards, not another bordered box, so it
            reads as "commit" rather than one more settings row. */}
        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving} activeOpacity={0.85}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('account_settings.save_settings', 'Save settings')}</Text>
          )}
        </TouchableOpacity>

        {/* Password gets a distinct tinted card, not the same white as
            everything else above - a security action deserves to read as
            a separate, deliberate zone rather than blend into the rest of
            the settings list. */}
        <SectionHeader icon={<IconKey color="#FFFFFF" />} title={t('account_settings.password_section', 'Password')} dark />
        <View style={[styles.card, styles.cardSecurity]}>
          <PasswordField
            label={t('account_settings.current_password_label', 'Current password')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('account_settings.current_password_label', 'Current password')}
          />
          <View style={styles.divider} />
          <PasswordField
            label={t('account_settings.new_password_label', 'New password')}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('account_settings.new_password_label', 'New password')}
          />
          <View style={styles.divider} />
          <PasswordField
            label={t('account_settings.confirm_password_label', 'Confirm new password')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('account_settings.confirm_password_placeholder', 'Re-type new password')}
            isLast
          />

          <TouchableOpacity style={styles.saveBtnInline} onPress={onChangePassword} disabled={changingPassword} activeOpacity={0.85}>
            {changingPassword ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>{t('account_settings.change_password', 'Change password')}</Text>
            )}
          </TouchableOpacity>
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
    // A soft shadow reads as a floating surface; a flat 1px border reads
    // as a divider between two panels of the same flat page - the header
    // is a distinct layer above the scroll content, not a sibling row.
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

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Password's badge is solid ink, not a second brand color - the rest of
  // the screen keeps a single emerald accent throughout (design-taste
  // "color consistency" rule), so "this section is different" is signaled
  // by weight/darkness, not by introducing red as a stand-in for
  // "security" when red actually reads as "error" to a user.
  sectionIconWrapDark: { backgroundColor: INK },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  cardSecurity: { backgroundColor: '#FAFAFA', borderColor: '#E2E3E6' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: INK, flex: 1, paddingRight: 12 },

  label: { fontSize: 12.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F1F3F2',
  },
  chipActive: { backgroundColor: BRAND.emeraldDeep },
  chipCheck: { marginRight: 5 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },

  fieldRow: { marginBottom: 14 },
  fieldRowLast: { marginBottom: 0 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: INK, marginBottom: 8 },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  fieldInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: INK },

  saveBtn: { backgroundColor: BRAND.emeraldDeep, borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  saveBtnInline: { marginTop: 16, backgroundColor: BRAND.emeraldDeep, borderRadius: 999, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
