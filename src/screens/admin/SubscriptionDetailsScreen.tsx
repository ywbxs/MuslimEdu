import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, CreditCard, RefreshCcw } from 'lucide-react-native';
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
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_DEEP = '#0F7A3D';
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const BORDER = COLORS.border;
const AMBER = '#92400E';
const AMBER_SOFT = 'rgba(180,83,9,0.10)';

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function CardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <CreditCard size={size} color={color} strokeWidth={1.8} />;
}
function RenewIcon({ color }: { color: string }) {
  return <RefreshCcw size={16} color={color} strokeWidth={2.2} />;
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
 * The "tap the active subscription card" destination - SubscribeScreen only
 * ever handled the no-subscription-yet path (browse plans, submit a
 * request). This is the everyday-plan-owner view: full current-plan detail
 * (package, status, days remaining), a Renew action (there's no dedicated
 * renew endpoint server-side - it submits the same self-serve request
 * SubscribeScreen uses, for the CURRENT package's id, matched by name since
 * AdminSubscriptionStatus only stores the package name string), and the
 * full package catalog to switch plans from, all on one screen instead of
 * routing an already-subscribed admin through the "choose a plan" flow.
 */
export default function SubscriptionDetailsScreen() {
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

  const currentPackage = packages.find((p) => p.name === status?.package) ?? null;

  const submitRequest = async (packageId: number, note: string) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await submitSubscriptionRequest(token, { package_id: packageId, payment_reference: note.trim() || undefined });
      Alert.alert(
        t('subscribe.submitted_title', 'Request submitted'),
        t('subscribe.submitted_body', "We'll let you know once it's reviewed."),
      );
      setSelectedId(null);
      setPaymentReference('');
      await load();
    } catch (err) {
      Alert.alert(
        t('subscribe.submit_error_title', "Couldn't submit request"),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenew = () => {
    if (!currentPackage) return;
    Alert.alert(
      t('subscription_details.renew_confirm_title', 'Renew {package}?').replace('{package}', currentPackage.name),
      t('subscription_details.renew_confirm_body', "This submits a request for a superadmin to review, same as choosing a new plan - it's not automatic."),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('subscription_details.renew', 'Renew'), onPress: () => submitRequest(currentPackage.id, '') },
      ],
    );
  };

  const handleSwitch = () => {
    if (!token || !selectedId) return;
    submitRequest(selectedId, paymentReference);
  };

  const pendingRequest = status?.pending_request ?? null;
  const expireDate = status?.expire_date != null ? Number(status.expire_date) : null;
  const isLifetime = expireDate === 0;
  const daysRemaining = expireDate != null && !isLifetime ? Math.round((expireDate * 1000 - Date.now()) / 86400000) : null;
  const otherPackages = packages.filter((p) => p.id !== currentPackage?.id);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.roundBtn}>
          <ChevronLeftIcon color={INK} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('subscription_details.title', 'Subscription')}</Text>
        <View style={styles.roundBtnGhost} />
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
      ) : !status ? null : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          {/* --- Current plan --- */}
          <View style={styles.planCard}>
            <View style={styles.planTopRow}>
              <View style={styles.planIconWrap}>
                <CardIcon color={EMERALD} />
              </View>
              <View style={[styles.pill, status.active ? pillStyles.active : pillStyles.expired]}>
                <Text style={[styles.pillText, status.active ? pillTextStyles.active : pillTextStyles.expired]}>
                  {status.active ? t('subscription_card.status_active', 'Active') : t('subscription_card.status_expired', 'Expired')}
                </Text>
              </View>
            </View>
            <Text style={styles.planName}>{status.package ?? t('subscription_card.no_package', 'Subscription')}</Text>
            <Text style={styles.planExpiry}>
              {isLifetime
                ? t('subscription_card.never_expires', 'Never expires')
                : expireDate != null
                ? status.active
                  ? t('subscription_details.renews_on', 'Renews on {date}').replace('{date}', new Date(expireDate * 1000).toLocaleDateString())
                  : t('subscription_details.expired_on', 'Expired on {date}').replace('{date}', new Date(expireDate * 1000).toLocaleDateString())
                : t('subscription_card.contact_owner', 'Contact your account owner to activate a plan.')}
            </Text>

            {!isLifetime && daysRemaining != null ? (
              <View style={styles.daysRow}>
                <Text style={[styles.daysNum, { color: status.active ? EMERALD_DEEP : COLORS.danger }]}>
                  {Math.abs(daysRemaining)}
                </Text>
                <Text style={styles.daysLabel}>
                  {status.active
                    ? t('subscription_details.days_remaining', 'days remaining')
                    : t('subscription_details.days_overdue', 'days overdue')}
                </Text>
              </View>
            ) : null}

            {currentPackage?.student_limit ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('subscription_details.student_limit_label', 'Student limit')}</Text>
                <Text style={styles.metaValue}>{currentPackage.student_limit}</Text>
              </View>
            ) : null}

            {currentPackage && !pendingRequest ? (
              <TouchableOpacity
                style={[styles.renewButton, isSubmitting && { opacity: 0.6 }]}
                onPress={handleRenew}
                disabled={isSubmitting}
              >
                <RenewIcon color="#FFFFFF" />
                <Text style={styles.renewButtonText}>{t('subscription_details.renew', 'Renew')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {pendingRequest ? (
            <View style={styles.pendingCard}>
              <View style={styles.pendingIconWrap}>
                <Clock size={20} color={AMBER} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>{t('subscribe.pending_title', 'Request pending review')}</Text>
                <Text style={styles.pendingBody}>
                  {t('subscribe.pending_body', 'You requested {package} on {date}. A superadmin will review it soon.')
                    .replace('{package}', pendingRequest.package ?? '')
                    .replace('{date}', new Date(pendingRequest.requested_at).toLocaleDateString())}
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* --- Other packages --- */}
              <Text style={styles.sectionLabel}>{t('subscription_details.available_packages', 'Available Packages')}</Text>

              {otherPackages.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('subscription_details.no_other_packages', "There's nothing else to switch to right now.")}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {otherPackages.map((pkg) => {
                    const isSelected = pkg.id === selectedId;
                    return (
                      <TouchableOpacity
                        key={pkg.id}
                        style={[styles.packageCard, isSelected && styles.packageCardActive]}
                        activeOpacity={0.85}
                        onPress={() => setSelectedId(isSelected ? null : pkg.id)}
                      >
                        <View style={styles.packageHeaderRow}>
                          <Text style={styles.packageName}>{pkg.name}</Text>
                          {isSelected ? (
                            <View style={styles.packageSelectedDot} />
                          ) : null}
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

              {selectedId ? (
                <>
                  <Text style={styles.fieldLabel}>{t('subscribe.payment_reference_label', 'Payment note (optional)')}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t('subscribe.payment_reference_placeholder', 'e.g. bank transfer ref, or "will pay in cash"')}
                    placeholderTextColor={SUBTLE}
                    value={paymentReference}
                    onChangeText={setPaymentReference}
                  />

                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
                    onPress={handleSwitch}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>{t('subscription_details.switch_plan', 'Request This Plan')}</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  roundBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF0F2', alignItems: 'center', justifyContent: 'center' },
  roundBtnGhost: { width: 32, height: 32 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerTitleFlex: { flex: 1, marginLeft: 10 },

  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  // --- current plan ---
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 18,
    ...SHADOW.level2,
  },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  planName: { fontSize: 22, fontWeight: '800', color: INK, marginBottom: 4 },
  planExpiry: { fontSize: 13.5, color: SUBTLE, lineHeight: 19 },

  daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 16 },
  daysNum: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  daysLabel: { fontSize: 13.5, color: SUBTLE, fontWeight: '600' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },
  metaLabel: { fontSize: 13, color: SUBTLE },
  metaValue: { fontSize: 13, fontWeight: '700', color: INK },

  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    marginTop: 18,
  },
  renewButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  sectionLabel: {
    fontSize: 12,
    color: SUBTLE,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', paddingVertical: 20 },

  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    ...SHADOW.level1,
  },
  packageCardActive: { borderColor: EMERALD, backgroundColor: EMERALD_SOFT },
  packageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageName: { fontSize: 15.5, fontWeight: '700', color: INK },
  packageSelectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: EMERALD },
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
    borderColor: BORDER,
  },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  pendingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  pendingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: AMBER_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: { fontSize: 14.5, fontWeight: '800', color: INK, marginBottom: 4 },
  pendingBody: { fontSize: 12.5, color: SUBTLE, lineHeight: 18 },
});

const pillStyles = StyleSheet.create({
  active: { backgroundColor: EMERALD_SOFT },
  expired: { backgroundColor: 'rgba(239,68,68,0.1)' },
});
const pillTextStyles = StyleSheet.create({
  active: { color: EMERALD },
  expired: { color: COLORS.danger },
});
