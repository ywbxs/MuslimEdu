import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  GradeScale,
  BandInput,
  fetchGradeScales,
  createGradeScale,
  createGradeScaleNewVersion,
} from '../../services/adminAcademicCatalogService';

/**
 * Spec §4.10 Grade Scale Builder, scoped to one grading system.
 *
 * The backend never edits bands in place - "Save" either creates version 1
 * (no scale exists yet) or a new version of the current scale (bands
 * changed on an existing one). That preserves history once a real grade
 * gets recorded against a specific grade_scale_id, per the controller's own
 * comment. This screen mirrors that: editing an existing scale's bands and
 * saving always calls admin_grade_scales_new_version, never an in-place
 * update.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

let bandKeySeq = 0;
function nextBandKey() {
  bandKeySeq += 1;
  return `band-${bandKeySeq}`;
}

interface EditableBand extends BandInput {
  key: string;
}

function blankBand(): EditableBand {
  return {
    key: nextBandKey(),
    min_score: 0,
    max_score: 0,
    label: '',
    gpa_value: null,
    is_passing: true,
  };
}

export default function GradeScaleBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const gradingSystemId: number = route.params?.gradingSystemId;
  const gradingSystemName: string = route.params?.gradingSystemName ?? t('grade_scale_builder.grading_system_fallback', 'Grading System');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scaleName, setScaleName] = useState('');
  const [currentScale, setCurrentScale] = useState<GradeScale | null>(null);
  const [bands, setBands] = useState<EditableBand[]>([blankBand()]);

  const load = useCallback(async () => {
    if (!token || !gradingSystemId) return;
    try {
      setError(null);
      const scales = await fetchGradeScales(token, gradingSystemId);
      const current = scales.find((s) => s.is_current) ?? scales[0] ?? null;
      setCurrentScale(current);
      if (current) {
        setScaleName(current.name);
        setBands(
          (current.bands ?? []).map((b) => ({
            key: nextBandKey(),
            min_score: b.min_score,
            max_score: b.max_score,
            label: b.label,
            gpa_value: b.gpa_value ?? null,
            remarks: b.remarks ?? null,
            is_passing: b.is_passing ?? true,
            honors_eligible: b.honors_eligible ?? false,
            promotion_eligible: b.promotion_eligible ?? true,
          }))
        );
      } else {
        setScaleName(t('grade_scale_builder.default_scale_name', '{name} Scale').replace('{name}', gradingSystemName));
        setBands([blankBand()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('grade_scale_builder.load_error', 'Failed to load grade scale.'));
    } finally {
      setLoading(false);
    }
  }, [token, gradingSystemId, gradingSystemName, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateBand = (key: string, patch: Partial<EditableBand>) => {
    setBands((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };

  const removeBand = (key: string) => {
    setBands((prev) => (prev.length > 1 ? prev.filter((b) => b.key !== key) : prev));
  };

  const addBand = () => setBands((prev) => [...prev, blankBand()]);

  const validate = (): string | null => {
    if (!scaleName.trim()) return t('grade_scale_builder.name_required', 'Scale name is required.');
    if (bands.length === 0) return t('grade_scale_builder.need_one_band', 'Add at least one band.');
    for (const b of bands) {
      if (!b.label.trim()) return t('grade_scale_builder.label_required', 'Every band needs a label (e.g. "A", "Pass").');
      if (Number.isNaN(b.min_score) || Number.isNaN(b.max_score)) return t('grade_scale_builder.scores_must_be_numbers', 'Band scores must be numbers.');
      if (b.max_score < b.min_score) {
        return t('grade_scale_builder.max_below_min', '"{label}" has a max score below its min score.').replace('{label}', b.label);
      }
    }
    return null;
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('grade_scale_builder.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    const validationError = validate();
    if (validationError) {
      Alert.alert(t('grade_scale_builder.check_bands', 'Check the bands'), validationError);
      return;
    }

    const payload: BandInput[] = bands.map((b) => ({
      min_score: b.min_score,
      max_score: b.max_score,
      label: b.label.trim(),
      gpa_value: b.gpa_value,
      remarks: b.remarks,
      is_passing: b.is_passing,
      honors_eligible: b.honors_eligible,
      promotion_eligible: b.promotion_eligible,
    }));

    setSaving(true);
    try {
      if (currentScale) {
        await createGradeScaleNewVersion(token, currentScale.id, payload, scaleName.trim());
        Alert.alert(t('grade_scale_builder.saved', 'Saved'), t('grade_scale_builder.version_created', 'Version {version} of this scale was created.').replace('{version}', String(currentScale.version + 1)));
      } else {
        await createGradeScale(token, gradingSystemId, scaleName.trim(), payload);
      }
      load();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('grade_scale_builder.save_error', 'Could not save the grade scale.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]} numberOfLines={1}>
            {gradingSystemName}
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]} numberOfLines={1}>
          {gradingSystemName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {currentScale ? (
          <View style={styles.versionBanner}>
            <Text style={styles.versionBannerText}>
              {t(
                'grade_scale_builder.version_banner',
                'Editing bands creates version {next}. Version {current} stays intact for any grade already recorded against it.',
              )
                .replace('{next}', String(currentScale.version + 1))
                .replace('{current}', String(currentScale.version))}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>{t('grade_scale_builder.scale_name', 'Scale Name')}</Text>
        <TextInput
          style={styles.input}
          value={scaleName}
          onChangeText={setScaleName}
          placeholder={t('grade_scale_builder.scale_name_placeholder', 'e.g. Standard Percentage Scale')}
          placeholderTextColor={theme.textMuted}
        />

        <View style={styles.bandsHeaderRow}>
          <Text style={styles.label}>{t('grade_scale_builder.bands', 'Bands')}</Text>
          <TouchableOpacity onPress={addBand}>
            <Text style={styles.addBandText}>{t('grade_scale_builder.add_band', '+ Add band')}</Text>
          </TouchableOpacity>
        </View>

        {bands.map((band, index) => (
          <View key={band.key} style={styles.bandCard}>
            <View style={styles.bandRowTop}>
              <View style={styles.bandScoreField}>
                <Text style={styles.fieldLabel}>{t('grade_scale_builder.min', 'Min')}</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="numeric"
                  value={String(band.min_score)}
                  onChangeText={(v) => updateBand(band.key, { min_score: Number(v) || 0 })}
                />
              </View>
              <View style={styles.bandScoreField}>
                <Text style={styles.fieldLabel}>{t('grade_scale_builder.max', 'Max')}</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="numeric"
                  value={String(band.max_score)}
                  onChangeText={(v) => updateBand(band.key, { max_score: Number(v) || 0 })}
                />
              </View>
              <View style={styles.bandLabelField}>
                <Text style={styles.fieldLabel}>{t('grade_scale_builder.label', 'Label')}</Text>
                <TextInput
                  style={styles.smallInput}
                  value={band.label}
                  onChangeText={(v) => updateBand(band.key, { label: v })}
                  placeholder="A / Pass / 4.0"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.bandGpaField}>
                <Text style={styles.fieldLabel}>{t('grade_scale_builder.gpa', 'GPA')}</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="numeric"
                  value={band.gpa_value != null ? String(band.gpa_value) : ''}
                  onChangeText={(v) => updateBand(band.key, { gpa_value: v ? Number(v) : null })}
                  placeholder="-"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.bandRowBottom}>
              <TouchableOpacity
                style={styles.pill}
                onPress={() => updateBand(band.key, { is_passing: !band.is_passing })}
              >
                <Switch
                  value={!!band.is_passing}
                  onValueChange={(v) => updateBand(band.key, { is_passing: v })}
                  trackColor={{ true: theme.accent }}
                />
                <Text style={styles.pillText}>{t('grade_scale_builder.passing', 'Passing')}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => removeBand(band.key)} disabled={bands.length <= 1}>
                <Text style={[styles.removeText, bands.length <= 1 && styles.removeTextDisabled]}>
                  {t('grade_scale_builder.remove', 'Remove')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} disabled={saving} onPress={onSave}>
          {saving ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>
              {currentScale
                ? t('grade_scale_builder.save_as_version', 'Save as Version {version}').replace('{version}', String(currentScale.version + 1))
                : t('grade_scale_builder.create', 'Create Grade Scale')}
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

    content: { padding: 20, paddingBottom: 48 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },

    versionBanner: {
      backgroundColor: theme.accentSoft,
      borderRadius: RADIUS.md ?? 10,
      padding: 12,
      marginBottom: 8,
    },
    versionBannerText: { color: theme.accentSoftText, fontSize: 12.5, lineHeight: 17 },

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

    bandsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addBandText: { color: theme.accent, fontWeight: '700', fontSize: 13, marginTop: 16 },

    bandCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.md ?? 10,
      padding: 12,
      marginTop: 10,
    },
    bandRowTop: { flexDirection: 'row', gap: 8 },
    bandScoreField: { width: 56 },
    bandLabelField: { flex: 1 },
    bandGpaField: { width: 56 },
    fieldLabel: { fontSize: 10.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
    smallInput: {
      height: 40,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 8,
      fontSize: 13.5,
      backgroundColor: theme.background === 'transparent' ? '#FFFFFF' : theme.background,
      color: theme.textPrimary,
    },

    bandRowBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pillText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    removeText: { color: theme.danger, fontSize: 12.5, fontWeight: '600' },
    removeTextDisabled: { opacity: 0.4 },

    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: theme.onAccent, fontSize: 15.5, fontWeight: '700' },
  });
