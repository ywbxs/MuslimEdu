import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
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
  DeviceSession,
  TwoFactorStatus,
  confirmTwoFactorSetup,
  disableTwoFactor,
  fetchDeviceSessions,
  fetchTwoFactorStatus,
  revokeDeviceSession,
  startTwoFactorSetup,
} from '../../services/securityService';

/**
 * M4 teacher/staff two-factor authentication + device sessions.
 *
 * No QR-code image is rendered here — that would need a new dependency
 * (e.g. react-native-qrcode-svg), which this app deliberately avoids
 * adding without an explicit ask (same discipline as the document-picker
 * decision elsewhere in this codebase). The secret and otpauth:// URL are
 * both shown as plain text instead; every authenticator app supports
 * typing a secret in manually, so this loses no real functionality.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';

export default function SecuritySettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [startingSetup, setStartingSetup] = useState(false);

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [disableVisible, setDisableVisible] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([fetchTwoFactorStatus(token), fetchDeviceSessions(token)]);
      setStatus(s);
      setSessions(d);
    } catch (e: any) {
      setError(e?.message ?? t('security_settings.load_error', 'Could not load security settings.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onStartSetup = async () => {
    if (!token) return;
    setStartingSetup(true);
    try {
      const setup = await startTwoFactorSetup(token);
      setSetupSecret(setup.secret);
      setSetupUrl(setup.otpauth_url);
      setConfirmCode('');
    } catch (e: any) {
      Alert.alert(t('security_settings.start_error', 'Could not start setup'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setStartingSetup(false);
    }
  };

  const onConfirm = async () => {
    if (!token || confirmCode.trim().length === 0) return;
    setConfirming(true);
    try {
      const result = await confirmTwoFactorSetup(token, confirmCode.trim());
      setRecoveryCodes(result.recovery_codes);
      setSetupSecret(null);
      setSetupUrl(null);
      setConfirmCode('');
      await load();
    } catch (e: any) {
      Alert.alert(t('security_settings.confirm_error', 'Could not confirm'), e?.message ?? t('security_settings.check_code', 'Check the code and try again.'));
    } finally {
      setConfirming(false);
    }
  };

  const onDisable = async () => {
    if (!token || disablePassword.length === 0) return;
    setDisabling(true);
    try {
      await disableTwoFactor(token, disablePassword);
      setDisableVisible(false);
      setDisablePassword('');
      await load();
    } catch (e: any) {
      Alert.alert(t('security_settings.disable_error', 'Could not disable'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setDisabling(false);
    }
  };

  const confirmRevoke = (s: DeviceSession) => {
    Alert.alert(
      s.is_current ? t('security_settings.sign_out_title', 'Sign out this device?') : t('security_settings.revoke_title', 'Revoke this session?'),
      s.is_current
        ? t('security_settings.sign_out_message', 'This is the device you are using right now. You will be signed out immediately.')
        : t('security_settings.revoke_message', '"{device}" will need to sign in again.').replace('{device}', s.device_name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: s.is_current ? t('security_settings.sign_out', 'Sign out') : t('security_settings.revoke', 'Revoke'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await revokeDeviceSession(token, s.id);
              setSessions((prev) => prev.filter((x) => x.id !== s.id));
            } catch (e: any) {
              Alert.alert(t('security_settings.revoke_error', 'Could not revoke'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('security_settings.loading', 'Loading security settings…')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('security_settings.error_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('security_settings.title', 'Security')}</Text>
          <Text style={styles.headerSub}>{t('security_settings.subtitle', 'Two-factor authentication and device sessions')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>{t('security_settings.two_factor', 'Two-factor authentication')}</Text>

        {recoveryCodes ? (
          <View style={styles.card}>
            <Text style={styles.rowTitle}>{t('security_settings.save_codes_title', 'Save these recovery codes')}</Text>
            <Text style={styles.rowSub}>
              {t('security_settings.save_codes_desc', 'Each code works once, if you ever lose access to your authenticator app. They will not be shown again.')}
            </Text>
            {recoveryCodes.map((code) => (
              <Text key={code} style={styles.recoveryCode}>
                {code}
              </Text>
            ))}
            <TouchableOpacity style={styles.doneBtn} onPress={() => setRecoveryCodes(null)}>
              <Text style={styles.doneBtnText}>{t('security_settings.saved_these', "I've saved these")}</Text>
            </TouchableOpacity>
          </View>
        ) : status?.enabled ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.flexCol}>
                <Text style={styles.rowTitle}>{t('security_settings.enabled', 'Enabled')}</Text>
                <Text style={styles.rowSub}>{t('security_settings.enabled_desc', 'Your account requires a code from your authenticator app at login.')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.dangerLinkBtn} onPress={() => setDisableVisible(true)}>
              <Text style={styles.dangerLinkText}>{t('security_settings.disable_two_factor', 'Disable two-factor authentication')}</Text>
            </TouchableOpacity>
          </View>
        ) : setupSecret ? (
          <View style={styles.card}>
            <Text style={styles.rowTitle}>{t('security_settings.add_to_app_title', 'Add this account to your authenticator app')}</Text>
            <Text style={styles.rowSub}>
              {t('security_settings.add_to_app_desc', 'Enter this key manually in Google Authenticator, Authy, 1Password, or a similar app:')}
            </Text>
            <Text selectable style={styles.secretText}>
              {setupSecret}
            </Text>
            <Text style={styles.label}>{t('security_settings.enter_code_label', 'Then enter the 6-digit code it shows')}</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor={SUBTLE}
              keyboardType="number-pad"
              value={confirmCode}
              onChangeText={setConfirmCode}
              maxLength={6}
            />
            <TouchableOpacity style={styles.saveBtnInline} onPress={onConfirm} disabled={confirming}>
              {confirming ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{t('security_settings.confirm_enable', 'Confirm & enable')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.rowTitle}>{t('security_settings.not_enabled', 'Not enabled')}</Text>
            <Text style={styles.rowSub}>
              {t('security_settings.not_enabled_desc', 'Add an extra step at login using an authenticator app on your phone.')}
            </Text>
            <TouchableOpacity style={styles.saveBtnInline} onPress={onStartSetup} disabled={startingSetup}>
              {startingSetup ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('security_settings.set_up_two_factor', 'Set up two-factor authentication')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('security_settings.signed_in_devices', 'Signed-in devices')}</Text>
        {sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.rowSub}>{t('security_settings.no_active_sessions', 'No active sessions.')}</Text>
          </View>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>
                    {s.device_name}
                    {s.is_current ? ` ${t('security_settings.this_device', '(this device)')}` : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    {s.last_used_at ? `${t('security_settings.last_used', 'Last used')} ${new Date(s.last_used_at).toLocaleString()}` : t('security_settings.never_used', 'Never used')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmRevoke(s)}>
                  <Text style={styles.dangerLinkText}>{s.is_current ? t('security_settings.sign_out', 'Sign out') : t('security_settings.revoke', 'Revoke')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={disableVisible} animationType="slide" transparent onRequestClose={() => setDisableVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('security_settings.disable_two_factor', 'Disable two-factor authentication')}</Text>
            <Text style={styles.label}>{t('security_settings.confirm_password', 'Confirm your password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('security_settings.password_placeholder', 'Password')}
              placeholderTextColor={SUBTLE}
              secureTextEntry
              value={disablePassword}
              onChangeText={setDisablePassword}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setDisableVisible(false);
                  setDisablePassword('');
                }}
                disabled={disabling}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDanger} onPress={onDisable} disabled={disabling}>
                {disabling ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalDangerText}>{t('security_settings.disable', 'Disable')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 18 },

  secretText: { fontSize: 15, fontWeight: '700', color: INK, letterSpacing: 1, marginTop: 10, marginBottom: 4, backgroundColor: '#F1F3F2', padding: 12, borderRadius: 10 },
  recoveryCode: { fontSize: 14, fontWeight: '700', color: INK, letterSpacing: 1, marginTop: 6 },

  label: { fontSize: 12.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#FAFBFA', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },

  saveBtnInline: { marginTop: 14, backgroundColor: EMERALD, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  doneBtn: { marginTop: 16, backgroundColor: EMERALD, borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  dangerLinkBtn: { marginTop: 14 },
  dangerLinkText: { fontSize: 13, fontWeight: '700', color: DANGER },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 6 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalDanger: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: DANGER },
  modalDangerText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
