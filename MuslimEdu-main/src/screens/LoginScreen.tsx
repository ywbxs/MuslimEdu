import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  useWindowDimensions,
  Modal,
  Animated,
  Easing,
  Pressable,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';

const BRAND_GREEN = '#0F9D58';
const INK = '#111827';
const TEXT_MUTED = '#6B7280';
const PLACEHOLDER = '#9AA0A6';
const BORDER = '#E7EAEE';
const DANGER = '#D70015';
const WHITE = '#FFFFFF';

/* ---------------------------- Icons ------------------------------- */
function MailIcon({ color = BRAND_GREEN, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="3" stroke={color} strokeWidth={1.8} />
      <Path d="M4 7l8 6 8-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LockIcon({ color = BRAND_GREEN, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="10" width="16" height="10" rx="3" stroke={color} strokeWidth={1.8} />
      <Path d="M8 10V8a4 4 0 118 0v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function EyeIcon({ open, color = TEXT_MUTED, size = 22 }: { open: boolean; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} />
      {!open && <Line x1="4" y1="20" x2="20" y2="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />}
    </Svg>
  );
}
function ChevronRightIcon({ color = BRAND_GREEN, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon({ color = WHITE, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4 10-11" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SchoolIcon({ color = BRAND_GREEN, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10l9-5 9 5-9 5-9-5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7 12v5c0 1 2.2 2 5 2s5-1 5-2v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AlumniIcon({ color = BRAND_GREEN, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4L2 9l10 5 8-4v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 12v4c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* --------------------------- Bottom sheet --------------------------- */
function GetStartedSheet({
  visible,
  onClose,
  onSchool,
  onAlumni,
}: {
  visible: boolean;
  onClose: () => void;
  onSchool: () => void;
  onAlumni: () => void;
}) {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 11, tension: 70, useNativeDriver: true }),
    ]).start();
  };

  const animateOut = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: height, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setMounted(false);
      cb?.();
    });
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(animateIn);
    } else if (mounted) {
      animateOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90) animateOut(onClose);
        else Animated.spring(translateY, { toValue: 0, friction: 11, tension: 70, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const handleSelect = (fn: () => void) => animateOut(fn);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => animateOut(onClose)}>
      <View style={sheet.root}>
        <Animated.View style={[sheet.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => animateOut(onClose)} />
        </Animated.View>

        <Animated.View style={[sheet.card, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={sheet.handleZone}>
            <View style={sheet.handle} />
          </View>

          <Text style={sheet.title}>Get Started</Text>
          <Text style={sheet.subtitle}>Choose how you'd like to join MuslimEdu.</Text>

          <TouchableOpacity style={sheet.option} activeOpacity={0.85} onPress={() => handleSelect(onSchool)}>
            <View style={sheet.optionIcon}>
              <SchoolIcon />
            </View>
            <View style={sheet.optionText}>
              <Text style={sheet.optionTitle}>Register Your School</Text>
              <Text style={sheet.optionDesc}>Create and manage your institution with MuslimEdu.</Text>
            </View>
            <ChevronRightIcon />
          </TouchableOpacity>

          <TouchableOpacity style={[sheet.option, sheet.optionSpacer]} activeOpacity={0.85} onPress={() => handleSelect(onAlumni)}>
            <View style={sheet.optionIcon}>
              <AlumniIcon />
            </View>
            <View style={sheet.optionText}>
              <Text style={sheet.optionTitle}>Create Alumni Account</Text>
              <Text style={sheet.optionDesc}>Reconnect with your school and alumni community.</Text>
            </View>
            <ChevronRightIcon />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, isSubmitting, error, clearError } = useAuth();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await login(email.trim(), password);
  };

  const heroSize = Math.min(Math.max(width * 0.4, 150), 200);

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header: logo centered, no back button */}
          <View style={styles.header}>
            <Image source={require('../assets/images/app-icon.png')} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brandName}>MuslimEdu</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={styles.title}>
                Peace be{'\n'}
                <Text style={styles.titleGreen}>upon you!</Text>
              </Text>
              <Text style={styles.subtitle}>
                Connect through <Text style={styles.subtitleGreen}>Education.</Text>
              </Text>
            </View>
            <Image
              source={require('../assets/images/students-illustration-transparent.png')}
              style={{ width: heroSize, height: heroSize }}
              resizeMode="contain"
            />
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>E-Mail</Text>
            <View style={styles.inputRow}>
              <MailIcon />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) clearError();
                }}
              />
            </View>

            <Text style={[styles.fieldLabel, styles.passwordLabel]}>Password</Text>
            <View style={styles.inputRow}>
              <LockIcon />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) clearError();
                }}
              />
              <TouchableOpacity onPress={() => setSecure((s) => !s)} hitSlop={12}>
                <EyeIcon open={!secure} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsRow}>
              <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((r) => !r)} activeOpacity={0.8}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <CheckIcon />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.loginButton, !canSubmit && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSubmitting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.loginButtonText}>Log In</Text>}
            </TouchableOpacity>

            {/* Simple secondary action: a plain text link, not a flashy card. */}
            <TouchableOpacity
              style={styles.getStartedRow}
              activeOpacity={0.7}
              onPress={() => setSheetOpen(true)}
            >
              <Text style={styles.getStartedMuted}>New here? </Text>
              <Text style={styles.getStartedLink}>Get Started</Text>
              <ChevronRightIcon size={16} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <GetStartedSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSchool={() => {
          setSheetOpen(false);
          // navigation.navigate('SchoolRegistration');
        }}
        onAlumni={() => {
          setSheetOpen(false);
          // navigation.navigate('AlumniRegistration');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: WHITE },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 34, height: 34, borderRadius: 9, marginRight: 8 },
  brandName: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: 0.2 },

  /* Hero */
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  heroText: { flex: 1, paddingRight: 8 },
  title: { fontSize: 34, fontWeight: '800', color: INK, lineHeight: 40 },
  titleGreen: { color: BRAND_GREEN },
  subtitle: { fontSize: 14.5, color: TEXT_MUTED, marginTop: 10 },
  subtitleGreen: { color: BRAND_GREEN, fontWeight: '700' },

  /* Form */
  form: { marginTop: 24 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 8 },
  passwordLabel: { marginTop: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, color: INK, marginLeft: 12, paddingVertical: 0 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
  rememberText: { fontSize: 14.5, color: INK },
  forgotText: { fontSize: 14.5, color: BRAND_GREEN, fontWeight: '700' },
  errorText: { color: DANGER, fontSize: 13, marginTop: 10, textAlign: 'center' },

  /* Primary button: flat, solid, simple */
  loginButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  loginButtonText: { color: WHITE, fontSize: 16, fontWeight: '700' },

  /* Secondary: plain inline link */
  getStartedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  getStartedMuted: { fontSize: 14.5, color: TEXT_MUTED },
  getStartedLink: { fontSize: 14.5, color: BRAND_GREEN, fontWeight: '700', marginRight: 2 },
});

const sheet = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  handleZone: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5D9DE' },
  title: { fontSize: 22, fontWeight: '800', color: INK, marginTop: 6 },
  subtitle: { fontSize: 14, color: TEXT_MUTED, marginTop: 6, marginBottom: 22 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    backgroundColor: WHITE,
  },
  optionSpacer: { marginTop: 14 },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EAF7EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionText: { flex: 1, paddingRight: 10 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: INK },
  optionDesc: { fontSize: 12.5, color: TEXT_MUTED, marginTop: 3, lineHeight: 17 },
});
