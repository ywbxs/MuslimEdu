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
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/api';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

const STATUSES = ['active', 'inactive'];

const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Create + edit in one screen, same pattern as DepartmentFormScreen.tsx.
const CampusFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const campusId = route.params?.campusId;
  const isEditing = !!campusId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    is_main: false,
    status: 'active',
  });

  useEffect(() => {
    if (isEditing) {
      fetchCampus();
    }
  }, []);

  const fetchCampus = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_campuses_list`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const campus = (response.data.campuses || []).find((c) => c.id === campusId);
      if (campus) {
        setFormData({
          name: campus.name || '',
          name_ar: campus.name_ar || '',
          code: campus.code || '',
          address: campus.address || '',
          phone: campus.phone || '',
          email: campus.email || '',
          is_main: !!campus.is_main,
          status: campus.status || 'active',
        });
      } else {
        Alert.alert('Error', 'Campus not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching campus:', error);
      Alert.alert('Error', 'Failed to load campus');
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
      Alert.alert('Error', 'Campus name is required');
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
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        is_main: formData.is_main,
        status: formData.status,
      };

      if (isEditing) {
        await axios.post(
          `${API_BASE_URL}/admin_campuses_update`,
          { campus_id: campusId, ...payload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        Alert.alert('Success', 'Campus updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await axios.post(`${API_BASE_URL}/admin_campuses_create`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        Alert.alert('Success', 'Campus created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving campus:', error);
      const errorMsg = error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join('\n')
        : error.response?.data?.message || 'Failed to save campus';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisplayValue = (field) => {
    switch (field) {
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
            {isEditing ? 'Edit Campus' : 'Create Campus'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Campus Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Main Campus"
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Arabic Name</Text>
            <TextInput
              style={styles.input}
              placeholder="الاسم بالعربية"
              value={formData.name_ar}
              onChangeText={(text) => updateField('name_ar', text)}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., MAIN"
              value={formData.code}
              onChangeText={(text) => updateField('code', text.toUpperCase())}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional address"
              value={formData.address}
              onChangeText={(text) => updateField('address', text)}
              multiline
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional phone"
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
              keyboardType="phone-pad"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional email"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={[styles.formGroup, styles.switchRow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Main Campus</Text>
              <Text style={styles.helperText}>Only one campus per school can be marked main.</Text>
            </View>
            <Switch
              value={formData.is_main}
              onValueChange={(value) => updateField('is_main', value)}
              trackColor={{ false: theme.surfaceVariant, true: theme.accent }}
              thumbColor={theme.surface}
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
                {isEditing ? 'Save Changes' : 'Create Campus'}
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
    helperText: {
      fontSize: 12,
      color: theme.textSecondary,
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
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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

export default CampusFormScreen;
