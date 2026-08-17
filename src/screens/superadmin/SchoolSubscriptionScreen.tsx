import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, CreditCard, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchSchoolSubscription,
  setSchoolSubscription,
  fetchPackages,
  SchoolSubscription,
  SubscriptionPackage,
} from '../../services/superAdminService';
import { SUBSCRIPTION_FEATURE_KEYS } from '../../services/subscriptionService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

const FEATURE_LABELS: Record<string, string> = {
  [SUBSCRIPTION_FEATURE_KEYS.gradingSystems]: 'Grading Systems',
  [SUBSCRIPTION_FEATURE_KEYS.examCategories]: 'Exam Categories',
  [SUBSCRIPTION_FEATURE_KEYS.gradebookReview]: 'Gradebook Review',
};

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function CloseIcon({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}

function SetSubscriptionSheet({
  visible,
  onClose,
  onSaved,
  schoolId,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  schoolId: number;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [studentLimit, setStudentLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setIsLoadingPackages(true);
    fetchPackages(token)
      .then((data) => setPackages(data.filter((p) => p.status === 1)))
      .catch(() => setPackages([]))
      .finally(() => setIsLoadingPackages(false));
  }, [visible, token]);

  const selected = packages.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setPaidAmount(String(selected.price));
    setStudentLimit(selected.student_limit && selected.student_limit !== 'Unlimited' ? selected.student_limit : '');
  }, [selected]);

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedId(null);
    setPaidAmount('');
    setPaymentMethod('manual');
    setStudentLimit('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!token || !selected) {
      Alert.alert(t('school_subscription.almost_done', 'Almost done'), t('school_subscription.error_pick_package', 'Pick a package first.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await setSchoolSubscription(token, {
        school_id: schoolId,
        package_id: selected.id,
        paid_amount: paidAmount.trim() ? Number(paidAmount) : undefined,
        payment_method: paymentMethod.trim() || undefined,
        student_limit: studentLimit.trim() || undefined,
      });
      onSaved();
      handleClose();
    } catch (err) {
      Alert.alert(
        t('school_subscription.save_error_title', 'Could not set subscription'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={handleClose} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('school_subscription.set_title', 'Set Subscription')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('school_subscription.package_label', 'Package')}</Text>
            {isLoadingPackages ? (
              <Skeleton width="100%" height={80} />
            ) : packages.length === 0 ? (
              <Text style={styles.emptyPackagesText}>
                {t('school_subscription.no_packages', 'No active packages yet. Create one in Subscription Plans first.')}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {packages.map((pkg) => {
                  const isSelected = pkg.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[styles.packageOption, isSelected && styles.packageOptionActive]}
                      onPress={() => setSelectedId(pkg.id)}
                    >
                      <Text style={[styles.packageOptionName, isSelected && styles.packageOptionNameActive]}>{pkg.name}</Text>
                      <Text style={[styles.packageOptionMeta, isSelected && styles.packageOptionMetaActive]}>
                        {`${pkg.price} · ${pkg.interval} · ${pkg.student_limit || 'Unlimited'} students`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.fieldLabel}>{t('school_subscription.paid_amount_label', 'Amount Paid')}</Text>
            <TextInput style={styles.fieldInput} placeholder="0.00" placeholderTextColor={SUBTLE} value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>{t('school_subscription.payment_method_label', 'Payment Method')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. bank transfer, cash"
              placeholderTextColor={SUBTLE}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
            />

            <Text style={styles.fieldLabel}>{t('school_subscription.student_limit_label', 'Student Limit Override (optional)')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('school_subscription.student_limit_placeholder', 'Uses the package default')}
              placeholderTextColor={SUBTLE}
              value={studentLimit}
              onChangeText={setStudentLimit}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldHint}>
              {t(
                'school_subscription.expiry_hint',
                'Expiration is calculated automatically from the package’s billing interval, starting today.',
              )}
            </Text>

            <TouchableOpacity
              style={[styles.submitButton, (isSubmitting || !selected) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting || !selected}
            >
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{t('school_subscription.confirm_button', 'Activate Subscription')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Superadmin-only: one school's subscription - status, expiry, fee history entry point, and the set/renew action. */
export default function SchoolSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = useAuth();
  const { t } = useLocale();
  const { schoolId, schoolName } = (route.params as { schoolId: number; schoolName: string }) ?? {};

  const [subscription, setSubscription] = useState<SchoolSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    if (!token || !schoolId) return;
    setError(null);
    try {
      const data = await fetchSchoolSubscription(token, schoolId);
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('school_subscription.load_error', 'Failed to load subscription.'));
    }
  }, [token, schoolId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const expireDate = subscription?.expire_date != null ? Number(subscription.expire_date) : null;
  const isLifetime = expireDate === 0;
  let statusLabel = t('school_subscription.status_none', 'No subscription');
  let statusTone: 'active' | 'expired' | 'none' = 'none';
  if (subscription?.reason === 'expired') {
    statusLabel = t('school_subscription.status_expired', 'Expired');
    statusTone = 'expired';
  } else if (subscription?.active) {
    statusLabel = t('school_subscription.status_active', 'Active');
    statusTone = 'active';
  }

  let expiryText: string | null = null;
  if (subscription && subscription.reason !== 'no_subscription' && expireDate != null) {
    expiryText = isLifetime
      ? t('school_subscription.never_expires', 'Never expires')
      : new Date(expireDate * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {schoolName ?? t('school_subscription.header_title', 'Subscription')}
          </Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <Skeleton width="100%" height={140} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <View style={styles.statusCard}>
            <View style={styles.statusIconWrap}>
              <CreditCard size={24} color={EMERALD} strokeWidth={1.8} />
            </View>
            <View style={styles.statusHeaderRow}>
              <Text style={styles.statusPackageName}>
                {subscription?.package ?? t('school_subscription.no_package', 'No package')}
              </Text>
              <View style={[styles.statusPill, pillStyles[statusTone]]}>
                <Text style={[styles.statusPillText, pillTextStyles[statusTone]]}>{statusLabel}</Text>
              </View>
            </View>

            {expiryText ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('school_subscription.expires_label', 'Expires')}</Text>
                <Text style={styles.detailValue}>{expiryText}</Text>
              </View>
            ) : null}
            {subscription?.student_limit != null ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('school_subscription.student_limit_row', 'Student limit')}</Text>
                <Text style={styles.detailValue}>{String(subscription.student_limit)}</Text>
              </View>
            ) : null}
            {subscription?.paid_amount != null ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('school_subscription.paid_row', 'Amount paid')}</Text>
                <Text style={styles.detailValue}>
                  {subscription.paid_amount}
                  {subscription.payment_method ? ` (${subscription.payment_method})` : ''}
                </Text>
              </View>
            ) : null}

            {subscription && subscription.features && subscription.features.length > 0 ? (
              <View style={styles.featuresWrap}>
                <Text style={styles.detailLabel}>{t('school_subscription.features_row', 'Grants access to')}</Text>
                <View style={styles.featureChipRow}>
                  {subscription.features.map((key) => (
                    <View key={key} style={styles.featureChip}>
                      <Text style={styles.featureChipText}>{FEATURE_LABELS[key] ?? key}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.setButton} onPress={() => setSheetVisible(true)}>
            <Text style={styles.setButtonText}>
              {subscription?.active
                ? t('school_subscription.renew_button', 'Change / Renew Subscription')
                : t('school_subscription.activate_button', 'Set Subscription')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <SetSubscriptionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onSaved={load} schoolId={schoolId} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  statusCard: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 18,
    marginBottom: 16,
  },
  statusIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statusPackageName: { fontSize: 18, fontWeight: '800', color: INK, flexShrink: 1, marginRight: 10 },
  statusPill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: HAIRLINE },
  detailLabel: { fontSize: 13, color: SUBTLE },
  detailValue: { fontSize: 13, color: INK, fontWeight: '600' },

  featuresWrap: { paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE, marginTop: 4 },
  featureChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  featureChip: { backgroundColor: EMERALD_SOFT, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  featureChipText: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },

  setButton: { backgroundColor: EMERALD, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  setButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },

  formSheet: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  fieldHint: { fontSize: 11.5, color: SUBTLE, marginTop: 10, lineHeight: 16 },
  fieldInput: {
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  emptyPackagesText: { fontSize: 13, color: SUBTLE, lineHeight: 18 },

  packageOption: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: HAIRLINE, padding: 12 },
  packageOptionActive: { backgroundColor: EMERALD_SOFT, borderColor: EMERALD },
  packageOptionName: { fontSize: 14.5, fontWeight: '700', color: INK },
  packageOptionNameActive: { color: EMERALD },
  packageOptionMeta: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  packageOptionMetaActive: { color: EMERALD },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

const pillStyles = StyleSheet.create({
  active: { backgroundColor: EMERALD_SOFT },
  expired: { backgroundColor: 'rgba(239,68,68,0.1)' },
  none: { backgroundColor: '#EEF0F2' },
});
const pillTextStyles = StyleSheet.create({
  active: { color: EMERALD },
  expired: { color: DANGER },
  none: { color: SUBTLE },
});
