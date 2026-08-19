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
import { ChevronLeft } from 'lucide-react-native';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';

const labelize = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

// Mirrors CampusListScreen.tsx's structure/styling so Grade Levels feels
// like part of the same Academic Management module. List is server-ordered
// by level_order, so this screen just renders what comes back - dedicated
// drag-to-reorder UI (backed by admin_grade_levels_reorder) is a natural
// follow-up, not included in this first pass.
const GradeLevelListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const { t } = useLocale();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  const statusLabel = (status: string) => t(`grade_level_list.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const [gradeLevels, setGradeLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  useFocusEffect(
    useCallback(() => {
      fetchGradeLevels();
    }, [searchTerm, statusFilter, token])
  );

  const fetchGradeLevels = async () => {
    if (!token) return;
    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/admin_grade_levels_list`,
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

      setGradeLevels(response.data.grade_levels || []);
    } catch (error) {
      console.error('Error fetching grade levels:', error);
      Alert.alert(t('common.error', 'Error'), t('grade_level_list.load_error', 'Failed to load grade levels'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGradeLevels();
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    setTimeout(() => {
      fetchGradeLevels();
    }, 300);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
  };

  const handleGradeLevelPress = (gradeLevelId) => {
    navigation.navigate('GradeLevelForm', { gradeLevelId });
  };

  const handleDelete = (gradeLevel) => {
    Alert.alert(
      t('grade_level_list.delete_title', 'Delete Grade Level'),
      t('grade_level_list.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', gradeLevel.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('grade_level_list.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(
                `${API_BASE_URL}/admin_grade_levels_delete`,
                { grade_level_id: gradeLevel.id },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              fetchGradeLevels();
            } catch (error) {
              const msg = error.response?.data?.message || t('grade_level_list.delete_error', 'Failed to delete grade level');
              Alert.alert(t('common.error', 'Error'), msg);
            }
          },
        },
      ]
    );
  };

  const renderGradeLevelCard = ({ item }) => {
    const badge = statusColors(theme, item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleGradeLevelPress(item.id)}
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
        {item.name_ar ? <Text style={styles.nameAr}>{item.name_ar}</Text> : null}

        {item.education_stage ? (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipText}>{labelize(item.education_stage)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleGradeLevelPress(item.id)}
          >
            <Text style={styles.actionButtonText}>{t('common.edit', 'Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>{t('grade_level_list.delete', 'Delete')}</Text>
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
      <Skeleton width="35%" height={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('grade_level_list.title', 'Grade Levels')}</Text>
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Grade Levels</Text>
        {isAdminRole ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('GradeLevelForm')}
          >
            <Text style={styles.addButtonText}>{t('grade_level_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('grade_level_list.search_placeholder', 'Search grade level name or code...')}
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
            onPress={() => handleStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === status && styles.filterButtonTextActive,
              ]}
            >
              {statusLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={{ flex: 1 }}
        data={gradeLevels}
        renderItem={renderGradeLevelCard}
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
            icon="🎓"
            title={t('grade_level_list.empty_title', 'No grade levels found')}
            subtitle={
              searchTerm
                ? t('grade_level_list.no_match', 'Nothing matches "{query}".').replace('{query}', searchTerm)
                : statusFilter === 'all'
                ? t('grade_level_list.empty_all', 'No grade levels yet.')
                : t('grade_level_list.empty_status', 'No {status} grade levels yet.').replace('{status}', statusLabel(statusFilter).toLowerCase())
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
      marginBottom: 2,
    },
    nameAr: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 4,
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
      marginTop: 4,
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

export default GradeLevelListScreen;
