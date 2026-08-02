import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { fetchFeeTypes, createFeeType, updateFeeType } from '../../services/enrollmentWorkflowService';

/**
 * Create + edit in one screen, matching EnrollmentStageFormScreen's pattern.
 * No admin_enrollment_fee_types_get - editing re-uses the _list endpoint
 * and finds the row client-side (a school's fee list is always small).
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function EnrollmentFeeTypeFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const feeTypeId: number | undefined = route.params?.feeTypeId;
  const isEditing = !!feeTypeId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const feeTypes = await fetchFeeTypes(token);
        const feeType = feeTypes.find((f) => f.id === feeTypeId);
        if (!feeType) {
          setError(t('enrollment_fee_type_form.not_found', 'Fee type not found.'));
          return;
        }
        setName(feeType.name);
        setCode(feeType.code ?? '');
        setAmount(feeType.amount != null ? String(feeType.amount) : '');
        setIsRequired(feeType.is_required);
        setIsActive(feeType.is_active);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('enrollment_fee_type_form.load_error', 'Failed to load fee type.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, feeTypeId, token, t]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('enrollment_fee_type_form.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('enrollment_fee_type_form.name_required', 'Fee name is required.'));
      return;
    }
    const parsedAmount = amount.trim() ? Number(amount.trim()) : null;
    if (amount.trim() && (Number.isNaN(parsedAmount) || (parsedAmount ?? 0) < 0)) {
      Alert.alert(t('common.error', 'Error'), t('enrollment_fee_type_form.amount_invalid', 'Amount must be a valid, non-negative number.'));
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        code: code.trim() || null,
        amount: parsedAmount,
        is_required: isRequired,
        is_active: isActive,
      };
      if (isEditing) {
        await updateFeeType(token, feeTypeId!, input);
      } else {
        await createFeeType(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_fee_type_form.save_error', 'Could not save the fee type.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {isEditing ? t('enrollment_fee_type_form.edit_title', 'Edit Fee Type') : t('enrollment_fee_type_form.add_title', 'Add Fee Type')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing ? t('enrollment_fee_type_form.edit_title', 'Edit Fee Type') : t('enrollment_fee_type_form.add_title', 'Add Fee Type')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>{t('enrollment_fee_type_form.name_label', 'Fee Name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('enrollment_fee_type_form.name_placeholder', 'e.g. Tuition Fee, Miscellaneous, Service Fee')}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('enrollment_fee_type_form.code_label', 'Code (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t('enrollment_fee_type_form.code_placeholder', 'e.g. TUITION')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>{t('enrollment_fee_type_form.amount_label', 'Suggested Amount (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder={t('enrollment_fee_type_form.amount_placeholder', 'e.g. 5000')}
          placeholderTextColor={theme.textMuted}
          keyboardType="decimal-pad"
        />
        <Text style={styles.switchHelp}>
          {t('enrollment_fee_type_form.amount_help', "Shown to the cashier/registrar as a reference - the actual amount paid is recorded per student.")}
        </Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('enrollment_fee_type_form.required', 'Required')}</Text>
            <Text style={styles.switchHelp}>
              {t('enrollment_fee_type_form.required_help', 'Must show Paid or Waived before a student can be officially enrolled.')}
            </Text>
          </View>
          <Switch value={isRequired} onValueChange={setIsRequired} trackColor={{ true: theme.accent }} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('enrollment_fee_type_form.active', 'Active')}</Text>
            <Text style={styles.switchHelp}>
              {t('enrollment_fee_type_form.active_help', 'Inactive fee types are hidden from new payment checklists but kept for history.')}
            </Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.accent }} />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSave}
        >
          {submitting ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? t('enrollment_fee_type_form.save_changes', 'Save Changes') : t('enrollment_fee_type_form.add_title', 'Add Fee Type')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
    },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
      paddingVertical: 4,
    },
    switchLabel: { fontSize: 14.5, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
    switchHelp: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },

    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: theme.onAccent, fontSize: 15.5, fontWeight: '700' },
  });
