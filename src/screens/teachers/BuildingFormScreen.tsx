import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Building2, FileText } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import WizardShell, { WizardStep } from '../../components/glass/WizardShell';
import { listBuildings, saveBuilding, updateBuilding } from '../../services/academicFacilitiesService';

function IconBuilding({ color }: { color: string }) {
  return <Building2 size={26} color={color} strokeWidth={1.8} />;
}
function IconDoc({ color }: { color: string }) {
  return <FileText size={26} color={color} strokeWidth={2} />;
}

function SummaryRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAcademicGlassTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.textPrimary, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function BuildingFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const buildingId: number | undefined = route.params?.buildingId;
  const isEditing = !!buildingId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [floorCount, setFloorCount] = useState('1');

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const buildings = await listBuildings(token);
        const b = buildings.find((x) => x.id === buildingId);
        if (!b) return;
        setName(b.name);
        setCode(b.code);
        setFloorCount(String(b.floor_count));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, buildingId, token]);

  const floorCountNum = Math.max(1, Number(floorCount) || 1);

  const onSave = async () => {
    if (!token || !name.trim() || !code.trim()) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateBuilding(token, buildingId!, { name: name.trim(), code: code.trim().toUpperCase(), floor_count: floorCountNum });
      } else {
        await saveBuilding(token, { name: name.trim(), code: code.trim().toUpperCase(), floor_count: floorCountNum });
      }
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: 'info',
      title: t('building_form.step_info_title', 'Building Info'),
      subtitle: t('building_form.step_info_subtitle', 'What is this building called?'),
      icon: <IconBuilding color={theme.accent} />,
      isValid: name.trim().length > 0 && code.trim().length > 0,
      content: (
        <>
          <Text style={styles.label}>{t('building_form.name_label', 'Building Name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('building_form.name_placeholder', 'e.g. Main Hall, Annex')}
            placeholderTextColor={theme.textMuted}
          />
          <Text style={styles.label}>{t('building_form.code_label', 'Code')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={t('building_form.code_placeholder', 'e.g. MH')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
          />
        </>
      ),
    },
    {
      id: 'review',
      title: t('building_form.step_review_title', 'Floors & Review'),
      subtitle: t('building_form.step_review_subtitle', 'How many floors does it have?'),
      icon: <IconDoc color={theme.accent} />,
      isValid: name.trim().length > 0 && code.trim().length > 0,
      content: (
        <>
          <Text style={styles.label}>{t('building_form.floors_label', 'Number of Floors')}</Text>
          <TextInput
            style={styles.input}
            value={floorCount}
            onChangeText={setFloorCount}
            keyboardType="number-pad"
            placeholderTextColor={theme.textMuted}
          />
          <View style={{ marginTop: 20 }}>
            <SummaryRow label={t('building_form.name_label', 'Building Name')} value={name.trim() || '—'} theme={theme} />
            <SummaryRow label={t('building_form.code_label', 'Code')} value={code.trim() || '—'} theme={theme} />
            <SummaryRow label={t('building_form.floors_label', 'Number of Floors')} value={String(floorCountNum)} theme={theme} />
          </View>
        </>
      ),
    },
  ];

  if (loading) return null;

  return (
    <WizardShell
      title={isEditing ? t('building_form.edit_title', 'Edit Building') : t('building_form.add_title', 'Add Building')}
      steps={steps}
      onCancel={() => navigation.goBack()}
      onFinish={onSave}
      finishLabel={isEditing ? t('building_form.save_changes', 'Save Changes') : t('building_form.add_title', 'Add Building')}
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
  });
