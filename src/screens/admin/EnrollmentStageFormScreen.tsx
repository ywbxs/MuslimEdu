import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FileText, Shield, Tag } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import WizardShell, { WizardStep } from '../../components/glass/WizardShell';
import {
  fetchEnrollmentStages,
  createEnrollmentStage,
  updateEnrollmentStage,
  StageApproverRole,
} from '../../services/enrollmentWorkflowService';

/**
 * Create + edit, redesigned as a big-card step wizard (WizardShell) instead
 * of one long scrolling form - same spatial-UI language as
 * AdminClassScheduleScreen's Add Schedule wizard. There's no
 * admin_enrollment_stages_get - editing re-uses the _list endpoint and
 * finds the row by id client-side (the list is always small - a school's
 * enrollment pipeline, not a paginated table).
 */

function IconTag({ color }: { color: string }) {
  return <Tag size={26} color={color} strokeWidth={2} />;
}
function IconShield({ color }: { color: string }) {
  return <Shield size={26} color={color} strokeWidth={2} />;
}
function IconDoc({ color }: { color: string }) {
  return <FileText size={26} color={color} strokeWidth={2} />;
}

function SummaryRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAcademicGlassTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.textPrimary, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
    </View>
  );
}

export default function EnrollmentStageFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const stageId: number | undefined = route.params?.stageId;
  const isEditing = !!stageId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [studentInstructions, setStudentInstructions] = useState('');
  const [isTerminal, setIsTerminal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [approverRole, setApproverRole] = useState<StageApproverRole>(null);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const stages = await fetchEnrollmentStages(token);
        const stage = stages.find((s) => s.id === stageId);
        if (!stage) return;
        setName(stage.name);
        setCode(stage.code ?? '');
        setStudentInstructions(stage.student_instructions ?? '');
        setIsTerminal(stage.is_terminal);
        setIsActive(stage.status === 'active');
        setApproverRole(stage.approver_role ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, stageId, token]);

  const onSave = async () => {
    if (!token || !name.trim()) return;
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        code: code.trim() || null,
        student_instructions: studentInstructions.trim() || null,
        is_terminal: isTerminal,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
        approver_role: approverRole,
      };
      if (isEditing) {
        await updateEnrollmentStage(token, stageId!, input);
      } else {
        await createEnrollmentStage(token, input);
      }
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const approverOptions: { value: StageApproverRole; label: string }[] = [
    { value: null, label: t('enrollment_stage_form.approver_admin', 'Admin only') },
    { value: 'accountant', label: t('enrollment_stage_form.approver_cashier', 'Cashier') },
    { value: 'registrar', label: t('enrollment_stage_form.approver_registrar', 'Registrar') },
  ];

  const steps: WizardStep[] = [
    {
      id: 'basics',
      title: t('enrollment_stage_form.step_basics_title', 'Stage Basics'),
      subtitle: t('enrollment_stage_form.step_basics_subtitle', 'What is this stage called?'),
      icon: <IconTag color={theme.accent} />,
      isValid: name.trim().length > 0,
      content: (
        <>
          <Text style={styles.label}>{t('enrollment_stage_form.name_label', 'Stage Name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('enrollment_stage_form.name_placeholder', 'e.g. Admission, Cashier, Registrar')}
            placeholderTextColor={theme.textMuted}
          />
          <Text style={styles.label}>{t('enrollment_stage_form.code_label', 'Code (optional)')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={t('enrollment_stage_form.code_placeholder', 'e.g. ADMISSION')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
          />
        </>
      ),
    },
    {
      id: 'rules',
      title: t('enrollment_stage_form.step_rules_title', 'Approver & Rules'),
      subtitle: t('enrollment_stage_form.step_rules_subtitle', 'Who approves this stage, and what does reaching it mean?'),
      icon: <IconShield color={theme.accent} />,
      isValid: true,
      content: (
        <>
          <Text style={styles.label}>{t('enrollment_stage_form.approver_label', 'Who approves this stage?')}</Text>
          <View style={styles.chipRow}>
            {approverOptions.map((option) => {
              const selected = approverRole === option.value;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.chip, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setApproverRole(option.value)}
                >
                  <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('enrollment_stage_form.final_stage', 'Final stage')}</Text>
              <Text style={styles.switchHelp}>{t('enrollment_stage_form.final_stage_help', "Reaching this stage marks the student's enrollment as complete.")}</Text>
            </View>
            <Switch value={isTerminal} onValueChange={setIsTerminal} trackColor={{ true: theme.accent }} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('enrollment_stage_form.active', 'Active')}</Text>
              <Text style={styles.switchHelp}>{t('enrollment_stage_form.active_help', 'Inactive stages are hidden from new students but kept for history.')}</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.accent }} />
          </View>
        </>
      ),
    },
    {
      id: 'review',
      title: t('enrollment_stage_form.step_review_title', 'Instructions & Review'),
      subtitle: t('enrollment_stage_form.step_review_subtitle', 'What should the student do here, and does everything look right?'),
      icon: <IconDoc color={theme.accent} />,
      isValid: name.trim().length > 0,
      content: (
        <>
          <Text style={styles.label}>{t('enrollment_stage_form.instructions_label', 'What should the student do at this stage? (optional)')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={studentInstructions}
            onChangeText={setStudentInstructions}
            placeholder={t('enrollment_stage_form.instructions_placeholder', 'e.g. "Pay the enrollment fee at the Cashier\'s office"')}
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />
          <View style={{ marginTop: 20 }}>
            <SummaryRow label={t('enrollment_stage_form.name_label', 'Stage Name')} value={name.trim() || '—'} theme={theme} />
            <SummaryRow label={t('enrollment_stage_form.approver_label', 'Who approves this stage?')} value={approverOptions.find((o) => o.value === approverRole)?.label ?? '—'} theme={theme} />
            <SummaryRow label={t('enrollment_stage_form.final_stage', 'Final stage')} value={isTerminal ? t('common.yes', 'Yes') : t('common.no', 'No')} theme={theme} />
            <SummaryRow label={t('enrollment_stage_form.active', 'Active')} value={isActive ? t('common.yes', 'Yes') : t('common.no', 'No')} theme={theme} />
          </View>
        </>
      ),
    },
  ];

  if (loading) return null;

  return (
    <WizardShell
      title={isEditing ? t('enrollment_stage_form.edit_title', 'Edit Stage') : t('enrollment_stage_form.add_title', 'Add Stage')}
      steps={steps}
      onCancel={() => navigation.goBack()}
      onFinish={onSave}
      finishLabel={isEditing ? t('enrollment_stage_form.save_changes', 'Save Changes') : t('enrollment_stage_form.add_title', 'Add Stage')}
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
    textArea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingVertical: 4 },
    switchLabel: { fontSize: 14.5, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
    switchHelp: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },
  });
