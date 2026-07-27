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

const STATUSES = ['active', 'inactive'];
const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Sibling to DepartmentFormScreen.tsx / CurriculumFormScreen.tsx.
//
// One thing that's different here: admin_sections_update doesn't accept
// class_id (a section can't be moved to a different class after creation -
// see ApiController.php admin_sections_update, only name/class_teacher_id/
// capacity/room_number/status are in the updatable field list). So the
// class picker only appears when creating a new section; once a section
// exists, its class is shown read-only.
const SectionFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sectionId = route.params?.sectionId;
  const presetClassId = route.params?.classId;
  const isEditing = !!sectionId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [className, setClassName] = useState(''); // display-only when editing

  const [formData, setFormData] = useState({
    class_id: presetClassId ? String(presetClassId) : '',
    name: '',
    class_teacher_id: '',
    capacity: '',
    room_number: '',
    status: 'active',
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    await Promise.all([fetchClasses(), fetchTeachers()]);
    if (isEditing) {
      await fetchSection();
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_list`,
        { per_page: 500, sort_by: 'name', sort_order: 'asc' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setClasses(response.data.classes || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Reused, same as DepartmentFormScreen's head-of-department picker.
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

  const fetchSection = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_sections_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const section = (response.data.sections || []).find((s) => s.id === sectionId);
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
        Alert.alert('Error', 'Section not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching section:', error);
      Alert.alert('Error', 'Failed to load section');
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
    if (!isEditing && !formData.class_id) {
      Alert.alert('Error', 'Please select a class');
      return false;
    }
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Section name is required');
      return false;
    }
    if (formData.capacity && parseInt(formData.capacity) < 1) {
      Alert.alert('Error', 'Capacity must be greater than 0');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');

      const sharedPayload = {
        name: formData.name,
        class_teacher_id: formData.class_teacher_id
          ? parseInt(formData.class_teacher_id)
          : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        room_number: formData.room_number || null,
        status: formData.status,
      };

      if (isEditing) {
        await axios.post(
          `${API_BASE_URL}/admin_sections_update`,
          { section_id: sectionId, ...sharedPayload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert('Success', 'Section updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await axios.post(
          `${API_BASE_URL}/admin_sections_create`,
          { class_id: parseInt(formData.class_id), ...sharedPayload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert('Success', 'Section created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving section:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || 'Failed to save section';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    switch (field) {
      case 'class_id':
        return classes.find((c) => c.id === parseInt(formData.class_id))?.name || 'Select...';
      case 'class_teacher_id':
        return (
          teachers.find((t) => t.id === parseInt(formData.class_teacher_id))?.name ||
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
          {isEditing ? 'Edit Section' : 'Create Section'}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Class *</Text>
          {isEditing ? (
            <View style={[styles.selectButton, styles.selectButtonDisabled]}>
              <Text style={styles.selectButtonText}>{className || 'Unknown'}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setActiveModal('class_id')}
            >
              <Text style={styles.selectButtonText}>{getDisplayValue('class_id')}</Text>
            </TouchableOpacity>
          )}
          {isEditing && (
            <Text style={styles.hint}>A section's class can't be changed after creation.</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Section Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., A"
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Adviser</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setActiveModal('class_teacher_id')}
          >
            <Text style={styles.selectButtonText}>{getDisplayValue('class_teacher_id')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 40"
            value={formData.capacity}
            onChangeText={(text) => updateField('capacity', text)}
            keyboardType="number-pad"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Room Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 204"
            value={formData.room_number}
            onChangeText={(text) => updateField('room_number', text)}
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
              {isEditing ? 'Save Changes' : 'Create Section'}
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

      {/* Class modal (create only) */}
      <Modal
        visible={activeModal === 'class_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Class</Text>
            <FlatList
              data={classes}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('class_id', String(item.id))}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.modalEmptyText}>No classes found</Text>
              }
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

      {/* Adviser modal */}
      <Modal
        visible={activeModal === 'class_teacher_id'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Adviser</Text>
            <FlatList
              data={teachers}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectOption('class_teacher_id', String(item.id))}
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
              onPress={() => handleSelectOption('class_teacher_id', '')}
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
  hint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 6,
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
  selectButtonDisabled: {
    backgroundColor: theme.surfaceVariant,
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

export default SectionFormScreen;
