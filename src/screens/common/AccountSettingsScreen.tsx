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
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
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
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';

function labelize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, refresh: refreshLocale } = useLocale();

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
      await saveUserSettings(token, settings);
      await refreshLocale(settings.language);
      Alert.alert(t('account_settings.saved_title', 'Saved'), t('account_settings.saved_message', 'Your settings have been updated.'));
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('account_settings.loading', 'Loading your settings…')}</Text>
      </View>
    );
  }

  if (error || !settings || !options) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('common.load_failed_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error ?? t('account_settings.something_wrong', 'Something went wrong.')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ChipGroup = ({
    optionsList,
    value,
    onSelect,
  }: {
    optionsList: string[];
    value: string;
    onSelect: (v: string) => void;
  }) => (
    <View style={styles.chipRow}>
      {optionsList.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{labelize(opt)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('account_settings.header_title', 'Account Settings')}</Text>
          <Text style={styles.headerSub}>
            {t('account_settings.header_subtitle', 'Language, appearance, privacy and password')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>{t('account_settings.language_appearance_section', 'Language & appearance')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.language_label', 'Language')}</Text>
          <ChipGroup optionsList={options.languages} value={settings.language} onSelect={(v) => patch({ language: v })} />

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

        <Text style={styles.sectionTitle}>{t('account_settings.privacy_section', 'Privacy')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.profile_visibility_label', 'Profile visibility')}</Text>
          <ChipGroup
            optionsList={options.profile_visibility}
            value={settings.profile_visibility}
            onSelect={(v) => patch({ profile_visibility: v })}
          />

          <View style={styles.switchRow}>
            <Text style={styles.rowTitle}>{t('account_settings.show_email_label', 'Show email on my profile')}</Text>
            <Switch
              value={settings.show_email}
              onValueChange={(v) => patch({ show_email: v })}
              trackColor={{ false: '#D8DED9', true: EMERALD }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.rowTitle}>{t('account_settings.show_phone_label', 'Show phone on my profile')}</Text>
            <Switch
              value={settings.show_phone}
              onValueChange={(v) => patch({ show_phone: v })}
              trackColor={{ false: '#D8DED9', true: EMERALD }}
            />
          </View>

          <Text style={styles.label}>{t('account_settings.digest_emails_label', 'Digest emails')}</Text>
          <ChipGroup
            optionsList={options.digest_frequency}
            value={settings.digest_frequency}
            onSelect={(v) => patch({ digest_frequency: v })}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('account_settings.save_settings', 'Save settings')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('account_settings.password_section', 'Password')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('account_settings.current_password_label', 'Current password')}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder={t('account_settings.current_password_label', 'Current password')}
            placeholderTextColor={SUBTLE}
          />
          <Text style={styles.label}>{t('account_settings.new_password_label', 'New password')}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder={t('account_settings.new_password_label', 'New password')}
            placeholderTextColor={SUBTLE}
          />
          <Text style={styles.label}>{t('account_settings.confirm_password_label', 'Confirm new password')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder={t('account_settings.confirm_password_placeholder', 'Re-type new password')}
            placeholderTextColor={SUBTLE}
          />
          <TouchableOpacity style={styles.saveBtnInline} onPress={onChangePassword} disabled={changingPassword}>
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
  center: { flex: 1, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: EMERALD, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: INK, flex: 1, paddingRight: 12 },

  label: { fontSize: 12.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F1F3F2' },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },

  input: { marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },

  saveBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  saveBtnInline: { marginTop: 16, backgroundColor: EMERALD, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
