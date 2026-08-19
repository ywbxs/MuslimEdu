import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleDollarSign } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import BentoGridCard, { BentoGrid } from '../../components/glass/BentoGridCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import { FeeType, fetchFeeTypes, deleteFeeType } from '../../services/enrollmentWorkflowService';

/**
 * Admin: what a student owes during enrollment (Tuition Fee, Miscellaneous,
 * Service Fee, ...). Reachable from EnrollmentStagesScreen's "Fees" button.
 * Bento grid, same spatial-UI language as EnrollmentStagesScreen.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconCoin({ color }: { color: string }) {
  return <CircleDollarSign size={22} color={color} strokeWidth={2} />;
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

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.skeletonCard}>
      <Skeleton width={42} height={42} borderRadius={21} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <Skeleton width="70%" height={16} borderRadius={6} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
      <Skeleton width="45%" height={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_fee_types.title', 'Fee Types')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <BentoGrid>{[0, 1, 2].map(renderSkeletonCard)}</BentoGrid>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_fee_types.title', 'Fee Types')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('EnrollmentFeeTypeForm')}>
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
        {t('enrollment_fee_types.helper', 'What a student owes during enrollment. Required fees must show Paid or Waived before a student can be officially enrolled.')}
      </Text>

      <ScrollView style={{ flex: 1 }}>
        {feeTypes.length === 0 ? (
          <EmptyState
            icon="💰"
            title={t('enrollment_fee_types.empty_title', 'No fee types yet')}
            subtitle={t('enrollment_fee_types.empty_subtitle', 'Add Tuition Fee, Miscellaneous, Service Fee, or whatever your school charges at enrollment.')}
            actionLabel={t('enrollment_fee_types.empty_action', 'Add Fee Type')}
            onAction={() => (navigation as any).navigate('EnrollmentFeeTypeForm')}
            colors={theme}
          />
        ) : (
          <BentoGrid>
            {feeTypes.map((item) => (
              <BentoGridCard
                key={item.id}
                icon={<IconCoin color={theme.accent} />}
                title={item.name}
                subtitle={formatAmount(item.amount) ?? undefined}
                meta={item.is_required ? t('enrollment_fee_types.required', 'Required before enrollment completes') : undefined}
                badgeText={item.is_active ? t('enrollment_fee_types.active', 'active') : t('enrollment_fee_types.inactive', 'inactive')}
                badgeTone={item.is_active ? 'accent' : 'neutral'}
                onPress={() => (navigation as any).navigate('EnrollmentFeeTypeForm', { feeTypeId: item.id })}
                theme={theme}
              />
            ))}
          </BentoGrid>
        )}
        {feeTypes.length > 0 ? (
          <View style={styles.deleteHintRow}>
            {feeTypes.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => handleDelete(item)} style={styles.deleteChip}>
                <Text style={styles.deleteChipText}>
                  {t('enrollment_fee_types.delete_x', 'Delete {name}').replace('{name}', item.name)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
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
    addButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    helperText: { fontSize: 12.5, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    skeletonCard: {
      width: '47%',
      minHeight: 132,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },

    deleteHintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 20 },
    deleteChip: { borderWidth: 1, borderColor: theme.dangerSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    deleteChipText: { color: theme.danger, fontSize: 11, fontWeight: '600' },
  });
