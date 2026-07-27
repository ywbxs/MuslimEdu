import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Svg, { Polyline } from 'react-native-svg';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
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

// Sibling to DepartmentListScreen.tsx - same layout/styling/theme conventions.
const CurriculumListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';

  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  useFocusEffect(
    useCallback(() => {
      fetchCurricula();
    }, [searchTerm, statusFilter, token])
  );

  const fetchCurricula = async () => {
    if (!token) return;
    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/admin_curricula_list`,
        {
          search: searchTerm,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setCurricula(response.data.curricula || []);
    } catch (error) {
      console.error('Error fetching curricula:', error);
      Alert.alert('Error', 'Failed to load curricula');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCurricula();
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    setTimeout(() => {
      fetchCurricula();
    }, 300);
  };

  const handleCurriculumPress = (curriculumId) => {
    navigation.navigate('CurriculumForm', { curriculumId });
  };

  const handleDelete = (curriculum) => {
    Alert.alert(
      'Delete Curriculum',
      `Delete "${curriculum.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(
                `${API_BASE_URL}/admin_curricula_delete`,
                { curriculum_id: curriculum.id },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              fetchCurricula();
            } catch (error) {
              const msg = error.response?.data?.message || 'Failed to delete curriculum';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const renderCurriculumCard = ({ item }) => {
    const badge = statusColors(theme, item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCurriculumPress(item.id)}
      >
        <View style={styles.cardHeader}>
          {item.code ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {item.status}
          </Text>
        </View>

        <Text style={styles.name}>{item.name}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Department:</Text>
          <Text style={styles.value}>{item.department_name || 'None'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Effective Year:</Text>
          <Text style={styles.value}>{item.effective_school_year_name || 'Not set'}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>{item.classes_count} classes</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCurriculumPress(item.id)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={60} height={20} borderRadius={6} baseColor={theme.skeletonBase} />
        <Skeleton width={50} height={16} borderRadius={4} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width="55%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width="70%" height={12} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <View style={{ flexDirection: 'row' }}>
        <Skeleton width={80} height={22} borderRadius={12} baseColor={theme.skeletonBase} />
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Curricula</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>
          {[0, 1, 2].map(renderSkeletonCard)}
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Curricula</Text>
        {isAdminRole ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CurriculumForm')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search curriculum name or code..."
          value={searchTerm}
          onChangeText={handleSearch}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'inactive', 'all'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              statusFilter === status && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === status && styles.filterButtonTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={{ flex: 1 }}
        data={curricula}
        renderItem={renderCurriculumCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📘"
            title="No curricula found"
            subtitle={
              searchTerm
                ? `Nothing matches "${searchTerm}".`
                : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}curricula yet.`
            }
            colors={theme}
          />
        }
      />
      <BottomNavBar />
    </View>
  );
};

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
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
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerTitleFlex: {
      flex: 1,
      marginLeft: 8,
    },
    backButton: {
      width: 32,
    },
    headerSpacer: {
      width: 32,
    },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addButtonText: {
      color: theme.onAccent,
      fontWeight: '600',
      fontSize: 14,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    searchInput: {
      height: 46,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 18,
      fontSize: 14.5,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
      ...theme.elevation1,
    },
    filterBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    filterButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      marginRight: 8,
    },
    filterButtonActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterButtonText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: theme.onAccent,
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    codeBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    codeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.accentSoftText,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: 'hidden',
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    value: {
      fontSize: 12,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 6,
      marginBottom: 12,
    },
    statChip: {
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    statChipText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    actionButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 8,
    },
    actionButtonText: {
      color: theme.onAccent,
      fontSize: 12,
      fontWeight: '600',
    },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 8,
    },
    deleteButtonText: {
      color: theme.danger,
      fontSize: 12,
      fontWeight: '600',
    },
  });

export default CurriculumListScreen;
