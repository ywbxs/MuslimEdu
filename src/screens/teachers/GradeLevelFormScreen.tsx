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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/api';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

const EDUCATION_STAGES = ['elementary', 'junior_high', 'senior_high', 'college', 'graduate'];
const STATUSES = ['active', 'inactive'];

const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Create + edit in one screen, same pattern as CampusFormScreen.tsx.
const GradeLevelFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const statusLabel = (status: string) => t(`grade_level_form.status_${status}`, labelize(status));
  const stageLabel = (stage: string) => t(`grade_level_form.stage_${stage}`, labelize(stage));
  const gradeLevelId = route.params?.gradeLevelId;
  const isEditing = !!gradeLevelId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    code: '',
    education_stage: '',
    level_order: '',
    status: 'active',
  });

  useEffect(() => {
    if (isEditing) {
      fetchGradeLevel();
    }
  }, []);

  const fetchGradeLevel = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_grade_levels_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const gradeLevel = (response.data.grade_levels || []).find((g) => g.id === gradeLevelId);
      if (gradeLevel) {
        setFormData({
          name: gradeLevel.name || '',
          name_ar: gradeLevel.name_ar || '',
          code: gradeLevel.code || '',
          education_stage: gradeLevel.education_stage || '',
          level_order: gradeLevel.level_order != null ? String(gradeLevel.level_order) : '',
          status: gradeLevel.status || 'active',
        });
      } else {
        Alert.alert(t('common.error', 'Error'), t('grade_level_form.not_found', 'Grade level not found'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching grade level:', error);
      Alert.alert(t('common.error', 'Error'), t('grade_level_form.load_error', 'Failed to load grade level'));
    } finally {
      setLoading(false);
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
      Alert.alert(t('common.error', 'Error'), t('grade_level_form.name_required', 'Grade level name is required'));
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
        name_ar: formData.name_ar || null,
        code: formData.code || null,
        education_stage: formData.education_stage || null,
        level_order: formData.level_order !== '' ? parseInt(formData.level_order, 10) : null,
        status: formData.status,
      };

      if (isEditing) {
        await axios.post(
          `${API_BASE_URL}/admin_grade_levels_update`,
          { grade_level_id: gradeLevelId, ...payload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert(t('grade_level_form.success', 'Success'), t('grade_level_form.updated_message', 'Grade level updated successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => navigation.goBack() },
        ]);
      } else {
        await axios.post(`${API_BASE_URL}/admin_grade_levels_create`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        Alert.alert(t('grade_level_form.success', 'Success'), t('grade_level_form.created_message', 'Grade level created successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving grade level:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || t('grade_level_form.save_error', 'Failed to save grade level');
      Alert.alert(t('common.error', 'Error'), errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    switch (field) {
      case 'status':
        return statusLabel(formData.status);
      case 'education_stage':
        return formData.education_stage ? stageLabel(formData.education_stage) : t('grade_level_form.select_placeholder', 'Select...');
      default:
        return formData[field] || t('grade_level_form.select_placeholder', 'Select...');
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
            {isEditing ? t('grade_level_form.edit_title', 'Edit Grade Level') : t('grade_level_form.create_title', 'Create Grade Level')}
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.name_label', 'Grade Level Name *')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('grade_level_form.name_placeholder', 'e.g., Grade 5')}
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.arabic_name_label', 'Arabic Name')}</Text>
            <TextInput
              style={styles.input}
              placeholder="الاسم بالعربية"
              value={formData.name_ar}
              onChangeText={(text) => updateField('name_ar', text)}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.code_label', 'Code')}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., G5"
              value={formData.code}
              onChangeText={(text) => updateField('code', text.toUpperCase())}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.stage_label', 'Educational Stage')}</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setActiveModal('education_stage')}
            >
              <Text style={styles.selectButtonText}>{getDisplayValue('education_stage')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.order_label', 'Display Order')}</Text>
            <Text style={styles.helperText}>{t('grade_level_form.order_hint', 'Lower numbers appear first in lists. Leave blank to add to the end.')}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5"
              value={formData.level_order}
              onChangeText={(text) => updateField('level_order', text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('grade_level_form.status_label', 'Status')}</Text>
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
                {isEditing ? t('grade_level_form.save_changes', 'Save Changes') : t('grade_level_form.create_title', 'Create Grade Level')}
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

        {/* Educational stage modal */}
        <Modal
          visible={activeModal === 'education_stage'}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('grade_level_form.select_stage', 'Select Educational Stage')}</Text>
              {EDUCATION_STAGES.map((stage) => (
                <TouchableOpacity
                  key={stage}
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('education_stage', stage)}
                >
                  <Text style={styles.modalItemText}>{stageLabel(stage)}</Text>
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

        {/* Status modal */}
        <Modal
          visible={activeModal === 'status'}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('grade_level_form.select_status', 'Select Status')}</Text>
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
    helperText: {
      fontSize: 12,
      color: theme.textSecondary,
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

export default GradeLevelFormScreen;
