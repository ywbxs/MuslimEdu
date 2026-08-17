import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Wallet, X, Receipt, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { BRAND, COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_DEEP = BRAND.emeraldDeep;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;

function WalletIcon({ color = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return <Wallet color={color} size={size} strokeWidth={2} />;
}
function CloseIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return <X color={color} size={size} strokeWidth={2.2} />;
}
function ReceiptIcon({ color = SUBTLE, size = 24 }: { color?: string; size?: number }) {
  return <Receipt color={color} size={size} strokeWidth={1.6} />;
}

/**
 * Wallet/balance pill shown top-right on every role's dashboard. There's no
 * ledger/wallet backend yet (nothing anywhere debits/credits this), so the
 * sheet shows the real, honest state of that - a genuine ₱0.00 balance and
 * an empty activity list - rather than blocking the whole thing behind a
 * "coming soon" wall. Self-contained: owns its own sheet state, so every
 * dashboard just drops in <CurrencyBalanceButton /> with no wiring.
 */
export default function CurrencyBalanceButton({
  style,
  variant = 'light',
}: {
  style?: object;
  // 'light' (default) - solid white pill with emerald icon/text, for a
  // white/light page background. 'dark' - translucent white pill with white
  // icon/text, for sitting on top of a dark hero where a solid white pill
  // would look too stark and the translucent one still reads as glass.
  variant?: 'light' | 'dark';
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const isDark = variant === 'dark';

  const notReady = () =>
    Alert.alert(
      t('currency_balance.not_ready_title', 'Not available yet'),
      t('currency_balance.not_ready_desc', "Wallet top-ups and withdrawals aren't wired up yet - check back soon."),
    );

  return (
    <>
      <TouchableOpacity style={[styles.pillWrap, style]} activeOpacity={0.85} onPress={() => setVisible(true)}>
        {isDark ? (
          <View style={[styles.pill, styles.pillDark]}>
            <WalletIcon />
            <Text style={styles.pillText}>{t('currency_balance.label', '₱0')}</Text>
          </View>
        ) : (
          <View style={[styles.pill, styles.pillWhite]}>
            <WalletIcon color={EMERALD} />
            <Text style={[styles.pillText, styles.pillTextEmerald]}>{t('currency_balance.label', '₱0')}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{t('currency_balance.wallet_title', 'Wallet')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)} hitSlop={12}>
                <CloseIcon />
              </TouchableOpacity>
            </View>

            <View style={styles.balanceCard}>
              <View style={styles.balanceIconWrap}>
                <WalletIcon color={EMERALD_DEEP} size={20} />
              </View>
              <Text style={styles.balanceLabel}>{t('currency_balance.available_balance', 'Available Balance')}</Text>
              <Text style={styles.balanceAmount}>{t('currency_balance.balance_amount', '₱0.00')}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={notReady}>
                  <View style={styles.actionIconWrap}>
                    <ArrowDownToLine color={EMERALD_DEEP} size={16} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.actionText}>{t('currency_balance.top_up', 'Top Up')}</Text>
                </TouchableOpacity>
                <View style={styles.actionDivider} />
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={notReady}>
                  <View style={styles.actionIconWrap}>
                    <ArrowUpFromLine color={EMERALD_DEEP} size={16} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.actionText}>{t('currency_balance.withdraw', 'Withdraw')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionLabel}>{t('currency_balance.recent_activity', 'Recent Activity')}</Text>
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <ReceiptIcon />
              </View>
              <Text style={styles.emptyTitle}>{t('currency_balance.no_transactions_title', 'No transactions yet')}</Text>
              <Text style={styles.emptyDesc}>
                {t('currency_balance.no_transactions_desc', 'Your wallet activity will show up here once you start using it.')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillWrap: { alignSelf: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...SHADOW.level1,
  },
  pillDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillWhite: { backgroundColor: '#FFFFFF' },
  pillText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  pillTextEmerald: { color: EMERALD },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.45)', justifyContent: 'flex-end' },
  backdropTouch: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingBottom: 32,
    ...SHADOW.level3,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    marginTop: 6,
  },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  balanceLabel: { fontSize: 12.5, fontWeight: '700', color: EMERALD_DEEP },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: INK, marginTop: 4 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    width: '100%',
  },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 },
  actionDivider: { width: 1, height: 22, backgroundColor: HAIRLINE },
  actionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700', color: INK },

  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 12 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  emptyDesc: { fontSize: 12.5, color: SUBTLE, textAlign: 'center', lineHeight: 18, marginTop: 5, maxWidth: 260 },
});
