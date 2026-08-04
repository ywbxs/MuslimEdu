import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../context/LocaleContext';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

function CloseIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function SparkleIcon({ color = EMERALD, size = 30 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Plain-text balance shown top-right on every role's dashboard - the
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
  // 'light' (default) - dark ink text, for a white/light page background.
  // 'dark' - white text, for sitting on top of a dark hero
  // (StudentDashboard/TeacherDashboard/AdminDashboard's gradient header)
  // where the light variant's ink text would have no contrast.
  variant?: 'light' | 'dark';
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const isDark = variant === 'dark';

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, style]}
        activeOpacity={0.6}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.pillText, isDark && styles.pillTextDark]}>{t('currency_balance.label', '₱0')}</Text>
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
  pill: {
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  pillText: { fontSize: 15, fontWeight: '800', color: INK },
  pillTextDark: { color: '#FFFFFF' },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
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
