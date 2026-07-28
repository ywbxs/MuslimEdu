import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import {
  CompetencyDraft,
  CurriculumCompetency,
  CurriculumVersion,
  VersionDraft,
  deleteCurriculumCompetency,
  deleteCurriculumVersion,
  fetchCurriculumCompetencies,
  fetchCurriculumVersions,
  saveCurriculumCompetency,
  saveCurriculumVersion,
} from '../../services/curriculumVersionService';

/**
 * §4.6 Curriculum versioning. Sibling to CurriculumListScreen/CurriculumFormScreen
 * — same glass theme, opened via a "Versions" action on a curriculum row.
 *
 * Prerequisites/co-requisites are intentionally not shown here — they're
 * already managed per-subject in the Subjects catalog (SubjectFormScreen),
 * so this screen doesn't duplicate that.
 *
 * Never executed against a live backend — see the project's own definition
 * of done.
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Tab = 'versions' | 'competencies';

const CATEGORY_LABELS: Record<string, string> = {
  academic: 'Academic',
  islamic_studies: 'Islamic Studies',
  arabic: 'Arabic',
  other: 'Other',
};

export default function CurriculumVersionsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const curriculumId: number = route.params?.curriculumId;
  const curriculumName: string = route.params?.curriculumName ?? 'Curriculum';

  const [tab, setTab] = useState<Tab>('versions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [competencies, setCompetencies] = useState<CurriculumCompetency[]>([]);
  const [competenciesLoading, setCompetenciesLoading] = useState(false);

  const [versionFormVisible, setVersionFormVisible] = useState(false);
  const [editingVersion, setEditingVersion] = useState<CurriculumVersion | null>(null);
  const [competencyFormVisible, setCompetencyFormVisible] = useState(false);
  const [editingCompetency, setEditingCompetency] = useState<CurriculumCompetency | null>(null);
  const [saving, setSaving] = useState(false);

  const [fLabel, setFLabel] = useState('');
  const [fEffectiveDate, setFEffectiveDate] = useState('');
  const [fEndDate, setFEndDate] = useState('');
  const [fTotalCredits, setFTotalCredits] = useState('');
  const [fNotes, setFNotes] = useState('');

  const [cCode, setCCode] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cCategory, setCCategory] = useState<'academic' | 'islamic_studies' | 'arabic' | 'other'>('academic');
  const [cDescription, setCDescription] = useState('');

  const loadVersions = useCallback(async () => {
    if (!token || !curriculumId) return;
    setLoading(true);
    setError(null);
    try {
      const v = await fetchCurriculumVersions(token, curriculumId);
      setVersions(v);
      const active = v.find((x) => x.status === 'active') ?? v[0] ?? null;
      setSelectedVersion(active);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load curriculum versions.');
    } finally {
      setLoading(false);
    }
  }, [token, curriculumId]);

  useFocusEffect(
    useCallback(() => {
      loadVersions();
    }, [loadVersions])
  );

  const loadCompetencies = useCallback(
    async (versionId: number) => {
      if (!token) return;
      setCompetenciesLoading(true);
      try {
        const c = await fetchCurriculumCompetencies(token, versionId);
        setCompetencies(c);
      } catch (e: any) {
        Alert.alert("Couldn't load competencies", e?.message ?? 'Please try again.');
      } finally {
        setCompetenciesLoading(false);
      }
    },
    [token]
  );

  const onSelectVersion = (v: CurriculumVersion) => {
    setSelectedVersion(v);
    setTab('competencies');
    loadCompetencies(v.id);
  };

  // --- Version form ---

  const openNewVersion = () => {
    setEditingVersion(null);
    setFLabel('');
    setFEffectiveDate('');
    setFEndDate('');
    setFTotalCredits('');
    setFNotes('');
    setVersionFormVisible(true);
  };

  const openEditVersion = (v: CurriculumVersion) => {
    setEditingVersion(v);
    setFLabel(v.version_label);
    setFEffectiveDate(v.effective_date?.slice(0, 10) ?? '');
    setFEndDate(v.end_date?.slice(0, 10) ?? '');
    setFTotalCredits(v.credit_requirements?.total_credits?.toString() ?? '');
    setFNotes(v.notes ?? '');
    setVersionFormVisible(true);
  };

  const onSaveVersion = async () => {
    if (!token) return;
    if (!fLabel.trim() || !fEffectiveDate.trim()) {
      Alert.alert('Missing info', 'A label and an effective date (YYYY-MM-DD) are required.');
      return;
    }
    setSaving(true);
    try {
      const draft: VersionDraft = {
        id: editingVersion?.id,
        curriculum_id: curriculumId,
        version_label: fLabel.trim(),
        effective_date: fEffectiveDate.trim(),
        end_date: fEndDate.trim() || null,
        notes: fNotes.trim() || null,
        credit_requirements: fTotalCredits.trim()
          ? { total_credits: Number(fTotalCredits.trim()) }
          : null,
      };
      const saved = await saveCurriculumVersion(token, draft);
      setVersions((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [saved, ...others];
      });
      setVersionFormVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onActivateVersion = (v: CurriculumVersion) => {
    Alert.alert(
      'Make this the active version?',
      `Any other active version of "${curriculumName}" will move to retired. Students already pinned to another version are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            if (!token) return;
            try {
              await saveCurriculumVersion(token, {
                id: v.id,
                version_label: v.version_label,
                effective_date: v.effective_date.slice(0, 10),
                status: 'active',
              });
              loadVersions();
            } catch (e: any) {
              Alert.alert('Could not activate', e?.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const confirmDeleteVersion = (v: CurriculumVersion) => {
    Alert.alert('Delete this version?', `"${v.version_label}" will be removed if no students are pinned to it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteCurriculumVersion(token, v.id);
            setVersions((prev) => prev.filter((x) => x.id !== v.id));
            if (selectedVersion?.id === v.id) setSelectedVersion(null);
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  // --- Competency form ---

  const openNewCompetency = () => {
    setEditingCompetency(null);
    setCCode('');
    setCTitle('');
    setCCategory('academic');
    setCDescription('');
    setCompetencyFormVisible(true);
  };

  const openEditCompetency = (c: CurriculumCompetency) => {
    setEditingCompetency(c);
    setCCode(c.code);
    setCTitle(c.title);
    setCCategory(c.category);
    setCDescription(c.description ?? '');
    setCompetencyFormVisible(true);
  };

  const onSaveCompetency = async () => {
    if (!token || !selectedVersion) return;
    if (!cTitle.trim()) {
      Alert.alert('Title required', 'Give this competency a title first.');
      return;
    }
    setSaving(true);
    try {
      const draft: CompetencyDraft = {
        id: editingCompetency?.id,
        curriculum_version_id: selectedVersion.id,
        code: editingCompetency ? undefined : cCode.trim().toUpperCase().replace(/\s+/g, '_'),
        title: cTitle.trim(),
        description: cDescription.trim() || null,
        category: cCategory,
      };
      const saved = await saveCurriculumCompetency(token, draft);
      setCompetencies((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [...others, saved].sort((a, b) => a.sort_order - b.sort_order);
      });
      setCompetencyFormVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCompetency = (c: CurriculumCompetency) => {
    Alert.alert('Delete competency?', `"${c.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteCurriculumCompetency(token, c.id);
            setCompetencies((prev) => prev.filter((x) => x.id !== c.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <GlassBackground variant="canvas" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{curriculumName}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>
          {[0, 1].map((k) => (
            <View key={k} style={styles.card}>
              <Skeleton width="50%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
              <Skeleton width="70%" height={12} baseColor={theme.skeletonBase} />
            </View>
          ))}
        </View>
        <BottomNavBar />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <GlassBackground variant="canvas" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{curriculumName}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadVersions}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <BottomNavBar />
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{curriculumName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, tab === 'versions' && styles.filterButtonActive]}
          onPress={() => setTab('versions')}
        >
          <Text style={[styles.filterButtonText, tab === 'versions' && styles.filterButtonTextActive]}>Versions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, tab === 'competencies' && styles.filterButtonActive]}
          onPress={() => selectedVersion && setTab('competencies')}
          disabled={!selectedVersion}
        >
          <Text style={[styles.filterButtonText, tab === 'competencies' && styles.filterButtonTextActive]}>
            Competencies{selectedVersion ? ` (${selectedVersion.version_label})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'versions' ? (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {versions.length === 0 ? (
            <EmptyState
              icon="🗂️"
              title="No versions yet"
              subtitle="Add the first version to set credit requirements and competencies."
              colors={theme}
            />
          ) : (
            versions.map((v) => (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{v.version_label}</Text>
                  </View>
                  <Text
                    style={[
                      styles.statusBadgeText,
                      v.status === 'active'
                        ? { color: theme.success, backgroundColor: theme.successSoft }
                        : v.status === 'retired'
                        ? { color: theme.textMuted, backgroundColor: theme.surfaceVariant }
                        : { color: theme.warning, backgroundColor: theme.warningSoft },
                    ]}
                  >
                    {v.status}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Effective:</Text>
                  <Text style={styles.value}>{v.effective_date?.slice(0, 10)}</Text>
                </View>
                {v.end_date && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Ends:</Text>
                    <Text style={styles.value}>{v.end_date.slice(0, 10)}</Text>
                  </View>
                )}
                {v.credit_requirements?.total_credits != null && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Total credits:</Text>
                    <Text style={styles.value}>{v.credit_requirements.total_credits}</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <TouchableOpacity style={styles.actionButtonGhost} onPress={() => onSelectVersion(v)}>
                    <Text style={styles.actionButtonGhostText}>Competencies</Text>
                  </TouchableOpacity>
                  {v.status !== 'active' && (
                    <TouchableOpacity style={styles.actionButtonGhost} onPress={() => onActivateVersion(v)}>
                      <Text style={styles.actionButtonGhostText}>Activate</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEditVersion(v)}>
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDeleteVersion(v)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : competenciesLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {competencies.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No competencies yet"
              subtitle={`Add what students must demonstrate under ${selectedVersion?.version_label}.`}
              colors={theme}
            />
          ) : (
            competencies.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{c.code}</Text>
                  </View>
                  <Text style={[styles.statusBadgeText, { color: theme.accentSoftText, backgroundColor: theme.accentSoft }]}>
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </Text>
                </View>
                <Text style={styles.name}>{c.title}</Text>
                {!!c.description && <Text style={styles.value}>{c.description}</Text>}
                <View style={styles.cardFooter}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEditCompetency(c)}>
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDeleteCompetency(c)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={tab === 'versions' ? openNewVersion : openNewCompetency}>
          <Text style={styles.addBtnText}>{tab === 'versions' ? '+ Add Version' : '+ Add Competency'}</Text>
        </TouchableOpacity>
      </View>

      {/* Version form modal */}
      <Modal visible={versionFormVisible} animationType="slide" transparent onRequestClose={() => setVersionFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingVersion ? 'Edit Version' : 'New Version'}</Text>

            <Text style={styles.formLabel}>Version label</Text>
            <TextInput style={styles.input} value={fLabel} onChangeText={setFLabel} placeholder="e.g. 2026-2027" />

            <Text style={styles.formLabel}>Effective date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={fEffectiveDate} onChangeText={setFEffectiveDate} placeholder="2026-09-01" />

            <Text style={styles.formLabel}>End date (optional)</Text>
            <TextInput style={styles.input} value={fEndDate} onChangeText={setFEndDate} placeholder="YYYY-MM-DD" />

            <Text style={styles.formLabel}>Total credits (optional)</Text>
            <TextInput style={styles.input} value={fTotalCredits} onChangeText={setFTotalCredits} placeholder="e.g. 120" keyboardType="numeric" />

            <Text style={styles.formLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={fNotes} onChangeText={setFNotes} multiline placeholder="What changed in this version" />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setVersionFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveVersion} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Competency form modal */}
      <Modal visible={competencyFormVisible} animationType="slide" transparent onRequestClose={() => setCompetencyFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingCompetency ? 'Edit Competency' : 'New Competency'}</Text>

            {!editingCompetency && (
              <>
                <Text style={styles.formLabel}>Code</Text>
                <TextInput style={styles.input} value={cCode} onChangeText={setCCode} placeholder="e.g. QURAN_MEMO_JUZ1" autoCapitalize="characters" />
              </>
            )}

            <Text style={styles.formLabel}>Title</Text>
            <TextInput style={styles.input} value={cTitle} onChangeText={setCTitle} placeholder="Display name" />

            <Text style={styles.formLabel}>Category</Text>
            <View style={styles.chipRow}>
              {(['academic', 'islamic_studies', 'arabic', 'other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, cCategory === cat && styles.chipActive]}
                  onPress={() => setCCategory(cat)}
                >
                  <Text style={[styles.chipText, cCategory === cat && styles.chipTextActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Description (optional)</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={cDescription} onChangeText={setCDescription} multiline />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCompetencyFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveCompetency} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 16 },
    retryBtn: { backgroundColor: theme.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: RADIUS.pill },
    retryBtnText: { color: theme.onAccent, fontWeight: '700' },

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

    filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, gap: 8 },
    filterButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.borderStrong },
    filterButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    filterButtonText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    filterButtonTextActive: { color: theme.onAccent },

    listContainer: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },

    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    codeBadge: { backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    codeText: { fontSize: 12, fontWeight: '700', color: theme.accentSoftText },
    statusBadgeText: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
    name: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
    value: { fontSize: 12, color: theme.textPrimary, fontWeight: '600' },

    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
    actionButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, marginTop: 4 },
    actionButtonText: { color: theme.onAccent, fontSize: 12, fontWeight: '600' },
    actionButtonGhost: { borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, marginTop: 4 },
    actionButtonGhostText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
    deleteButton: { borderWidth: 1, borderColor: theme.dangerSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8, marginTop: 4 },
    deleteButtonText: { color: theme.danger, fontSize: 12, fontWeight: '600' },

    saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
    addBtn: { backgroundColor: theme.accent, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: theme.onAccent, fontWeight: '800', fontSize: 15 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '88%' },
    modalTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginBottom: 14 },
    formLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginTop: 10 },
    input: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14.5,
      color: theme.textPrimary,
      backgroundColor: theme.surfaceVariant,
    },
    inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceVariant },
    chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    chipText: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary },
    chipTextActive: { color: theme.onAccent },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    modalCancel: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceVariant },
    modalCancelText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
    modalSave: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
    modalSaveText: { fontSize: 14, fontWeight: '700', color: theme.onAccent },
  });
