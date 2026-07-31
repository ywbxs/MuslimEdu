import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  AvailabilityResult,
  PreviewContext,
  PreviewResult,
  SegmentKey,
  SegmentMeta,
  StudentNumberDraft,
  checkStudentNumber,
  fetchStudentNumberConfig,
  previewStudentNumber,
  saveStudentNumberConfig,
  toDraft,
} from '../../services/studentNumberService';

/**
 * Spec 4.5 - Student Identification Configuration.
 *
 * Admins compose the school's student number here: prefix/suffix, campus and
 * department codes, academic year / admission year / academic type, running
 * number width, separator, start number, and yearly-reset vs continuous.
 *
 * Two rules this screen deliberately obeys:
 *
 *  1. It never builds a final number. Every sample on screen comes from
 *     /admin_student_number_preview, so what an admin sees is literally what
 *     the backend would produce - there is no second formatter in the app to
 *     drift out of sync (spec 4.5: "Generate the final unique student number
 *     during the approved admission flow, not in the mobile client").
 *
 *  2. Saving a new format never renumbers anyone. Already-issued numbers are
 *     immutable; the screen says so out loud once any have gone out.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const WARN_BG = 'rgba(186,140,26,0.10)';
const WARN_FG = '#7A5A00';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const SEPARATOR_KEYS: { value: string; key: string; fallback: string }[] = [
  { value: '', key: 'none', fallback: 'None' },
  { value: '-', key: 'dash', fallback: 'Dash  -' },
  { value: '/', key: 'slash', fallback: 'Slash  /' },
  { value: '.', key: 'dot', fallback: 'Dot  .' },
  { value: '_', key: 'under', fallback: 'Under  _' },
];

const DIGIT_MIN = 1;
const DIGIT_MAX = 10;
const PREVIEW_DEBOUNCE_MS = 450;

export default function StudentNumberConfigScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<StudentNumberDraft | null>(null);
  const [segments, setSegments] = useState<SegmentMeta[]>([]);
  const [context, setContext] = useState<PreviewContext | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [issuedCount, setIssuedCount] = useState(0);

  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [lookup, setLookup] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<AvailabilityResult | null>(null);

  // Guards the debounced preview against firing for the very first render and
  // against landing after the screen is gone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // --- Load -------------------------------------------------------------

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchStudentNumberConfig(token);
      if (!mounted.current) return;
      setDraft(toDraft(data.config));
      setSegments(data.segments ?? []);
      setContext(data.context ?? null);
      setPreview(data.preview ?? null);
      setIsConfigured(!!data.is_configured);
      setIssuedCount(data.issued_count ?? 0);
      setDirty(false);
    } catch (e: any) {
      if (mounted.current) setLoadError(e?.message ?? t('student_number_config.load_error', 'Could not load the student number format.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Debounced server-side preview -------------------------------------

  useEffect(() => {
    if (!token || !draft || !dirty) return;

    const handle = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(null);
      try {
        const result = await previewStudentNumber(token, draft);
        if (!mounted.current) return;
        setPreview(result.preview);
        setContext(result.context);
      } catch (e: any) {
        // Keep the last good preview on screen rather than blanking it - a
        // dropped request shouldn't make the format look broken.
        if (mounted.current) setPreviewError(e?.message ?? t('student_number_config.preview_unavailable', 'Preview unavailable.'));
      } finally {
        if (mounted.current) setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [token, draft, dirty]);

  // --- Edits -------------------------------------------------------------

  const patch = useCallback((changes: Partial<StudentNumberDraft>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
    setDirty(true);
  }, []);

  const moveSegment = useCallback(
    (key: SegmentKey, direction: -1 | 1) => {
      setDraft((current) => {
        if (!current) return current;
        const order = [...current.segment_order];
        const index = order.indexOf(key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= order.length) return current;
        order[index] = order[target];
        order[target] = key;
        return { ...current, segment_order: order };
      });
      setDirty(true);
    },
    [],
  );

  const isSegmentOn = useCallback(
    (meta: SegmentMeta): boolean => {
      if (!draft) return false;
      if (meta.toggle_field) return !!draft[meta.toggle_field];
      if (meta.key === 'running_number') return true;
      if (meta.key === 'prefix') return draft.prefix.trim().length > 0;
      if (meta.key === 'suffix') return draft.suffix.trim().length > 0;
      return false;
    },
    [draft],
  );

  const orderedSegments = useMemo(() => {
    if (!draft) return [] as SegmentMeta[];
    const byKey = new Map(segments.map((s) => [s.key, s]));
    return draft.segment_order
      .map((key) => byKey.get(key))
      .filter((s): s is SegmentMeta => !!s);
  }, [draft, segments]);

  // --- Save --------------------------------------------------------------

  const commit = useCallback(async () => {
    if (!token || !draft) return;
    setSaving(true);
    try {
      const result = await saveStudentNumberConfig(token, draft);
      if (!mounted.current) return;
      setDraft(toDraft(result.config));
      setPreview(result.preview);
      setIsConfigured(true);
      setDirty(false);
      Alert.alert(t('student_number_config.saved', 'Saved'), t('student_number_config.saved_message', 'New students will be numbered using this format.'));
    } catch (e: any) {
      if (mounted.current) Alert.alert(t('student_number_config.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [token, draft, t]);

  const onSave = useCallback(() => {
    if (!draft) return;

    if (preview && preview.sample.trim() === '') {
      Alert.alert(t('student_number_config.empty_format_title', 'Empty format'), t('student_number_config.empty_format_message', 'This format produces an empty number. Add a prefix or another segment first.'));
      return;
    }

    if (issuedCount > 0) {
      Alert.alert(
        t('student_number_config.change_format_title', 'Change the format?'),
        (issuedCount === 1
          ? t('student_number_config.issued_count_one', '{n} student number has already been issued.')
          : t('student_number_config.issued_count_many', '{n} student numbers have already been issued.')
        ).replace('{n}', String(issuedCount)) +
          ' ' +
          t('student_number_config.issued_count_note', 'Those stay exactly as they are - only students admitted from now on use the new format.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('student_number_config.save_format', 'Save format'), style: 'destructive', onPress: commit },
        ],
      );
      return;
    }

    commit();
  }, [draft, preview, issuedCount, commit, t]);

  // --- Availability lookup ------------------------------------------------

  const runLookup = useCallback(async () => {
    if (!token) return;
    const value = lookup.trim();
    if (!value) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const result = await checkStudentNumber(token, value);
      if (mounted.current) setLookupResult(result);
    } catch (e: any) {
      if (mounted.current) Alert.alert(t('student_number_config.check_failed', 'Check failed'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      if (mounted.current) setLookupBusy(false);
    }
  }, [token, lookup, t]);

  // --- States -------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={EMERALD} />
        <Text style={styles.centerText}>{t('student_number_config.loading', 'Loading student number format…')}</Text>
      </View>
    );
  }

  if (loadError || !draft) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>{t('student_number_config.load_failed_title', "Couldn't load this screen")}</Text>
        <Text style={styles.centerText}>{loadError ?? t('student_number_config.no_config_returned', 'No configuration was returned.')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
          <Text style={styles.retryText}>{t('student_number_config.try_again', 'Try again')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.linkText}>{t('student_number_config.go_back', 'Go back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sample = preview?.sample ?? '';

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('student_number_config.title', 'Student Numbers')}</Text>
          <Text style={styles.headerSub}>
            {isConfigured
              ? t('student_number_config.configured', 'Configured for this school')
              : t('student_number_config.not_configured', 'Not configured yet — showing defaults')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* --- Live preview --- */}
        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <Text style={styles.previewLabel}>{t('student_number_config.next_number', 'NEXT STUDENT NUMBER')}</Text>
            {previewing ? <ActivityIndicator size="small" color={EMERALD} /> : null}
          </View>

          <Text style={styles.previewSample} numberOfLines={2} adjustsFontSizeToFit>
            {sample || '—'}
          </Text>

          <Text style={styles.previewPattern}>{preview?.pattern || t('student_number_config.no_segments', 'No segments selected')}</Text>

          {preview && preview.samples.length > 1 ? (
            <Text style={styles.previewThen}>
              {t('student_number_config.then', 'then')} {preview.samples.slice(1).join(', ')}
            </Text>
          ) : null}

          <View style={styles.previewMetaRow}>
            <Text style={styles.previewMeta}>{t('student_number_config.counter_at', 'Counter at #{n}').replace('{n}', String(preview?.next_number ?? '—'))}</Text>
            <Text style={styles.previewMeta}>
              {draft.reset_mode === 'yearly' ? t('student_number_config.resets_yearly', 'Resets each year') : t('student_number_config.continuous', 'Continuous')}
            </Text>
          </View>

          {previewError ? (
            <Text style={styles.previewStale}>{t('student_number_config.showing_last_preview', 'Showing last known preview — {error}').replace('{error}', previewError)}</Text>
          ) : null}
        </View>

        {(preview?.warnings ?? []).map((warning) => (
          <View key={warning} style={styles.warnRow}>
            <Text style={styles.warnText}>{warning}</Text>
          </View>
        ))}

        {issuedCount > 0 ? (
          <View style={styles.noteRow}>
            <Text style={styles.noteText}>
              {(issuedCount === 1
                ? t('student_number_config.issued_note_one', '{n} number already issued.')
                : t('student_number_config.issued_note_many', '{n} numbers already issued.')
              ).replace('{n}', String(issuedCount))}{' '}
              {t('student_number_config.issued_note_rest', 'Editing this format never renumbers existing students.')}
            </Text>
          </View>
        ) : null}

        {/* --- Fixed text --- */}
        <SectionTitle>{t('student_number_config.fixed_text', 'Fixed text')}</SectionTitle>
        <View style={styles.card}>
          <Field
            label={t('student_number_config.prefix', 'Prefix')}
            hint={t('student_number_config.prefix_hint', 'Letters or digits at the front. Leave blank to skip.')}
            value={draft.prefix}
            placeholder="e.g. MLP"
            maxLength={12}
            onChangeText={(text) => patch({ prefix: sanitize(text) })}
          />
          <View style={styles.divider} />
          <Field
            label={t('student_number_config.suffix', 'Suffix')}
            hint={t('student_number_config.suffix_hint', 'Letters or digits at the end. Leave blank to skip.')}
            value={draft.suffix}
            placeholder="e.g. S"
            maxLength={12}
            onChangeText={(text) => patch({ suffix: sanitize(text) })}
          />
        </View>

        {/* --- Separator --- */}
        <SectionTitle>{t('student_number_config.separator', 'Separator')}</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.hint}>{t('student_number_config.separator_hint', 'Placed between every segment.')}</Text>
          <View style={styles.chipWrap}>
            {SEPARATOR_KEYS.map((option) => (
              <Chip
                key={option.key}
                label={t(`student_number_config.separator_${option.key}`, option.fallback)}
                active={draft.separator === option.value}
                onPress={() => patch({ separator: option.value })}
              />
            ))}
          </View>
        </View>

        {/* --- Segments --- */}
        <SectionTitle>{t('student_number_config.segments', 'Segments')}</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.hint}>
            {t('student_number_config.segments_hint', 'Turn segments on or off, and reorder them. The order here is the order they appear in the number.')}
          </Text>

          {orderedSegments.map((meta, index) => {
            const on = isSegmentOn(meta);
            const fixed = !meta.toggle_field;
            return (
              <View key={meta.key} style={styles.segmentRow}>
                <View style={styles.segmentOrderCol}>
                  <TouchableOpacity
                    style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => moveSegment(meta.key, -1)}
                    hitSlop={6}
                  >
                    <Text style={[styles.orderGlyph, index === 0 && styles.orderGlyphDisabled]}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.orderBtn,
                      index === orderedSegments.length - 1 && styles.orderBtnDisabled,
                    ]}
                    disabled={index === orderedSegments.length - 1}
                    onPress={() => moveSegment(meta.key, 1)}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        styles.orderGlyph,
                        index === orderedSegments.length - 1 && styles.orderGlyphDisabled,
                      ]}
                    >
                      ▼
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.segmentTextCol}>
                  <Text style={[styles.segmentLabel, !on && styles.segmentLabelOff]}>{meta.label}</Text>
                  <Text style={styles.segmentDesc}>{meta.description}</Text>
                  {meta.toggle_field ? renderSourceHint(meta.key, context, t) : null}
                </View>

                {fixed ? (
                  <View style={[styles.statePill, on ? styles.statePillOn : styles.statePillOff]}>
                    <Text style={[styles.statePillText, on ? styles.statePillTextOn : null]}>
                      {meta.key === 'running_number'
                        ? t('student_number_config.always', 'Always')
                        : on
                        ? t('student_number_config.on', 'On')
                        : t('student_number_config.off', 'Off')}
                    </Text>
                  </View>
                ) : (
                  <Switch
                    value={on}
                    onValueChange={(next) => patch({ [meta.toggle_field as string]: next } as any)}
                    trackColor={{ false: '#D8DEDA', true: EMERALD }}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* --- Running number --- */}
        <SectionTitle>{t('student_number_config.running_number', 'Running number')}</SectionTitle>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flexCol}>
              <Text style={styles.label}>{t('student_number_config.digits', 'Digits')}</Text>
              <Text style={styles.hint}>
                {(draft.digit_length === 1
                  ? t('student_number_config.digit_count_one', '{n} digit')
                  : t('student_number_config.digit_count_many', '{n} digits')
                ).replace('{n}', String(draft.digit_length))}{' '}
                → {'1'.padStart(draft.digit_length, '0')}
              </Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => patch({ digit_length: Math.max(DIGIT_MIN, draft.digit_length - 1) })}
                hitSlop={8}
              >
                <Text style={styles.stepGlyph}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{draft.digit_length}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => patch({ digit_length: Math.min(DIGIT_MAX, draft.digit_length + 1) })}
                hitSlop={8}
              >
                <Text style={styles.stepGlyph}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <Field
            label={t('student_number_config.start_at', 'Start at')}
            hint={t('student_number_config.start_at_hint', 'Where the counter begins. Ignored once numbers have been issued.')}
            value={String(draft.start_number)}
            keyboardType="number-pad"
            placeholder="1"
            maxLength={9}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '');
              patch({ start_number: digits === '' ? 1 : Math.max(1, parseInt(digits, 10)) });
            }}
          />

          <View style={styles.divider} />

          <Text style={styles.label}>{t('student_number_config.numbering', 'Numbering')}</Text>
          <Text style={styles.hint}>
            {t('student_number_config.numbering_hint', 'Yearly reset restarts the counter each year, so the year segment keeps numbers unique.')}
          </Text>
          <View style={styles.chipWrap}>
            <Chip
              label={t('student_number_config.continuous', 'Continuous')}
              active={draft.reset_mode === 'never'}
              onPress={() => patch({ reset_mode: 'never' })}
            />
            <Chip
              label={t('student_number_config.reset_yearly', 'Reset yearly')}
              active={draft.reset_mode === 'yearly'}
              onPress={() => patch({ reset_mode: 'yearly' })}
            />
          </View>
        </View>

        {/* --- Formatting --- */}
        <SectionTitle>{t('student_number_config.formatting', 'Formatting')}</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.label}>{t('student_number_config.year_format', 'Year format')}</Text>
          <View style={styles.chipWrap}>
            <Chip
              label={t('student_number_config.year_full', 'Full  2026')}
              active={draft.year_format === 'full'}
              onPress={() => patch({ year_format: 'full' })}
            />
            <Chip
              label={t('student_number_config.year_short', 'Short  26')}
              active={draft.year_format === 'short'}
              onPress={() => patch({ year_format: 'short' })}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View style={styles.flexCol}>
              <Text style={styles.label}>{t('student_number_config.uppercase', 'Uppercase')}</Text>
              <Text style={styles.hint}>{t('student_number_config.uppercase_hint', 'Force the whole number to capitals.')}</Text>
            </View>
            <Switch
              value={draft.uppercase}
              onValueChange={(next) => patch({ uppercase: next })}
              trackColor={{ false: '#D8DEDA', true: EMERALD }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View style={styles.flexCol}>
              <Text style={styles.label}>{t('student_number_config.auto_generate', 'Auto-generate on admission')}</Text>
              <Text style={styles.hint}>
                {t('student_number_config.auto_generate_hint', 'When off, admission keeps whatever code is typed in manually.')}
              </Text>
            </View>
            <Switch
              value={draft.is_active}
              onValueChange={(next) => patch({ is_active: next })}
              trackColor={{ false: '#D8DEDA', true: EMERALD }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* --- Availability check --- */}
        <SectionTitle>{t('student_number_config.check_a_number', 'Check a number')}</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.hint}>
            {t('student_number_config.check_hint', 'Look up whether a specific student number is already taken anywhere in the system.')}
          </Text>
          <View style={styles.lookupRow}>
            <TextInput
              style={[styles.input, styles.lookupInput]}
              value={lookup}
              onChangeText={(text) => {
                setLookup(text);
                setLookupResult(null);
              }}
              placeholder={sample || 'MLP-2026-0001'}
              placeholderTextColor="#9AA5A0"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={runLookup}
            />
            <TouchableOpacity
              style={[styles.lookupBtn, (!lookup.trim() || lookupBusy) && styles.lookupBtnDisabled]}
              disabled={!lookup.trim() || lookupBusy}
              onPress={runLookup}
              activeOpacity={0.85}
            >
              {lookupBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.lookupBtnText}>{t('student_number_config.check', 'Check')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {lookupResult ? (
            <Text
              style={[
                styles.lookupResult,
                lookupResult.available ? styles.lookupFree : styles.lookupTaken,
              ]}
            >
              {lookupResult.available
                ? t('student_number_config.available', '{number} is available.').replace('{number}', lookupResult.student_number)
                : t('student_number_config.taken', '{number} is already in use ({where}).')
                    .replace('{number}', lookupResult.student_number)
                    .replace('{where}', lookupResult.taken_in)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
          disabled={!dirty || saving}
          onPress={onSave}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{dirty ? t('student_number_config.save_format', 'Save format') : t('student_number_config.saved_label', 'Saved')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Small local pieces -----------------------------------------------------

function sanitize(text: string): string {
  // The backend strips anything non-alphanumeric per segment anyway; doing it
  // here too means the preview matches what you typed instead of quietly
  // dropping characters a beat later.
  return text.replace(/[^A-Za-z0-9]/g, '');
}

function renderSourceHint(key: SegmentKey, context: PreviewContext | null, t: (key: string, fallback?: string) => string) {
  if (!context) return null;

  const value =
    key === 'campus_code'
      ? context.campus_code
      : key === 'department_code'
      ? context.department_code
      : key === 'academic_type'
      ? context.academic_type
      : key === 'academic_year'
      ? context.academic_year
      : key === 'admission_year'
      ? context.admission_date
      : null;

  if (value == null) return null;

  return <Text style={styles.segmentSource}>{t('student_number_config.sample_value', 'Sample value: {value}').replace('{value}', String(value))}</Text>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  hint,
  value,
  placeholder,
  maxLength,
  keyboardType,
  onChangeText,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad';
  onChangeText: (text: string) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA5A0"
        maxLength={maxLength}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </View>
  );
}

// --- Styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },

  center: {
    flex: 1,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: {
    marginTop: 20,
    backgroundColor: EMERALD,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  linkText: { marginTop: 16, color: SUBTLE, fontSize: 13, textDecorationLine: 'underline' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD_SOFT,
    marginRight: 12,
  },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  previewCard: {
    backgroundColor: '#111413',
    borderRadius: 22,
    padding: 20,
  },
  previewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLabel: {
    color: '#7FD9A8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewSample: {
    color: '#FFFFFF',
    fontFamily: MONO,
    fontSize: 30,
    marginTop: 14,
    letterSpacing: 1,
  },
  previewPattern: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: MONO,
    fontSize: 12.5,
    marginTop: 8,
  },
  previewThen: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10, fontFamily: MONO },
  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  previewMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  previewStale: { color: '#F0B37E', fontSize: 11.5, marginTop: 12 },

  warnRow: {
    backgroundColor: WARN_BG,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  warnText: { color: WARN_FG, fontSize: 12.5, lineHeight: 18 },

  noteRow: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  noteText: { color: INK, fontSize: 12.5, lineHeight: 18 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: SUBTLE,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },

  label: { fontSize: 14.5, fontWeight: '700', color: INK },
  hint: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 18 },

  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    fontSize: 15.5,
    color: INK,
    backgroundColor: '#FAFBFA',
    fontFamily: MONO,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: -8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFA',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  segmentOrderCol: { width: 30, marginRight: 8 },
  orderBtn: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: EMERALD_SOFT,
    marginVertical: 1,
  },
  orderBtnDisabled: { backgroundColor: '#F1F3F2' },
  orderGlyph: { fontSize: 10, color: EMERALD },
  orderGlyphDisabled: { color: '#C6CFCA' },
  segmentTextCol: { flex: 1, paddingRight: 10 },
  segmentLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  segmentLabelOff: { color: SUBTLE },
  segmentDesc: { fontSize: 12, color: SUBTLE, marginTop: 2, lineHeight: 17 },
  segmentSource: { fontSize: 11.5, color: EMERALD, marginTop: 4, fontFamily: MONO },

  statePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F3F2',
  },
  statePillOn: { backgroundColor: EMERALD_SOFT },
  statePillOff: {},
  statePillText: { fontSize: 11.5, fontWeight: '700', color: SUBTLE },
  statePillTextOn: { color: EMERALD },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFA',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
  },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, color: EMERALD, fontWeight: '700', marginTop: -2 },
  stepValue: { minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '800', color: INK },

  lookupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  lookupInput: { flex: 1, marginTop: 0 },
  lookupBtn: {
    marginLeft: 10,
    backgroundColor: EMERALD,
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 82,
  },
  lookupBtnDisabled: { backgroundColor: '#B9CFC3' },
  lookupBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  lookupResult: { marginTop: 12, fontSize: 13, lineHeight: 19, fontFamily: MONO },
  lookupFree: { color: EMERALD },
  lookupTaken: { color: DANGER },

  saveBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveBtn: {
    backgroundColor: EMERALD,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#B9CFC3' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15.5 },
});
