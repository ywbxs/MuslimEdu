import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Globe, X, Check } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useLocale, RTL_LOCALES } from '../context/LocaleContext';
import { saveUserSettings } from '../services/studentPortalService';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

function GlobeIcon({ color = '#FFFFFF', size = 17 }: { color?: string; size?: number }) {
  return <Globe color={color} size={size} strokeWidth={1.8} />;
}
function CloseIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return <X color={color} size={size} strokeWidth={2.2} />;
}
function CheckIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return <Check color={color} size={size} strokeWidth={2.6} />;
}

/**
 * Quick language switch - English/Arabic today, matching the two
 * languages AccountSettingsScreen's fuller language picker always offers
 * (see LANGUAGE_LABELS there). Self-contained like CurrencyBalanceButton:
 * owns its own modal state, so any screen just drops in
 * <LanguageSwitcherButton /> with no wiring.
 *
 * Two looks: 'icon' (default) is the small solid-emerald circle used on
 * the feed header, next to the currency pill. 'pill' is the white
 * globe+code pill (e.g. "EN") used on the login screen's top bar - same
 * pill language as CurrencyBalanceButton, just showing the active locale
 * instead of a balance.
 *
 * Persists the same way AccountSettingsScreen's save does (best-effort -
 * a failed save still flips the in-session locale via refresh(), it just
 * won't survive a relaunch) and shows the same "restart required" prompt
 * when the pick flips RTL-ness, since I18nManager only takes full visual
 * effect on the next app launch (see LocaleContext.tsx).
 */
export default function LanguageSwitcherButton({
  style,
  variant = 'icon',
}: {
  style?: object;
  variant?: 'icon' | 'pill';
}) {
  const { token } = useAuth();
  const { locale, isRTL, refresh } = useLocale();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = async (code: string) => {
    if (code === locale || saving) {
      setVisible(false);
      return;
    }
    setSaving(true);
    const wasRTL = isRTL;
    try {
      if (token) await saveUserSettings(token, { language: code }).catch(() => {});
      await refresh(code);
      setVisible(false);
      if (RTL_LOCALES.has(code) !== wasRTL) {
        Alert.alert('Restart required', 'Restart the app for the right-to-left layout to fully apply.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {variant === 'pill' ? (
        <TouchableOpacity style={[styles.pill, style]} activeOpacity={0.85} onPress={() => setVisible(true)}>
          <GlobeIcon color={INK} size={18} />
          <Text style={styles.pillText}>{locale.toUpperCase()}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.btn, style]} activeOpacity={0.85} onPress={() => setVisible(true)}>
          <GlobeIcon />
        </TouchableOpacity>
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)} hitSlop={12}>
              <CloseIcon />
            </TouchableOpacity>
            <Text style={styles.title}>Language</Text>

            {LANGUAGE_OPTIONS.map((opt) => {
              const active = opt.code === locale;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.row, active && styles.rowActive]}
                  activeOpacity={0.7}
                  onPress={() => pick(opt.code)}
                  disabled={saving}
                >
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{opt.label}</Text>
                  {active && <CheckIcon />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.level1,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...SHADOW.level1,
  },
  pillText: { fontSize: 14, fontWeight: '800', color: INK, letterSpacing: 0.3 },

  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdropTouch: { ...StyleSheet.absoluteFill },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 20,
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
  title: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    backgroundColor: COLORS.canvas,
  },
  rowActive: { backgroundColor: EMERALD_SOFT },
  rowLabel: { fontSize: 15, fontWeight: '600', color: INK },
  rowLabelActive: { color: EMERALD, fontWeight: '800' },
});
