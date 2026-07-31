import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/api';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

const STATUSES = ['active', 'inactive'];
const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Sibling to DepartmentFormScreen.tsx. Reuses admin_classes_reference_data
// (already built for CreateClassScreen) for the department + school year
// pickers instead of adding new endpoints for the same lookups.
const CurriculumFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const statusLabel = (status: string) => t(`curriculum_form.status_${status}`, labelize(status));
  const curriculumId = route.params?.curriculumId;
  const isEditing = !!curriculumId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [referenceData, setReferenceData] = useState({ departments: [], school_years: [], programs: [] });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    department_id: '',
    program_id: '',
    effective_school_year_id: '',
    description: '',
    status: 'active',
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    await fetchReferenceData();
    await fetchPrograms();
    if (isEditing) {
      await fetchCurriculum();
    }
    setLoading(false);
  };

  const fetchPrograms = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_programs_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setReferenceData((prev) => ({ ...prev, programs: response.data.programs || [] }));
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_reference_data`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setReferenceData({
        departments: response.data.departments || [],
        school_years: response.data.school_years || [],
      });
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  };

  const fetchCurriculum = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_curricula_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const curriculum = (response.data.curricula || []).find((c) => c.id === curriculumId);
      if (curriculum) {
        setFormData({
          name: curriculum.name || '',
          code: curriculum.code || '',
          department_id: curriculum.department_id ? String(curriculum.department_id) : '',
          program_id: curriculum.program_id ? String(curriculum.program_id) : '',
          effective_school_year_id: curriculum.effective_school_year_id
            ? String(curriculum.effective_school_year_id)
            : '',
          description: curriculum.description || '',
          status: curriculum.status || 'active',
        });
      } else {
        Alert.alert(t('common.error', 'Error'), t('curriculum_form.not_found', 'Curriculum not found'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching curriculum:', error);
      Alert.alert(t('common.error', 'Error'), t('curriculum_form.load_error', 'Failed to load curriculum'));
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectOption = (field, value) => {
    updateField(field, value);
    setActiveModal(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('curriculum_form.name_required', 'Curriculum name is required'));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');

      const payload = {
        name: formData.name,
        code: formData.code || null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        program_id: formData.program_id ? parseInt(formData.program_id) : null,
        effective_school_year_id: formData.effective_school_year_id
          ? parseInt(formData.effective_school_year_id)
          : null,
        description: formData.description || null,
        status: formData.status,
      };

      if (isEditing) {
        await axios.post(
          `${API_BASE_URL}/admin_curricula_update`,
          { curriculum_id: curriculumId, ...payload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert(t('curriculum_form.success', 'Success'), t('curriculum_form.updated_message', 'Curriculum updated successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => navigation.goBack() },
        ]);
      } else {
        await axios.post(`${API_BASE_URL}/admin_curricula_create`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        Alert.alert(t('curriculum_form.success', 'Success'), t('curriculum_form.created_message', 'Curriculum created successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving curriculum:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || t('curriculum_form.save_error', 'Failed to save curriculum');
      Alert.alert(t('common.error', 'Error'), errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    switch (field) {
      case 'department_id':
        return (
          referenceData.departments.find((d) => d.id === parseInt(formData.department_id))?.name ||
          t('common.none', 'None')
        );
      case 'program_id':
        return (
          referenceData.programs.find((p) => p.id === parseInt(formData.program_id))?.name ||
          t('common.none', 'None')
        );
      case 'effective_school_year_id': {
        const sy = referenceData.school_years.find(
          (s) => s.id === parseInt(formData.effective_school_year_id)
        );
        return sy?.session_title || sy?.title || sy?.name || t('curriculum_form.not_set', 'Not set');
      }
      case 'status':
        return statusLabel(formData.status);
      default:
        return formData[field] || t('curriculum_form.select_placeholder', 'Select...');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <GlassBackground variant="canvas" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isEditing ? t('curriculum_form.edit_title', 'Edit Curriculum') : t('curriculum_form.create_title', 'Create Curriculum')}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.name_label', 'Curriculum Name *')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('curriculum_form.name_placeholder', 'e.g., STEM Track')}
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.code_label', 'Code')}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., STEM"
            value={formData.code}
            onChangeText={(text) => updateField('code', text.toUpperCase())}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.department_label', 'Department')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('department_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('department_id')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.program_label', 'Program')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('program_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('program_id')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.effective_year_label', 'Effective School Year')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('effective_school_year_id')}
          >
            <Text style={styles.selectButtonText}>
              {getDisplayValue('effective_school_year_id')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.description_label', 'Description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('curriculum_form.description_placeholder', 'Optional description')}
            value={formData.description}
            onChangeText={(text) => updateField('description', text)}
            multiline
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('curriculum_form.status_label', 'Status')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('status')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('status')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.onAccent} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditing ? t('curriculum_form.save_changes', 'Save Changes') : t('curriculum_form.create_title', 'Create Curriculum')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* Department modal */}
      <Modal
        visible={activeModal === 'department_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('curriculum_form.select_department', 'Select Department')}</Text>
            <FlatList
              data={referenceData.departments}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('department_id', String(item.id))}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.modalEmptyText}>{t('curriculum_form.no_departments_found', 'No departments found')}</Text>
              }
            />
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => handleSelectOption('department_id', '')}
            >
              <Text style={[styles.modalItemText, { color: theme.danger }]}>{t('curriculum_form.clear_selection', 'Clear selection')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Program modal */}
      <Modal
        visible={activeModal === 'program_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('curriculum_form.select_program', 'Select Program')}</Text>
            <FlatList
              data={referenceData.programs}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('program_id', String(item.id))}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.modalEmptyText}>{t('curriculum_form.no_programs_found', 'No programs found')}</Text>
              }
            />
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => handleSelectOption('program_id', '')}
            >
              <Text style={[styles.modalItemText, { color: theme.danger }]}>{t('curriculum_form.clear_selection', 'Clear selection')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* School Year modal */}
      <Modal
        visible={activeModal === 'effective_school_year_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('curriculum_form.select_effective_year', 'Select Effective School Year')}</Text>
            <FlatList
              data={referenceData.school_years}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() =>
                    handleSelectOption('effective_school_year_id', String(item.id))
                  }
                >
                  <Text style={styles.modalItemText}>
                    {item.session_title || item.title || item.name}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.modalEmptyText}>{t('curriculum_form.no_school_years_found', 'No school years found')}</Text>
              }
            />
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => handleSelectOption('effective_school_year_id', '')}
            >
              <Text style={[styles.modalItemText, { color: theme.danger }]}>{t('curriculum_form.clear_selection', 'Clear selection')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status modal */}
      <Modal
        visible={activeModal === 'status'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('curriculum_form.select_status', 'Select Status')}</Text>
            {STATUSES.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.modalItem}
                onPress={() => handleSelectOption('status', status)}
              >
                <Text style={styles.modalItemText}>{statusLabel(status)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </>
  );
};

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: theme.surface,
    color: theme.textPrimary,
  },
  textArea: {
    textAlignVertical: 'top',
    height: 100,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    justifyContent: 'center',
  },
  selectButtonText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  submitButton: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.surfaceVariant,
  },
  modalItemText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  modalEmptyText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalCloseButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent,
  },
});

export default CurriculumFormScreen;
