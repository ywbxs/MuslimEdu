import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { AdminSubscriptionStatus } from '../services/subscriptionService';
import { COLORS, RADIUS } from '../theme/glass';

/**
 * Read-only summary of this school's platform subscription - package,
 * expiration, days remaining/overdue. The admin app previously fetched this
 * (subscriptionService.fetchAdminSubscriptionStatus) only to silently lock
 * three cards; there was nowhere an admin could actually see the package
 * name or expiry date that decided that lock. Set by the superadmin from
 * SuperAdminSchoolSubscription.
 */
export default function SubscriptionStatusCard({ status }: { status: AdminSubscriptionStatus | null }) {
  const { t } = useLocale();

  // Still loading, or the fetch failed - stay quiet rather than show a
  // misleading "No subscription" while we don't actually know yet.
  if (!status) return null;

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

  return (
    <View style={styles.card}>
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
            t('subscription_card.contact_owner', 'Contact your account owner to activate a plan.')}
        </Text>
      </View>
    </View>
  );
}

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
});
const pillTextStyles = StyleSheet.create({
  active: { color: COLORS.emerald },
  expired: { color: COLORS.danger },
  none: { color: COLORS.subtle },
});
