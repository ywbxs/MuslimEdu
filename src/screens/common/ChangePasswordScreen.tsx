import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { INK, SUBTLE } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';
import { updatePassword } from '../../services/studentPortalService';

/**
 * Split out of AccountSettingsScreen so "Security" is its own row/wizard
 * like every other setting, instead of three password fields living
 * inline at the bottom of the settings list regardless of whether the
 * user ever wanted to touch them.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const EMERALD_SOFT = '#E5F8F5';

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconEye({ color, off }: { color: string; off: boolean }) {
  return off ? <EyeOff size={18} color={color} strokeWidth={2} /> : <Eye size={18} color={color} strokeWidth={2} />;
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

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

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
    setChanging(true);
    try {
      await updatePassword(token, currentPassword, newPassword);
      Alert.alert(
        t('account_settings.password_updated_title', 'Password updated'),
        t('account_settings.password_updated_message', 'Your password has been changed.'),
      );
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(
        t('account_settings.password_error_title', 'Could not change password'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setChanging(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <IconChevronLeft color={BRAND.emeraldDeep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('account_settings.security_section', 'Security')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            {t('account_settings.change_password_hint', "Choose a new password you haven't used before.")}
          </Text>
          <View style={styles.card}>
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
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={onChangePassword} disabled={changing} activeOpacity={0.85}>
            {changing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>{t('account_settings.change_password', 'Change password')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  content: { padding: 16 },
  hint: { fontSize: 13, color: SUBTLE, lineHeight: 18, marginBottom: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },

  fieldRow: { marginBottom: 0 },
  fieldRowLast: {},
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

  saveBtn: { marginTop: 20, backgroundColor: BRAND.emeraldDeep, borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
