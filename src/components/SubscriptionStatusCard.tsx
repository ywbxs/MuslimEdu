import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Clock, CreditCard } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { AdminSubscriptionStatus } from '../services/subscriptionService';
import { COLORS, RADIUS } from '../theme/glass';

/**
 * Read-only summary of this school's platform subscription - package,
 * expiration, days remaining/overdue - plus, while there's no active plan,
 * a way for the admin to actually do something about it: submit a
 * self-serve request (see SubscribeScreen) instead of just waiting for the
 * superadmin to notice. Set by the superadmin from SuperAdminSchoolSubscription,
 * or by approving a request from SubscriptionRequestsScreen.
 */
export default function SubscriptionStatusCard({
  status,
  loadFailed = false,
  onRetry,
  onSubscribePress,
  onDetailsPress,
}: {
  status: AdminSubscriptionStatus | null;
  // True once the fetch has actually errored (endpoint missing/500/network) -
  // distinct from still loading, which stays quiet rather than flash a
  // misleading "No subscription" before the real answer arrives.
  loadFailed?: boolean;
  onRetry?: () => void;
  // Navigates to SubscribeScreen - only used to make the card tappable
  // while there's no active plan and no request already pending.
  onSubscribePress?: () => void;
  // Navigates to SubscriptionDetailsScreen - makes the card tappable while
  // there IS an active plan, so an admin can see days remaining, renew, or
  // browse other packages instead of the card being inert once subscribed.
  onDetailsPress?: () => void;
}) {
  const { t } = useLocale();

  if (loadFailed) {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={onRetry ? 0.7 : 1} onPress={onRetry} disabled={!onRetry}>
        <View style={[styles.iconWrap, styles.iconWrapMuted]}>
          <CreditCard size={18} color={COLORS.subtle} strokeWidth={1.8} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('subscription_card.load_failed_title', 'Subscription status unavailable')}</Text>
          <Text style={styles.subtitle}>
            {t('subscription_card.load_failed_subtitle', 'Tap to try again.')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Still loading - stay quiet rather than flash something misleading.
  if (!status) return null;

  if (status.pending_request) {
    const requestedDate = new Date(status.pending_request.requested_at).toLocaleDateString();
    return (
      <View style={styles.card}>
        <View style={[styles.iconWrap, styles.iconWrapAmber]}>
          <Clock size={18} color={AMBER} strokeWidth={1.8} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {status.pending_request.package ?? t('subscription_card.no_package', 'Subscription')}
            </Text>
            <View style={[styles.pill, pillStyles.pending]}>
              <Text style={[styles.pillText, pillTextStyles.pending]}>
                {t('subscription_card.status_pending', 'Pending review')}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('subscription_card.pending_since', 'Requested {date}').replace('{date}', requestedDate)}
          </Text>
        </View>
      </View>
    );
  }

  const expireDate = status.expire_date != null ? Number(status.expire_date) : null;
  const isLifetime = expireDate === 0;

  let pillLabel: string;
  let pillTone: 'active' | 'expired' | 'none';
  if (status.reason === 'no_subscription') {
    pillLabel = t('subscription_card.status_none', 'No subscription');
    pillTone = 'none';
  } else if (status.active) {
    pillLabel = t('subscription_card.status_active', 'Active');
    pillTone = 'active';
  } else {
    pillLabel = t('subscription_card.status_expired', 'Expired');
    pillTone = 'expired';
  }

  let expiryLine: string | null = null;
  if (status.reason !== 'no_subscription' && expireDate != null) {
    if (isLifetime) {
      expiryLine = t('subscription_card.never_expires', 'Never expires');
    } else {
      const expiryDate = new Date(expireDate * 1000);
      const daysDiff = Math.round((expireDate * 1000 - Date.now()) / 86400000);
      const formatted = expiryDate.toLocaleDateString();
      if (status.active) {
        expiryLine =
          daysDiff <= 0
            ? t('subscription_card.expires_today', 'Expires today · {date}').replace('{date}', formatted)
            : t('subscription_card.expires_in_days', 'Renews in {days} days · {date}')
                .replace('{days}', String(daysDiff))
                .replace('{date}', formatted);
      } else {
        const overdueDays = Math.max(1, -daysDiff);
        expiryLine = t('subscription_card.expired_days_ago', 'Expired {days} days ago · {date}')
          .replace('{days}', String(overdueDays))
          .replace('{date}', formatted);
      }
    }
  }

  const showSubscribeCta = !status.active && !!onSubscribePress;
  const showDetailsCta = status.active && !!onDetailsPress;
  const isTappable = showSubscribeCta || showDetailsCta;
  const Container = isTappable ? TouchableOpacity : View;

  return (
    <Container
      style={styles.card}
      {...(isTappable ? { activeOpacity: 0.75, onPress: showDetailsCta ? onDetailsPress : onSubscribePress } : {})}
    >
      <View style={styles.iconWrap}>
        <CreditCard size={18} color={COLORS.emerald} strokeWidth={1.8} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {status.package ?? t('subscription_card.no_package', 'Subscription')}
          </Text>
          <View style={[styles.pill, pillStyles[pillTone]]}>
            <Text style={[styles.pillText, pillTextStyles[pillTone]]}>{pillLabel}</Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {expiryLine ??
            (showSubscribeCta
              ? t('subscription_card.tap_to_subscribe', 'Tap to choose a plan')
              : t('subscription_card.contact_owner', 'Contact your account owner to activate a plan.'))}
        </Text>
      </View>
      {isTappable ? <ChevronRight size={18} color={COLORS.subtle} strokeWidth={2} /> : null}
    </Container>
  );
}

const AMBER = '#92400E';
const AMBER_SOFT = 'rgba(180,83,9,0.10)';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrapMuted: { backgroundColor: '#EEF0F2' },
  iconWrapAmber: { backgroundColor: AMBER_SOFT },
  textWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.ink, flexShrink: 1 },
  subtitle: { fontSize: 11, color: COLORS.subtle, marginTop: 1 },
  pill: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '700' },
});

const pillStyles = StyleSheet.create({
  active: { backgroundColor: COLORS.emeraldSoft },
  expired: { backgroundColor: 'rgba(239,68,68,0.1)' },
  none: { backgroundColor: '#EEF0F2' },
  pending: { backgroundColor: AMBER_SOFT },
});
const pillTextStyles = StyleSheet.create({
  active: { color: COLORS.emerald },
  expired: { color: COLORS.danger },
  none: { color: COLORS.subtle },
  pending: { color: AMBER },
});
