import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  FlatList,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import { WizardGradientButton } from '../../components/wizard/WizardKit';
import GlassBackground from '../../components/glass/GlassBackground';

const STATUSES = ['active', 'inactive'];
const labelize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface ClassOption {
  id: number;
  name: string;
}
interface TeacherOption {
  id: number;
  name: string;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronDown({ color }: { color: string }) {
  return <ChevronDown size={16} color={color} strokeWidth={2.4} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check size={17} color={color} strokeWidth={2.6} />;
}

// Sibling to DepartmentFormScreen.tsx / CurriculumFormScreen.tsx.
//
// One thing that's different here: admin_sections_update doesn't accept
// class_id (a section can't be moved to a different class after creation -
// see ApiController.php admin_sections_update, only name/class_teacher_id/
// capacity/room_number/status are in the updatable field list). So the
// class picker only appears when creating a new section; once a section
// exists, its class is shown read-only.
const SectionFormScreen = () => {
  const { token } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const statusLabel = (status: string) => t(`section_form.status_${status}`, labelize(status));
  const sectionId: number | undefined = route.params?.sectionId;
  const presetClassId: number | undefined = route.params?.classId;
  const isEditing = !!sectionId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<'class_id' | 'class_teacher_id' | 'status' | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [className, setClassName] = useState(''); // display-only when editing

  const [formData, setFormData] = useState({
    class_id: presetClassId ? String(presetClassId) : '',
    name: '',
    class_teacher_id: '',
    capacity: '',
    room_number: '',
    status: 'active',
  });

  const authedPost = useCallback(
    async (path: string, body: Record<string, any>) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors = data?.errors ? Object.values(data.errors).flat().join('\n') : null;
        throw new Error(errors || data?.message || `Request failed (${response.status})`);
      }
      return data;
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const [classesData, teachersData] = await Promise.all([
          authedPost('/admin_classes_list', { per_page: 500, sort_by: 'name', sort_order: 'asc' }),
          authedPost('/admin_class_teacher_list', {}),
        ]);
        setClasses(classesData.classes ?? []);
        setTeachers(teachersData.teachers ?? []);

        if (isEditing && sectionId) {
          const sectionsData = await authedPost('/admin_sections_list', {});
          const section = (sectionsData.sections ?? []).find((s: any) => s.id === sectionId);
          if (section) {
            setClassName(section.class_name || '');
            setFormData({
              class_id: String(section.class_id),
              name: section.name || '',
              class_teacher_id: section.class_teacher_id ? String(section.class_teacher_id) : '',
              capacity: section.capacity ? String(section.capacity) : '',
              room_number: section.room_number || '',
              status: section.status || 'active',
            });
          } else {
            Alert.alert(t('common.error', 'Error'), t('section_form.not_found', 'Section not found'));
            navigation.goBack();
          }
        }
      } catch (err) {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_form.load_error', 'Failed to load section'));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isEditing, sectionId, t]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectOption = (field: keyof typeof formData, value: string) => {
    updateField(field, value);
    setActiveModal(null);
  };

