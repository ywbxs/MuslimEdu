import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CircleDollarSign, Shield } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import WizardShell, { WizardStep } from '../../components/glass/WizardShell';
import { fetchFeeTypes, createFeeType, updateFeeType } from '../../services/enrollmentWorkflowService';

/**
 * Create + edit, as a big-card step wizard (WizardShell) - same spatial-UI
 * language as EnrollmentStageFormScreen. No admin_enrollment_fee_types_get
 * - editing re-uses the _list endpoint and finds the row client-side.
 */

function IconCoin({ color }: { color: string }) {
  return <CircleDollarSign size={26} color={color} strokeWidth={2} />;
}
function IconShield({ color }: { color: string }) {
  return <Shield size={26} color={color} strokeWidth={2} />;
}

function SummaryRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAcademicGlassTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.textPrimary, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
    </View>
  );
}

export default function EnrollmentFeeTypeFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const feeTypeId: number | undefined = route.params?.feeTypeId;
  const isEditing = !!feeTypeId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

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
        if (!feeType) return;
        setName(feeType.name);
        setCode(feeType.code ?? '');
        setAmount(feeType.amount != null ? String(feeType.amount) : '');
        setIsRequired(feeType.is_required);
        setIsActive(feeType.is_active);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, feeTypeId, token]);

  const parsedAmount = amount.trim() ? Number(amount.trim()) : null;
  const amountValid = !amount.trim() || (!Number.isNaN(parsedAmount) && (parsedAmount ?? 0) >= 0);

  const onSave = async () => {
    if (!token || !name.trim() || !amountValid) return;
    setSubmitting(true);
    try {
      const input = { name: name.trim(), code: code.trim() || null, amount: parsedAmount, is_required: isRequired, is_active: isActive };
      if (isEditing) {
        await updateFeeType(token, feeTypeId!, input);
      } else {
        await createFeeType(token, input);
      }
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: 'info',
      title: t('enrollment_fee_type_form.step_info_title', 'Fee Info'),
      subtitle: t('enrollment_fee_type_form.step_info_subtitle', 'What is this fee called, and how much is it?'),
      icon: <IconCoin color={theme.accent} />,
      isValid: name.trim().length > 0 && amountValid,
      content: (
        <>
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
          {!amountValid ? <Text style={styles.errorText}>{t('enrollment_fee_type_form.amount_invalid', 'Amount must be a valid, non-negative number.')}</Text> : null}
        </>
      ),
    },
    {
      id: 'rules',
      title: t('enrollment_fee_type_form.step_rules_title', 'Rules & Review'),
      subtitle: t('enrollment_fee_type_form.step_rules_subtitle', 'Does this fee block enrollment completion until paid?'),
      icon: <IconShield color={theme.accent} />,
      isValid: name.trim().length > 0,
      content: (
        <>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('enrollment_fee_type_form.required', 'Required')}</Text>
              <Text style={styles.switchHelp}>{t('enrollment_fee_type_form.required_help', 'Must show Paid or Waived before a student can be officially enrolled.')}</Text>
            </View>
            <Switch value={isRequired} onValueChange={setIsRequired} trackColor={{ true: theme.accent }} />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('enrollment_fee_type_form.active', 'Active')}</Text>
              <Text style={styles.switchHelp}>{t('enrollment_fee_type_form.active_help', 'Inactive fee types are hidden from new payment checklists but kept for history.')}</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.accent }} />
          </View>

          <View style={{ marginTop: 20 }}>
            <SummaryRow label={t('enrollment_fee_type_form.name_label', 'Fee Name')} value={name.trim() || '—'} theme={theme} />
            <SummaryRow label={t('enrollment_fee_type_form.amount_label', 'Suggested Amount')} value={amount.trim() || t('common.none', 'None')} theme={theme} />
            <SummaryRow label={t('enrollment_fee_type_form.required', 'Required')} value={isRequired ? t('common.yes', 'Yes') : t('common.no', 'No')} theme={theme} />
            <SummaryRow label={t('enrollment_fee_type_form.active', 'Active')} value={isActive ? t('common.yes', 'Yes') : t('common.no', 'No')} theme={theme} />
          </View>
        </>
      ),
    },
  ];

  if (loading) return null;

  return (
    <WizardShell
      title={isEditing ? t('enrollment_fee_type_form.edit_title', 'Edit Fee Type') : t('enrollment_fee_type_form.add_title', 'Add Fee Type')}
      steps={steps}
      onCancel={() => navigation.goBack()}
      onFinish={onSave}
      finishLabel={isEditing ? t('enrollment_fee_type_form.save_changes', 'Save Changes') : t('enrollment_fee_type_form.add_title', 'Add Fee Type')}
      saving={submitting}
      theme={theme}
    />
  );
}

const makeStyles = (theme: ReturnType<typeof useAcademicGlassTheme>) =>
  StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 14 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.background,
      color: theme.textPrimary,
    },
    errorText: { color: theme.danger, fontSize: 12, marginTop: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingVertical: 4 },
    switchLabel: { fontSize: 14.5, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
    switchHelp: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },
  });
