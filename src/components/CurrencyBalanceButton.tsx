import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Wallet, X, Sparkle } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

function WalletIcon({ color = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return <Wallet color={color} size={size} strokeWidth={2} />;
}
function CloseIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return <X color={color} size={size} strokeWidth={2.2} />;
}
function SparkleIcon({ color = EMERALD, size = 30 }: { color?: string; size?: number }) {
  return <Sparkle color={color} size={size} strokeWidth={1.8} />;
}

/**
 * Wallet/balance pill shown top-right on every role's dashboard - the
 * balance itself isn't wired to anything yet (no ledger/wallet backend
 * exists), so tapping it just opens a "Coming soon" sheet rather than
 * pretending a real number. Self-contained: owns its own modal state, so
 * every dashboard just drops in <CurrencyBalanceButton /> with no wiring.
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

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)} hitSlop={12}>
              <CloseIcon />
            </TouchableOpacity>
            <View style={styles.iconWrap}>
              <SparkleIcon />
            </View>
            <Text style={styles.title}>{t('currency_balance.coming_soon_title', 'Coming soon')}</Text>
            <Text style={styles.desc}>
              {t(
                'currency_balance.coming_soon_desc',
                "Your balance and wallet activity will show up here once this feature is ready."
              )}
            </Text>
            <TouchableOpacity style={styles.gotItBtn} activeOpacity={0.85} onPress={() => setVisible(false)}>
              <Text style={styles.gotItText}>{t('currency_balance.got_it', 'Got it')}</Text>
            </TouchableOpacity>
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

  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdropTouch: { ...StyleSheet.absoluteFill },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    ...SHADOW.level3,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 8 },
  desc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  gotItBtn: { backgroundColor: EMERALD, borderRadius: RADIUS.pill, paddingHorizontal: 28, paddingVertical: 12 },
  gotItText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
