import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Svg, { Polyline } from 'react-native-svg';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const ClassDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { classId } = route.params;
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';

  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchClassDetail();
    }, [classId, token])
  );

  const fetchClassDetail = async ({ silent = false } = {}) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_detail`,
        { class_id: classId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setClassData(response.data.class);
    } catch (error) {
      console.error('Error fetching class detail:', error);
      Alert.alert('Error', 'Failed to load class details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClassDetail({ silent: true });
  };

  const handleArchiveClass = async () => {
    Alert.alert(
      'Archive Class',
      'Are you sure you want to archive this class?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              setActionLoading(true);

              await axios.post(
                `${API_BASE_URL}/admin_classes_archive`,
                { class_id: classId },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              Alert.alert('Success', 'Class archived successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error archiving class:', error);
              Alert.alert('Error', 'Failed to archive class');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleDeleteClass = async () => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setActionLoading(true);

              await axios.post(
                `${API_BASE_URL}/admin_classes_delete`,
                { class_id: classId },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              Alert.alert('Success', 'Class deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting class:', error);
              Alert.alert('Error', 'Failed to delete class');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleRestoreClass = async () => {
    try {
      setActionLoading(true);

      await axios.post(
        `${API_BASE_URL}/admin_classes_restore`,
        { class_id: classId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', 'Class restored successfully');
      fetchClassDetail();
    } catch (error) {
      console.error('Error restoring class:', error);
      Alert.alert('Error', 'Failed to restore class');
    } finally {
      setActionLoading(false);
    }
  };

  const openDuplicateModal = () => {
    setNewClassCode(classData?.class_code ? `${classData.class_code}-COPY` : '');
    setNewClassName(classData?.name ? `${classData.name} (Copy)` : '');
    setDuplicateModalVisible(true);
  };

  const handleDuplicateClass = async () => {
    if (!newClassCode.trim() || !newClassName.trim()) {
      Alert.alert('Missing info', 'Please enter both a class code and a name for the copy.');
      return;
    }

    try {
      setActionLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_duplicate`,
        {
          class_id: classId,
          new_class_code: newClassCode.trim(),
          new_name: newClassName.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setDuplicateModalVisible(false);
      const newClass = response.data.class;
      Alert.alert('Success', 'Class duplicated successfully', [
        {
          text: 'View Copy',
          onPress: () => newClass?.id && navigation.push('ClassDetail', { classId: newClass.id }),
        },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (error) {
      console.error('Error duplicating class:', error);
      const message = error?.response?.data?.errors?.new_class_code?.[0] || 'Failed to duplicate class';
      Alert.alert('Error', message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.flexContainer}>
        <View style={[styles.navHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navHeaderTitle}>Class Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.container}>
          <View style={styles.headerCard}>
            <Skeleton width={70} height={14} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
            <Skeleton width="55%" height={24} baseColor={theme.skeletonBase} />
          </View>
          {[0, 1, 2].map((key) => (
            <View key={key} style={styles.section}>
              <Skeleton width="40%" height={16} style={{ marginBottom: 14 }} baseColor={theme.skeletonBase} />
              <Skeleton width="100%" height={14} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
              <Skeleton width="100%" height={14} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
              <Skeleton width="70%" height={14} baseColor={theme.skeletonBase} />
            </View>
          ))}
        </View>
        <BottomNavBar />
      </View>
    );
  }

  if (!classData) {
    return (
      <View style={styles.flexContainer}>
        <View style={[styles.navHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navHeaderTitle}>Class Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.container}>
          <EmptyState
            icon="🔍"
            title="Class not found"
            subtitle="It may have been removed, or the link is out of date."
            colors={theme}
          />
        </View>
        <BottomNavBar />
      </View>
    );
  }

  const badge = statusColors(theme, classData.status);
  const occupancyColor =
    classData.enrollment_percentage > 90
      ? theme.danger
      : classData.enrollment_percentage > 75
      ? theme.warning
      : theme.success;

  return (
    <View style={styles.flexContainer}>
      <GlassBackground variant="canvas" />
      <View style={[styles.navHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Class Details</Text>
        <View style={styles.headerSpacer} />
      </View>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.accent}
          colors={[theme.accent]}
        />
      }
    >
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.classCode}>{classData.class_code}</Text>
            <Text style={styles.className}>{classData.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>
              {classData.status}
            </Text>
          </View>
        </View>

        {classData.description && (
          <Text style={styles.description}>{classData.description}</Text>
        )}
      </View>

      {/* Enrollment Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Enrollment</Text>
        <View style={styles.enrollmentCard}>
          <View style={styles.enrollmentStat}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{classData.current_enrollment}</Text>
          </View>
          <View style={styles.enrollmentStat}>
            <Text style={styles.statLabel}>Capacity</Text>
            <Text style={styles.statValue}>{classData.max_capacity}</Text>
          </View>
          <View style={styles.enrollmentStat}>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={styles.statValue}>{classData.available_slots || 0}</Text>
          </View>
          <View style={styles.enrollmentStat}>
            <Text style={styles.statLabel}>Occupancy</Text>
            <Text style={[styles.statValue, { color: occupancyColor }]}>
              {classData.enrollment_percentage || 0}%
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${classData.enrollment_percentage || 0}%`,
                backgroundColor: occupancyColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Basic Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Grade Level:</Text>
          <Text style={styles.infoValue}>{classData.grade_level}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Class Type:</Text>
          <Text style={styles.infoValue}>{classData.class_type}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Shift:</Text>
          <Text style={styles.infoValue}>{classData.shift}</Text>
        </View>

        {classData.department && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Department:</Text>
            <Text style={styles.infoValue}>{classData.department}</Text>
          </View>
        )}

        {classData.curriculum && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Curriculum:</Text>
            <Text style={styles.infoValue}>{classData.curriculum}</Text>
          </View>
        )}

        {classData.section && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Section:</Text>
            <Text style={styles.infoValue}>{classData.section}</Text>
          </View>
        )}
      </View>

      {/* Location Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>

        {classData.room_number && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Room Number:</Text>
            <Text style={styles.infoValue}>{classData.room_number}</Text>
          </View>
        )}

        {classData.building && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Building:</Text>
            <Text style={styles.infoValue}>{classData.building}</Text>
          </View>
        )}

        {classData.floor && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Floor:</Text>
            <Text style={styles.infoValue}>{classData.floor}</Text>
          </View>
        )}
      </View>

      {/* Academic Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academic Information</Text>

        {classData.school_year && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>School Year:</Text>
            <Text style={styles.infoValue}>{classData.school_year}</Text>
          </View>
        )}

        {classData.semester_term && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Semester/Term:</Text>
            <Text style={styles.infoValue}>{classData.semester_term}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Start Date:</Text>
          <Text style={styles.infoValue}>{classData.start_date}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>End Date:</Text>
          <Text style={styles.infoValue}>{classData.end_date}</Text>
        </View>
      </View>

      {/* Admin Actions */}
      {isAdminRole && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditClass', { classId })}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Edit Class</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('SectionList', { classId })}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Manage Students</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={openDuplicateModal}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Duplicate Class</Text>
          </TouchableOpacity>

          {classData.status === 'archived' ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.successButton]}
              onPress={handleRestoreClass}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>Restore Class</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.warningButton]}
              onPress={handleArchiveClass}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>Archive Class</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleDeleteClass}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>Delete Class</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metadata</Text>

        {classData.created_by && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created By:</Text>
            <Text style={styles.infoValue}>{classData.created_by}</Text>
          </View>
        )}

        {classData.created_at && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created At:</Text>
            <Text style={styles.infoValue}>{classData.created_at}</Text>
          </View>
        )}

        {classData.updated_by && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Updated By:</Text>
            <Text style={styles.infoValue}>{classData.updated_by}</Text>
          </View>
        )}

        {classData.updated_at && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Updated At:</Text>
            <Text style={styles.infoValue}>{classData.updated_at}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomSpacer} />
      </ScrollView>
      <BottomNavBar />

      <Modal visible={duplicateModalVisible} transparent animationType="fade" onRequestClose={() => setDuplicateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Duplicate Class</Text>
            <Text style={styles.modalLabel}>New Class Code</Text>
            <TextInput
              style={styles.modalInput}
              value={newClassCode}
              onChangeText={setNewClassCode}
              placeholder="e.g. G7-A-2027"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
            />
            <Text style={styles.modalLabel}>New Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newClassName}
              onChangeText={setNewClassName}
              placeholder="e.g. Grade 7 - Section A"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setDuplicateModalVisible(false)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleDuplicateClass}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={theme.onAccent} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Duplicate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    flexContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    navHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    navHeaderTitle: {
      flex: 1,
      marginLeft: 8,
      fontSize: 17,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    backButton: {
      width: 32,
    },
    headerSpacer: {
      width: 32,
    },
    headerCard: {
      backgroundColor: theme.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    classCode: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.accentSoftText,
      marginBottom: 4,
    },
    className: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    section: {
      backgroundColor: theme.surface,
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    enrollmentCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    enrollmentStat: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.surfaceVariant,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    infoValue: {
      fontSize: 14,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    actionButton: {
      backgroundColor: theme.accent,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 8,
    },
    secondaryButton: {
      backgroundColor: theme.scheme === 'dark' ? '#4c46c9' : '#6366f1',
    },
    warningButton: {
      backgroundColor: theme.warning,
    },
    successButton: {
      backgroundColor: theme.success,
    },
    dangerButton: {
      backgroundColor: theme.danger,
    },
    actionButtonText: {
      color: theme.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
    bottomSpacer: {
      height: 20,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 20,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 16,
    },
    modalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      marginBottom: 14,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    modalButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      marginLeft: 10,
      minWidth: 90,
      alignItems: 'center',
    },
    modalCancelButton: {
      backgroundColor: theme.surfaceVariant,
    },
    modalCancelText: {
      color: theme.textPrimary,
      fontWeight: '600',
    },
    modalConfirmButton: {
      backgroundColor: theme.accent,
    },
    modalConfirmText: {
      color: theme.onAccent,
      fontWeight: '600',
    },
  });

export default ClassDetailScreen;
