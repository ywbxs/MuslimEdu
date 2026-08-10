import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAdminGradebookExamCategories,
  createExamCategory,
  updateExamCategory,
  deleteExamCategory,
  ExamCategoryOption,
} from '../../services/teacherGradebookService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#2BCBB0';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const RED = '#B3261E';
const RED_SOFT = '#FDECEC';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconTrash({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={14} borderRadius={4} />
      <Skeleton width="30%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

type FormState = {
  categoryId: number | null;
  name: string;
  weight: string;
};

const EMPTY_FORM: FormState = { categoryId: null, name: '', weight: '' };

// Admin management of Assessment Components (spec §4.11): the weighted
// categories (Quizzes, Midterm, Final, etc.) that both the legacy
// Gradebook and the newer Assessments feature draw from. Previously
// these were view-only here and only creatable through the legacy web
// portal — this screen is the first mobile-side write path.
export default function AdminExamCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [categories, setCategories] = useState<ExamCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const list = await fetchAdminGradebookExamCategories(token);
        setCategories(list);
      } catch (e: any) {
        setError(e?.message ?? t('admin_exam_categories.load_error', 'Could not load exam categories.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const openNew = () => {
    setForm(EMPTY_FORM);
    setIsModalVisible(true);
  };

  const openEdit = (c: ExamCategoryOption) => {
    setForm({ categoryId: c.id, name: c.name, weight: c.weight != null ? String(c.weight) : '' });
    setIsModalVisible(true);
  };

  const totalWeight = categories.reduce((sum, c) => sum + (c.weight ?? 0), 0);

  const save = async () => {
    if (!token) return;
    if (!form.name.trim()) {
      Alert.alert(t('admin_exam_categories.missing_name_title', 'Missing name'), t('admin_exam_categories.missing_name_message', 'Give this category a name (e.g. Quizzes, Midterm, Final).'));
      return;
    }
    const weightValue = form.weight.trim() ? Number(form.weight) : null;
    if (weightValue !== null && (Number.isNaN(weightValue) || weightValue < 0 || weightValue > 100)) {
      Alert.alert(t('admin_exam_categories.invalid_weight_title', 'Invalid weight'), t('admin_exam_categories.invalid_weight_message', 'Weight must be a number between 0 and 100, or left blank.'));
      return;
    }
    setIsSubmitting(true);
    try {
      if (form.categoryId) {
        await updateExamCategory(token, {
          exam_category_id: form.categoryId,
          name: form.name.trim(),
          weight: weightValue,
        });
      } else {
        await createExamCategory(token, { name: form.name.trim(), weight: weightValue });
      }
      setIsModalVisible(false);
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('admin_exam_categories.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (c: ExamCategoryOption) => {
    if (!token) return;
    Alert.alert(t('admin_exam_categories.delete_title', 'Delete category?'), `"${c.name}" ${t('admin_exam_categories.delete_message', 'will be removed if nothing is using it yet.')}`, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('admin_exam_categories.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExamCategory(token, c.id);
            setCategories((prev) => prev.filter((p) => p.id !== c.id));
          } catch (e: any) {
            Alert.alert(t('admin_exam_categories.delete_error', 'Could not delete'), e?.message ?? t('admin_exam_categories.delete_in_use', 'It may already be in use by exams, grades, or assessments.'));
          }
        },
      },
    ]);
  };

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_exam_categories.title', 'Exam Categories')}</Text>
        <TouchableOpacity onPress={openNew} hitSlop={12} style={styles.newButton}>
          <IconPlus color={EMERALD} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {t('admin_exam_categories.subtitle', 'Weighted components (e.g. Quizzes, Midterm, Final) shared by Gradebook and Assessments.')}
        {categories.some((c) => c.weight != null) ? ` ${t('admin_exam_categories.weights_total', 'Weights currently total {pct}%.').replace('{pct}', String(totalWeight))}` : ''}
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('admin_exam_categories.empty', 'No exam categories yet. Tap + to add one (e.g. "Quizzes", "Final Exam").')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.85}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.weightBadge}>
                  <Text style={styles.weightBadgeText}>{item.weight != null ? `${item.weight}%` : t('admin_exam_categories.no_weight_set', 'No weight set')}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={{ marginLeft: 6 }}>
                  <IconTrash color={SUBTLE} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{form.categoryId ? t('admin_exam_categories.edit_category', 'Edit category') : t('admin_exam_categories.new_category', 'New exam category')}</Text>

              <Text style={styles.fieldLabel}>{t('admin_exam_categories.name_label', 'Name')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('admin_exam_categories.name_placeholder', 'e.g. Midterm')}
                placeholderTextColor={SUBTLE}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />

              <Text style={styles.fieldLabel}>{t('admin_exam_categories.weight_label', 'Weight (%, optional)')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('admin_exam_categories.weight_placeholder', 'e.g. 30')}
                keyboardType="numeric"
                placeholderTextColor={SUBTLE}
                value={form.weight}
                onChangeText={(v) => setForm((f) => ({ ...f, weight: v }))}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={save}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalBtnPrimaryText}>{form.categoryId ? t('admin_exam_categories.save_changes', 'Save changes') : t('admin_exam_categories.create', 'Create')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  newButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 12.5, color: SUBTLE, paddingHorizontal: 16, paddingBottom: 12, lineHeight: 17 },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: RED_SOFT },
  errorText: { color: RED, fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 12,
    ...SHADOW.card,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  weightBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: EMERALD_SOFT },
  weightBadgeText: { fontSize: 11, fontWeight: '700', color: EMERALD },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5, paddingHorizontal: 24 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '88%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: INK,
    backgroundColor: '#FAFAFB',
  },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 8 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: EMERALD },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
