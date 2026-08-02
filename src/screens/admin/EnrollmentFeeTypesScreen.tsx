import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import { FeeType, fetchFeeTypes, deleteFeeType } from '../../services/enrollmentWorkflowService';

/**
 * Admin: what a student owes during enrollment (Tuition Fee, Miscellaneous,
 * Service Fee, ...). Reachable from EnrollmentStagesScreen's "Fees" button.
 * Mirrors EnrollmentStagesScreen's list/add/edit/delete structure - same
 * module, same conventions.
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCoin({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.2 2.5-2.2s2.5.8 2.5 2c0 1.5-1.5 2-2.5 2.4-1.2.4-2.5 1-2.5 2.6 0 1.2 1.1 2.2 2.5 2.2s2.5-.8 2.5-2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function IconFlag({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V4M5 4h12l-3 4 3 4H5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatAmount(amount: FeeType['amount']): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EnrollmentFeeTypesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setFeeTypes(await fetchFeeTypes(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_fee_types.load_error', 'Failed to load fee types.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (feeType: FeeType) => {
    Alert.alert(
      t('enrollment_fee_types.delete_title', 'Delete Fee Type'),
      t('enrollment_fee_types.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', feeType.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('enrollment_fee_types.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteFeeType(token, feeType.id);
              load();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_fee_types.delete_error', 'Failed to delete fee type.'));
            }
          },
        },
      ]
    );
  };

  const renderFeeType = ({ item }: { item: FeeType }) => {
    const isActive = item.is_active;
    const amount = formatAmount(item.amount);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('EnrollmentFeeTypeForm', { feeTypeId: item.id })}
      >
        <View style={styles.iconCol}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <IconCoin color={theme.accent} />
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            {item.code ? (
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>
            ) : (
              <View />
            )}
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: isActive ? theme.accent : theme.textSecondary,
                  backgroundColor: isActive ? theme.accentSoft : theme.surfaceVariant,
                },
              ]}
            >
              {isActive ? t('enrollment_fee_types.active', 'active') : t('enrollment_fee_types.inactive', 'inactive')}
            </Text>
          </View>

          <Text style={styles.name}>{item.name}</Text>
          {amount ? <Text style={styles.amount}>{amount}</Text> : null}

          {item.is_required ? (
            <View style={styles.terminalRow}>
              <IconFlag color={theme.accent} />
              <Text style={styles.terminalText}>{t('enrollment_fee_types.required', 'Required before enrollment completes')}</Text>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
              <Text style={styles.deleteButtonText}>{t('enrollment_fee_types.delete', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.iconCol}>
        <Skeleton width={40} height={40} borderRadius={20} baseColor={theme.skeletonBase} />
      </View>
      <View style={styles.cardBody}>
        <Skeleton width={60} height={18} borderRadius={6} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
        <Skeleton width="55%" height={18} baseColor={theme.skeletonBase} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_fee_types.title', 'Fee Types')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2].map(renderSkeletonCard)}</View>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_fee_types.title', 'Fee Types')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('EnrollmentFeeTypeForm')}
        >
          <Text style={styles.addButtonText}>{t('enrollment_fee_types.add', '+ Add')}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.helperText}>
        {t(
          'enrollment_fee_types.helper',
          'What a student owes during enrollment. Required fees must show Paid or Waived before a student can be officially enrolled.'
        )}
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={feeTypes}
        renderItem={renderFeeType}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="💰"
            title={t('enrollment_fee_types.empty_title', 'No fee types yet')}
            subtitle={t('enrollment_fee_types.empty_subtitle', 'Add Tuition Fee, Miscellaneous, Service Fee, or whatever your school charges at enrollment.')}
            actionLabel={t('enrollment_fee_types.empty_action', 'Add Fee Type')}
            onAction={() => (navigation as any).navigate('EnrollmentFeeTypeForm')}
            colors={theme}
          />
        }
      />
      <BottomNavBar />
    </View>
  );
}

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
    headerTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    helperText: {
      fontSize: 12.5,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 12,
      lineHeight: 18,
    },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md ?? 10,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    listContainer: { paddingHorizontal: 16, paddingVertical: 12 },
    card: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    iconCol: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: 40,
      marginRight: 12,
      paddingTop: 2,
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1 },
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
    codeText: { fontSize: 12, fontWeight: '700', color: theme.accentSoftText },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: 'hidden',
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    amount: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
    terminalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    terminalText: { fontSize: 11.5, color: theme.textSecondary, marginLeft: 6 },
    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteButtonText: { color: theme.danger, fontSize: 12, fontWeight: '600' },
  });
