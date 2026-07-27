import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { setSchoolCode } from '../../services/adminService';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import { GlassButton, GlassInput } from '../../components/glass/GlassKit';
import { BRAND, COLORS, RADIUS } from '../../theme/glass';

const EMERALD = BRAND.emerald;
const EMERALD_SOFT = 'rgba(15,157,88,0.14)';
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const ERROR = '#BA1A1A';

function LockIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="9" rx="2" stroke={EMERALD} strokeWidth={1.8} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={EMERALD} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Everything but A-Z, stripped as the admin types.
function cleanLetters(v: string) {
  return v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}
// Everything but digits, stripped as the admin types.
function cleanNumber(v: string) {
  return v.replace(/[^0-9]/g, '').slice(0, 6);
}

/**
 * First thing a brand-new orphan school's admin sees - no dashboard cards
 * (Teachers, Children, Monthly Reports, etc.) until this step is done.
 * AdminDashboard renders this in place of the card grid whenever
 * `user.is_orphan && !user.school_code`.
 *
 * The admin picks a short letters prefix (e.g. "MLP") and a number
 * (e.g. "2648"); together they form the locked school code ("MLP2648")
 * that every student admitted afterward gets stamped with. Once saved,
 * AdmissionScreen shows this code as a read-only prefix and the admin only
 * ever types the sequential suffix ("0001") for each new student.
 */
export default function SchoolCodeSetupScreen() {
  const { token, updateUser } = useAuth();
  const [letters, setLetters] = useState('');
  const [number, setNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = `${letters || 'MLP'}${number || '2648'}`;
  const canSubmit = letters.length >= 2 && number.length >= 2 && !submitting;

  const onSave = async () => {
    if (!token) {
      setError('Your session expired. Please log in again.');
      return;
    }
    if (letters.length < 2) {
      setError('Enter at least 2 letters for the prefix.');
      return;
    }
    if (number.length < 2) {
      setError('Enter at least 2 digits for the number.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await setSchoolCode(token, letters, number);
      updateUser({ school_code: result.school_code });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the school code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <LockIcon />
          </View>
          <Text style={styles.title}>Set up your school code</Text>
          <Text style={styles.subtitle}>
            Every student your school admits will get an ID built from this code, so pick it carefully -
            once saved, it's locked and can't be changed.
          </Text>

          <GlassCard surface="light" radius={RADIUS.lg} style={styles.previewCard}>
            <Text style={styles.previewLabel}>YOUR SCHOOL CODE WILL BE</Text>
            <Text style={styles.previewValue}>{preview}</Text>
          </GlassCard>

          <View style={styles.row}>
            <View style={styles.fieldSmall}>
              <Text style={styles.label}>Letters</Text>
              <GlassInput
                value={letters}
                onChangeText={(t) => setLetters(cleanLetters(t))}
                placeholder="MLP"
                autoCapitalize="characters"
                maxLength={4}
                textStyle={styles.codeInputText}
              />
            </View>
            <View style={styles.fieldLarge}>
              <Text style={styles.label}>Number</Text>
              <GlassInput
                value={number}
                onChangeText={(t) => setNumber(cleanNumber(t))}
                placeholder="2648"
                keyboardType="number-pad"
                maxLength={6}
                textStyle={styles.codeInputText}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <GlassButton
            label="Save & Continue"
            onPress={onSave}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.button}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#EFF7F1' },
  flexInner: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 90, alignItems: 'stretch' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  previewCard: {
    alignItems: 'center',
    marginBottom: 28,
  },
  previewLabel: { fontSize: 11, fontWeight: '700', color: EMERALD, letterSpacing: 0.8, marginBottom: 6 },
  previewValue: { fontSize: 28, fontWeight: '800', color: EMERALD, letterSpacing: 1 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  fieldSmall: { flex: 1 },
  fieldLarge: { flex: 2 },
  label: { fontSize: 12.5, fontWeight: '600', color: SUBTLE, marginBottom: 6 },
  codeInputText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  errorText: { color: ERROR, fontSize: 13.5, marginTop: 14, textAlign: 'center' },

  button: {
    marginTop: 24,
  },
});
