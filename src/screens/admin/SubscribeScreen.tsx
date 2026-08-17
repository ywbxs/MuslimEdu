import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, CircleCheck, Clock } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAdminSubscriptionPackages,
  fetchAdminSubscriptionStatus,
  submitSubscriptionRequest,
  AdminSubscriptionPackage,
  AdminSubscriptionStatus,
} from '../../services/subscriptionService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS, COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const AMBER = '#92400E';
const AMBER_SOFT = 'rgba(180,83,9,0.10)';

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function intervalLabel(interval: AdminSubscriptionPackage['interval'], t: (k: string, f: string) => string) {
  switch (interval) {
    case 'monthly':
      return t('subscribe.interval_monthly', 'Monthly');
    case 'yearly':
      return t('subscribe.interval_yearly', 'Yearly');
    case 'life_time':
      return t('subscribe.interval_lifetime', 'One-time, lifetime');
    default:
      return t('subscribe.interval_days', 'Days');
  }
}

/**
 * Admin self-serve: browse active plans and submit a subscribe request for
 * a superadmin to review (SuperAdminApiController::subscriptionRequestApprove
 * on the backend, SubscriptionRequestsScreen.tsx on the superadmin side).
 * There's no payment gateway - `paymentReference` is a free-text note the
 * superadmin manually verifies, same as this app's other offline-payment
 * flows.
 */
export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [status, setStatus] = useState<AdminSubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<AdminSubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [statusData, packagesData] = await Promise.all([
        fetchAdminSubscriptionStatus(token),
        fetchAdminSubscriptionPackages(token),
      ]);
      setStatus(statusData);
      setPackages(packagesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('subscribe.load_error', 'Failed to load subscription plans.'));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleSubmit = async () => {
    if (!token || !selectedId) return;
    setIsSubmitting(true);
    try {
      await submitSubscriptionRequest(token, {
        package_id: selectedId,
        payment_reference: paymentReference.trim() || undefined,
      });
      Alert.alert(
        t('subscribe.submitted_title', 'Request submitted'),
        t('subscribe.submitted_body', "We'll let you know once it's reviewed."),
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t('subscribe.submit_error_title', "Couldn't submit request"),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingRequest = status?.pending_request ?? null;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('subscribe.header_title', 'Subscribe')}</Text>
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
      ) : pendingRequest ? (
        <View style={styles.content}>
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconWrap}>
              <Clock size={24} color={AMBER} strokeWidth={1.8} />
            </View>
            <Text style={styles.pendingTitle}>{t('subscribe.pending_title', 'Request pending review')}</Text>
            <Text style={styles.pendingBody}>
              {t('subscribe.pending_body', 'You requested {package} on {date}. A superadmin will review it soon.')
                .replace('{package}', pendingRequest.package ?? '')
                .replace('{date}', new Date(pendingRequest.requested_at).toLocaleDateString())}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <Text style={styles.sectionLabel}>{t('subscribe.choose_plan', 'Choose a plan')}</Text>

          {packages.length === 0 ? (
            <Text style={styles.emptyText}>
              {t('subscribe.no_packages', 'No plans are available right now. Check back later.')}
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {packages.map((pkg) => {
                const isSelected = pkg.id === selectedId;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.packageCard, isSelected && styles.packageCardActive]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedId(pkg.id)}
                  >
                    <View style={styles.packageHeaderRow}>
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      {isSelected ? <CircleCheck size={20} color={EMERALD} strokeWidth={2.2} /> : null}
                    </View>
                    <Text style={styles.packagePrice}>
                      {pkg.price} · {intervalLabel(pkg.interval, t)}
                    </Text>
                    <Text style={styles.packageMeta}>
                      {t('subscribe.student_limit', '{limit} students').replace(
                        '{limit}',
                        pkg.student_limit || t('subscribe.unlimited', 'Unlimited'),
                      )}
                    </Text>
                    {pkg.description ? (
                      <Text style={styles.packageDesc} numberOfLines={2}>
                        {pkg.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.fieldLabel}>{t('subscribe.payment_reference_label', 'Payment note (optional)')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('subscribe.payment_reference_placeholder', 'e.g. bank transfer ref, or "will pay in cash"')}
            placeholderTextColor={SUBTLE}
            value={paymentReference}
            onChangeText={setPaymentReference}
          />

          <TouchableOpacity
            style={[styles.submitButton, (!selectedId || isSubmitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={!selectedId || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>{t('subscribe.submit_button', 'Submit Request')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
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
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12,
    color: SUBTLE,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', paddingVertical: 30 },

  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    padding: 16,
    ...SHADOW.level1,
  },
  packageCardActive: { borderColor: EMERALD, backgroundColor: EMERALD_SOFT },
  packageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageName: { fontSize: 15.5, fontWeight: '700', color: INK },
  packagePrice: { fontSize: 13, color: SUBTLE, marginTop: 4, fontWeight: '600' },
  packageMeta: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  packageDesc: { fontSize: 12, color: SUBTLE, marginTop: 6, lineHeight: 16 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 20 },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 24,
    alignItems: 'center',
  },
  pendingIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AMBER_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: INK, textAlign: 'center' },
  pendingBody: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