  const validateForm = () => {
    if (!isEditing && !formData.class_id) {
      Alert.alert(t('common.error', 'Error'), t('section_form.select_class_required', 'Please select a class'));
      return false;
    }
    if (!formData.name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('section_form.name_required', 'Section name is required'));
      return false;
    }
    if (formData.capacity && parseInt(formData.capacity, 10) < 1) {
      Alert.alert(t('common.error', 'Error'), t('section_form.capacity_invalid', 'Capacity must be greater than 0'));
      return false;
    }
    return true;
  };

  const goToClass = () => {
    const classId = parseInt(formData.class_id, 10);
    (navigation as any).navigate('ClassDetail', { classId });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const sharedPayload = {
        name: formData.name,
        class_teacher_id: formData.class_teacher_id ? parseInt(formData.class_teacher_id, 10) : null,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        room_number: formData.room_number || null,
        status: formData.status,
      };

      if (isEditing) {
        await authedPost('/admin_sections_update', { section_id: sectionId, ...sharedPayload });
        Alert.alert(t('section_form.success', 'Success'), t('section_form.updated_message', 'Section updated successfully'), [
          { text: t('common.ok', 'OK'), onPress: goToClass },
        ]);
      } else {
        await authedPost('/admin_sections_create', { class_id: parseInt(formData.class_id, 10), ...sharedPayload });
        Alert.alert(t('section_form.success', 'Success'), t('section_form.created_message', 'Section created successfully'), [
          { text: t('common.ok', 'OK'), onPress: goToClass },
        ]);
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_form.save_error', 'Failed to save section'));
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field: 'class_id' | 'class_teacher_id' | 'status') => {
    switch (field) {
      case 'class_id':
        return classes.find((c) => c.id === parseInt(formData.class_id, 10))?.name || t('section_form.select_placeholder', 'Select...');
      case 'class_teacher_id':
        return (
          teachers.find((teacher) => teacher.id === parseInt(formData.class_teacher_id, 10))?.name ||
          t('section_form.not_assigned', 'Not assigned')
        );
      case 'status':
        return statusLabel(formData.status);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
        <IconChevronLeft color={theme.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
        {isEditing ? t('section_form.edit_title', 'Edit Section') : t('section_form.create_title', 'Create Section')}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <GlassBackground variant="canvas" />
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      {header}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepTitle}>
          {isEditing ? t('section_form.edit_subtitle_title', 'Update this section') : t('section_form.create_subtitle_title', "Let's set up the section")}
        </Text>
        <Text style={styles.stepSubtitle}>
          {t('section_form.subtitle', 'A name, an adviser, and how many students it holds.')}
        </Text>

        <Text style={styles.label}>{t('section_form.class_label', 'Class')} *</Text>
        {isEditing ? (
          <View style={[styles.selectButton, styles.selectButtonDisabled]}>
            <Text style={styles.selectButtonText}>{className || t('section_form.unknown', 'Unknown')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.selectButton} onPress={() => setActiveModal('class_id')} activeOpacity={0.8}>
            <Text style={styles.selectButtonText}>{getDisplayValue('class_id')}</Text>
            <IconChevronDown color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        {isEditing ? (
          <Text style={styles.hint}>{t('section_form.class_locked_hint', "A section's class can't be changed after creation.")}</Text>
        ) : null}

        <Text style={styles.label}>{t('section_form.name_label', 'Section Name')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('section_form.name_placeholder', 'e.g., A')}
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('section_form.adviser_label', 'Adviser')}</Text>
        <TouchableOpacity style={styles.selectButton} onPress={() => setActiveModal('class_teacher_id')} activeOpacity={0.8}>
          <Text style={styles.selectButtonText}>{getDisplayValue('class_teacher_id')}</Text>
          <IconChevronDown color={theme.textSecondary} />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Text style={styles.label}>{t('section_form.capacity_label', 'Capacity')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('section_form.capacity_placeholder', 'e.g., 40')}
              value={formData.capacity}
              onChangeText={(text) => updateField('capacity', text)}
              keyboardType="number-pad"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <View style={styles.rowField}>
            <Text style={styles.label}>{t('section_form.room_label', 'Room Number')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('section_form.room_placeholder', 'e.g., 204')}
              value={formData.room_number}
              onChangeText={(text) => updateField('room_number', text)}
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        <Text style={styles.label}>{t('section_form.status_label', 'Status')}</Text>
        <View style={styles.chipGrid}>
          {STATUSES.map((status) => {
            const selected = formData.status === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => updateField('status', status)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{statusLabel(status)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backStepButton} onPress={() => navigation.goBack()} disabled={submitting}>
            <Text style={styles.backStepButtonText}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <WizardGradientButton
              label={isEditing ? t('section_form.save_changes', 'Save Changes') : t('section_form.create_title', 'Create Section')}
              onPress={handleSubmit}
              loading={submitting}
            />
          </View>
        </View>
      </ScrollView>

      {/* Class sheet (create only) */}
      <KeyboardAwareModal visible={activeModal === 'class_id'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('section_form.select_class', 'Select Class')}</Text>
            <FlatList
              data={classes}
              renderItem={({ item }) => {
                const selected = String(item.id) === formData.class_id;
                return (
                  <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectOption('class_id', String(item.id))}>
                    <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]} numberOfLines={1}>{item.name}</Text>
                    {selected ? <IconCheck color={theme.accent} /> : null}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={styles.modalEmptyText}>{t('section_form.no_classes_found', 'No classes found')}</Text>}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* Adviser sheet */}
      <KeyboardAwareModal visible={activeModal === 'class_teacher_id'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('section_form.select_adviser', 'Select Adviser')}</Text>
            <FlatList
              data={[{ id: -1, name: t('section_form.not_assigned', 'Not assigned') }, ...teachers]}
              renderItem={({ item }) => {
                const selected = item.id === -1 ? !formData.class_teacher_id : String(item.id) === formData.class_teacher_id;
                return (
                  <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectOption('class_teacher_id', item.id === -1 ? '' : String(item.id))}>
                    <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]} numberOfLines={1}>{item.name}</Text>
                    {selected ? <IconCheck color={theme.accent} /> : null}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={styles.modalEmptyText}>{t('section_form.no_teachers_found', 'No teachers found')}</Text>}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* Status sheet */}
      <KeyboardAwareModal visible={activeModal === 'status'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('section_form.select_status', 'Select Status')}</Text>
            {STATUSES.map((status) => {
              const selected = formData.status === status;
              return (
                <TouchableOpacity key={status} style={styles.modalItem} onPress={() => handleSelectOption('status', status)}>
                  <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>{statusLabel(status)}</Text>
                  {selected ? <IconCheck color={theme.accent} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareModal>
    </View>
  );
};

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
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20, paddingBottom: 48 },

    stepTitle: { fontSize: 19, fontWeight: '800', color: theme.textPrimary },
    stepSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },

    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    hint: { fontSize: 12, color: theme.textMuted, marginTop: 6 },
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
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
    },
    selectButtonDisabled: { backgroundColor: theme.surfaceVariant },
    selectButtonText: { fontSize: 15, color: theme.textPrimary, flex: 1, marginRight: 8 },

    row: { flexDirection: 'row', gap: 12 },
    rowField: { flex: 1 },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.pill ?? 999,
    },
    chipSelected: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    chipTextSelected: { color: theme.accentSoftText ?? theme.accent },

    navRow: { flexDirection: 'row', gap: 10, marginTop: 32, alignItems: 'center' },
    backStepButton: {
      height: 54,
      paddingHorizontal: 18,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backStepButtonText: { color: theme.textPrimary, fontWeight: '700', fontSize: 15 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '80%',
      paddingBottom: 8,
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderStrong,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, paddingHorizontal: 18, paddingVertical: 12 },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalItemText: { fontSize: 14.5, color: theme.textPrimary, flex: 1, marginRight: 8 },
    modalItemTextSelected: { fontWeight: '700', color: theme.accent },
    modalEmptyText: { fontSize: 14, color: theme.textMuted, textAlign: 'center', paddingVertical: 20 },
    modalCloseButton: {
      marginTop: 8,
      marginHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.surfaceVariant,
      borderRadius: RADIUS.pill,
    },
    modalCloseText: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  });

export default SectionFormScreen;
