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
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

const SCHOOL_LEVELS = ['elementary', 'junior_high', 'senior_high', 'college', 'graduate', 'faculty', 'institute'];
const STATUSES = ['active', 'inactive'];

const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Create + edit in one screen, same as the pattern CreateClassScreen set for
// the module: modal-based pickers for anything that isn't free text.
const DepartmentFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const departmentId = route.params?.departmentId;
  const isEditing = !!departmentId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [activeModal, setActiveModal] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    school_level: '',
    campus_id: '',
    faculty_id: '',
    head_of_department_id: '',
    status: 'active',
  });

  useEffect(() => {
    fetchTeachers();
    fetchCampuses();
    fetchFaculties();
    if (isEditing) {
      fetchDepartment();
    }
  }, []);

  const fetchFaculties = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_faculty_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setFaculties(response.data.faculties || []);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_campuses_list`,
        { status: 'active' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setCampuses(response.data.campuses || []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Reuses the existing class-teacher-assign endpoint purely for its
      // "eligible teachers" list - same id/name shape we need here.
      const response = await axios.post(
        `${API_BASE_URL}/admin_class_teacher_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setTeachers(response.data.teachers || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const fetchDepartment = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_departments_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const dept = (response.data.departments || []).find((d) => d.id === departmentId);
      if (dept) {
        setFormData({
          name: dept.name || '',
          code: dept.code || '',
          description: dept.description || '',
          school_level: dept.school_level || '',
          campus_id: dept.campus_id ? String(dept.campus_id) : '',
          faculty_id: dept.faculty_id ? String(dept.faculty_id) : '',
          head_of_department_id: dept.head_of_department_id ? String(dept.head_of_department_id) : '',
          status: dept.status || 'active',
        });
      } else {
        Alert.alert('Error', 'Department not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching department:', error);
      Alert.alert('Error', 'Failed to load department');
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
      Alert.alert('Error', 'Department name is required');
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
        description: formData.description || null,
        school_level: formData.school_level || null,
        campus_id: formData.campus_id ? parseInt(formData.campus_id) : null,
        faculty_id: formData.faculty_id ? parseInt(formData.faculty_id) : null,
        head_of_department_id: formData.head_of_department_id
          ? parseInt(formData.head_of_department_id)
          : null,
        status: formData.status,
      };

      if (isEditing) {
        await axios.post(
          `${API_BASE_URL}/admin_departments_update`,
          { department_id: departmentId, ...payload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert('Success', 'Department updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await axios.post(`${API_BASE_URL}/admin_departments_create`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        Alert.alert('Success', 'Department created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving department:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || 'Failed to save department';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    switch (field) {
      case 'school_level':
        return formData.school_level ? labelize(formData.school_level) : 'Select...';
      case 'campus_id':
        return campuses.find((c) => c.id === parseInt(formData.campus_id))?.name || 'Select...';
      case 'faculty_id':
        return faculties.find((f) => f.id === parseInt(formData.faculty_id))?.name || 'None';
      case 'head_of_department_id':
        return (
          teachers.find((t) => t.id === parseInt(formData.head_of_department_id))?.name ||
          'Not assigned'
        );
      case 'status':
        return labelize(formData.status);
      default:
        return formData[field] || 'Select...';
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
          {isEditing ? 'Edit Department' : 'Create Department'}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Department Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mathematics"
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., MATH"
            value={formData.code}
            onChangeText={(text) => updateField('code', text.toUpperCase())}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>School Level</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('school_level')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('school_level')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Campus</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('campus_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('campus_id')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Faculty / College / Institute</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('faculty_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('faculty_id')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Head of Department</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('head_of_department_id')}
          >
            <Text style={styles.selectButtonText}>
              {getDisplayValue('head_of_department_id')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Optional description"
            value={formData.description}
            onChangeText={(text) => updateField('description', text)}
            multiline
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Status</Text>
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
              {isEditing ? 'Save Changes' : 'Create Department'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Campus modal */}
      <Modal
        visible={activeModal === 'campus_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Campus</Text>
            <FlatList
              data={campuses}
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
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Faculty/College/Institute modal */}
      <Modal
        visible={activeModal === 'faculty_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Faculty / College / Institute</Text>
            <FlatList
              data={[{ id: null, name: 'None' }, ...faculties]}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('faculty_id', item.id)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => (item.id === null ? 'none' : item.id.toString())}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* School Level modal */}
      <Modal
        visible={activeModal === 'school_level'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select School Level</Text>
            {SCHOOL_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.modalItem}
                onPress={() => handleSelectOption('school_level', level)}
              >
                <Text style={styles.modalItemText}>{labelize(level)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Head of Department modal */}
      <Modal
        visible={activeModal === 'head_of_department_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Head of Department</Text>
            <FlatList
              data={teachers}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('head_of_department_id', String(item.id))}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.modalEmptyText}>No teachers found</Text>
              }
            />
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => handleSelectOption('head_of_department_id', '')}
            >
              <Text style={[styles.modalItemText, { color: theme.danger }]}>Clear selection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
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
            <Text style={styles.modalTitle}>Select Status</Text>
            {STATUSES.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.modalItem}
                onPress={() => handleSelectOption('status', status)}
              >
                <Text style={styles.modalItemText}>{labelize(status)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
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

export default DepartmentFormScreen;
