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
  FlatList,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../../config/api';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';
import { useLocale } from '../../context/LocaleContext';

const SHIFT_FALLBACKS: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const CLASS_TYPE_FALLBACKS: Record<string, string> = { 'face-to-face': 'Face-to-face', online: 'Online', hybrid: 'Hybrid' };
const STATUS_FALLBACKS: Record<string, string> = { active: 'Active', pending: 'Pending', closed: 'Closed', archived: 'Archived' };

const CreateClassScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const classId = route.params?.classId ?? null;
  const isEditMode = !!classId;
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const shiftLabel = (key: string) => t(`create_class.shift_${key}`, SHIFT_FALLBACKS[key] ?? key);
  const classTypeLabel = (key: string) => t(`create_class.class_type_${key}`, CLASS_TYPE_FALLBACKS[key] ?? key);
  const statusLabel = (key: string) => t(`create_class.status_${key}`, STATUS_FALLBACKS[key] ?? key);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    class_code: '',
    name: '',
    grade_level: '',
    section: '',
    school_year_id: '',
    department_id: '',
    campus_id: '',
    curriculum_id: '',
    semester_term_id: '',
    room_number: '',
    building: '',
    floor: '',
    shift: 'morning',
    class_type: 'face-to-face',
    max_capacity: '50',
    description: '',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [referenceData, setReferenceData] = useState({
    departments: [],
    campuses: [],
    curricula: [],
    school_years: [],
    semester_terms: [],
  });

  const [dropdowns, setDropdowns] = useState({
    shifts: ['morning', 'afternoon', 'evening'],
    class_types: ['face-to-face', 'online', 'hybrid'],
    statuses: ['active', 'pending', 'closed', 'archived'],
  });

  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      setLoading(true);
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
        campuses: response.data.campuses || [],
        curricula: response.data.curricula || [],
        school_years: response.data.school_years || [],
        semester_terms: response.data.semester_terms || [],
      });

      if (isEditMode) {
        const detailResponse = await axios.post(
          `${API_BASE_URL}/admin_classes_detail`,
          { class_id: classId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const c = detailResponse.data.class;
        setFormData({
          class_code: c.class_code ?? '',
          name: c.name ?? '',
          grade_level: c.grade_level ? String(c.grade_level) : '',
          section: c.section ?? '',
          school_year_id: c.school_year_id ? String(c.school_year_id) : '',
          department_id: c.department_id ? String(c.department_id) : '',
          campus_id: c.campus_id ? String(c.campus_id) : '',
          curriculum_id: c.curriculum_id ? String(c.curriculum_id) : '',
          semester_term_id: c.semester_term_id ? String(c.semester_term_id) : '',
          room_number: c.room_number ?? '',
          building: c.building ?? '',
          floor: c.floor ?? '',
          shift: c.shift ?? 'morning',
          class_type: c.class_type ?? 'face-to-face',
          max_capacity: c.max_capacity ? String(c.max_capacity) : '50',
          description: c.description ?? '',
          status: c.status ?? 'active',
          start_date: c.start_date ?? new Date().toISOString().split('T')[0],
          end_date: c.end_date ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error('Error fetching reference data:', error);
      Alert.alert(t('common.error', 'Error'), isEditMode ? t('create_class.load_detail_error', 'Failed to load class details') : t('create_class.load_reference_error', 'Failed to load reference data'));
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectOption = (field, value) => {
    updateField(field, value);
    setActiveModal(null);
  };

  const validateForm = () => {
    if (!formData.class_code.trim()) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_class_code', 'Class code is required'));
      return false;
    }
    if (!formData.name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_class_name', 'Class name is required'));
      return false;
    }
    if (!formData.grade_level) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_grade_level', 'Grade level is required'));
      return false;
    }
    if (!formData.school_year_id) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_school_year', 'School year is required'));
      return false;
    }
    if (!formData.max_capacity || parseInt(formData.max_capacity) < 1) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_max_capacity', 'Max capacity must be greater than 0'));
      return false;
    }
    if (formData.start_date > formData.end_date) {
      Alert.alert(t('common.error', 'Error'), t('create_class.error_date_order', 'Start date cannot be after end date'));
      return false;
    }
    return true;
  };

  const handleCreateClass = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');

      const payload = {
        ...formData,
        grade_level: parseInt(formData.grade_level),
        max_capacity: parseInt(formData.max_capacity),
        department_id: formData.department_id || null,
        campus_id: formData.campus_id || null,
        curriculum_id: formData.curriculum_id || null,
        semester_term_id: formData.semester_term_id || null,
      };

      if (isEditMode) {
        await axios.post(
          `${API_BASE_URL}/admin_classes_update`,
          { ...payload, class_id: classId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        Alert.alert(t('common.success', 'Success'), t('create_class.update_success', 'Class updated successfully'), [
          {
            text: t('common.ok', 'OK'),
            onPress: () => navigation.navigate('ClassDetail', { classId }),
          },
        ]);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_create`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert(t('common.success', 'Success'), t('create_class.create_success', 'Class created successfully'), [
        {
          text: t('common.ok', 'OK'),
          onPress: () => {
            navigation.navigate('ClassDetail', { classId: response.data.class.id });
          },
        },
      ]);
    } catch (error) {
      console.error(isEditMode ? 'Error updating class:' : 'Error creating class:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || (isEditMode ? t('create_class.update_error', 'Failed to update class') : t('create_class.create_error', 'Failed to create class'));
      Alert.alert(t('common.error', 'Error'), errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    const value = formData[field];
    const selectPlaceholder = t('create_class.select_placeholder', 'Select...');
    if (!value) return selectPlaceholder;

    switch (field) {
      case 'department_id':
        return referenceData.departments.find((d) => d.id === parseInt(value))?.name || selectPlaceholder;
      case 'campus_id':
        return referenceData.campuses.find((c) => c.id === parseInt(value))?.name || selectPlaceholder;
      case 'curriculum_id':
        return referenceData.curricula.find((c) => c.id === parseInt(value))?.name || selectPlaceholder;
      case 'school_year_id':
        return referenceData.school_years.find((sy) => sy.id === parseInt(value))?.title
          || referenceData.school_years.find((sy) => sy.id === parseInt(value))?.name
          || selectPlaceholder;
      case 'semester_term_id':
        return referenceData.semester_terms.find((st) => st.id === parseInt(value))?.name || selectPlaceholder;
      default:
        return value;
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
        <Text style={styles.headerTitle}>{isEditMode ? t('create_class.edit_title', 'Edit Class') : t('create_class.create_title', 'Create New Class')}</Text>
      </View>

      <View style={styles.formContainer}>
        {/* Class Code */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.class_code_label', 'Class Code *')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.class_code_placeholder', 'e.g., 9-A-2024')}
            value={formData.class_code}
            onChangeText={(text) => updateField('class_code', text.toUpperCase())}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Class Name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.class_name_label', 'Class Name *')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.class_name_placeholder', 'e.g., Class 9-A')}
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Grade Level */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.grade_level_label', 'Grade Level *')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.grade_level_placeholder', '1-12')}
            value={formData.grade_level}
            onChangeText={(text) => updateField('grade_level', text)}
            keyboardType="number-pad"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Section */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.section_label', 'Section')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.section_placeholder', 'e.g., A')}
            value={formData.section}
            onChangeText={(text) => updateField('section', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* School Year */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.school_year_label', 'School Year *')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('school_year_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('school_year_id')}</Text>
          </TouchableOpacity>
        </View>

        {/* Department */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.department_label', 'Department')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('department_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('department_id')}</Text>
          </TouchableOpacity>
        </View>

        {/* Campus */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.campus_label', 'Campus')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('campus_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('campus_id')}</Text>
          </TouchableOpacity>
        </View>

        {/* Curriculum */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.curriculum_label', 'Curriculum')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('curriculum_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('curriculum_id')}</Text>
          </TouchableOpacity>
        </View>

        {/* Semester/Term */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.semester_term_label', 'Semester/Term')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('semester_term_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('semester_term_id')}</Text>
          </TouchableOpacity>
        </View>

        {/* Shift */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.shift_label', 'Shift *')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('shift')}
          >
            <Text style={styles.selectButtonText}>
              {shiftLabel(formData.shift)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Class Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.class_type_label', 'Class Type *')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('class_type')}
          >
            <Text style={styles.selectButtonText}>
              {classTypeLabel(formData.class_type)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Max Capacity */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.max_capacity_label', 'Max Capacity *')}</Text>
          <TextInput
            style={styles.input}
            placeholder="50"
            value={formData.max_capacity}
            onChangeText={(text) => updateField('max_capacity', text)}
            keyboardType="number-pad"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Status */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.status_label', 'Status *')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('status')}
          >
            <Text style={styles.selectButtonText}>
              {statusLabel(formData.status)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Room Number */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.room_number_label', 'Room Number')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.room_number_placeholder', 'e.g., A101')}
            value={formData.room_number}
            onChangeText={(text) => updateField('room_number', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Building */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.building_label', 'Building')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.building_placeholder', 'e.g., Building A')}
            value={formData.building}
            onChangeText={(text) => updateField('building', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Floor */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.floor_label', 'Floor')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('create_class.floor_placeholder', 'e.g., 1st Floor')}
            value={formData.floor}
            onChangeText={(text) => updateField('floor', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Start Date */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.start_date_label', 'Start Date *')}</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={formData.start_date}
            onChangeText={(text) => updateField('start_date', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* End Date */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.end_date_label', 'End Date *')}</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={formData.end_date}
            onChangeText={(text) => updateField('end_date', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('create_class.description_label', 'Description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('create_class.description_placeholder', 'Add notes or description')}
            value={formData.description}
            onChangeText={(text) => updateField('description', text)}
            multiline
            numberOfLines={4}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleCreateClass}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.onAccent} />
          ) : (
            <Text style={styles.submitButtonText}>{isEditMode ? t('common.save_changes', 'Save Changes') : t('create_class.create_class', 'Create Class')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdowns Modals */}
      <KeyboardAwareModal
        visible={activeModal === 'department_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_department', 'Select Department')}</Text>
            <FlatList
              data={referenceData.departments}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('department_id', item.id)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'campus_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_campus', 'Select Campus')}</Text>
            <FlatList
              data={referenceData.campuses}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('campus_id', item.id)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'curriculum_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_curriculum', 'Select Curriculum')}</Text>
            <FlatList
              data={referenceData.curricula}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('curriculum_id', item.id)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'school_year_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_school_year', 'Select School Year')}</Text>
            <FlatList
              data={referenceData.school_years}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('school_year_id', item.id)}
                >
                  <Text style={styles.modalItemText}>{item.title || item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'shift'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_shift', 'Select Shift')}</Text>
            {dropdowns.shifts.map((shift) => (
              <TouchableOpacity
                key={shift}
                style={styles.modalItem}
                onPress={() => handleSelectOption('shift', shift)}
              >
                <Text style={styles.modalItemText}>
                  {shiftLabel(shift)}
                </Text>
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
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'class_type'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_class_type', 'Select Class Type')}</Text>
            {dropdowns.class_types.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.modalItem}
                onPress={() => handleSelectOption('class_type', type)}
              >
                <Text style={styles.modalItemText}>
                  {classTypeLabel(type)}
                </Text>
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
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={activeModal === 'status'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('create_class.select_status', 'Select Status')}</Text>
            {dropdowns.statuses.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.modalItem}
                onPress={() => handleSelectOption('status', status)}
              >
                <Text style={styles.modalItemText}>
                  {statusLabel(status)}
                </Text>
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
      </KeyboardAwareModal>
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
    color: theme.onAccent,
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

export default CreateClassScreen;
