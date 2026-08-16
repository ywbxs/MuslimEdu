import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
  Animated,
  Easing,
  Pressable,
  PanResponder,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import LanguageSwitcherButton from '../components/LanguageSwitcherButton';
import HeroGlow from '../components/HeroGlow';

// ============================================================================
// Login-specific teal/mint palette (deliberately its own thing, not the
// app-wide BRAND green from theme/glass - same "this screen owns its own
// colors" precedent the old version already used for BORDER/DANGER). Logo +
// illustration are the real assets from src/assets/images, not hand-drawn SVG.
// ============================================================================
const INK = '#0D1E1C';
const MUTED = '#3A5C58';
const FAINT = '#6B8C88';
const BORDER = 'rgba(13,30,28,0.1)';
const CANVAS = '#E8F4F2';
const CANVAS_SOFT = '#F2FAF8';
const SURFACE = '#F4FAFA';
const PLACEHOLDER = '#9CA3AF';
const DANGER = '#D9534F';
const ACCENT = '#1FAE64';
const ACCENT_MID = '#0F7A3D';
const ACCENT_LIGHT = '#4CAF50';
const ACCENT_GHOST = 'rgba(31,174,100,0.08)';
const ACCENT_BORDER = 'rgba(31,174,100,0.15)';

const APP_ICON = require('../assets/images/app-icon.png');
const STUDENTS_ILLUSTRATION = require('../assets/images/students-illustration-transparent.png');

/* ========================= ICONS ========================= */

function MailIcon({ color = ACCENT, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={1.7} />
      <Path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockIcon({ color = ACCENT, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={1.7} />
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx="12" cy="16" r="1" fill={color} />
    </Svg>
  );
}

function EyeIcon({ open, color = MUTED, size = 20 }: { open: boolean; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {open ? (
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.7} />
      ) : (
        <Line x1="4" y1="20" x2="20" y2="4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      )}
    </Svg>
  );
}

function ChevronLeftIcon({ color = INK, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon({ color = ACCENT, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ color = '#FFFFFF', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4 10-11" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SchoolIcon({ color = ACCENT, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10l9-5 9 5-9 5-9-5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7 12v5c0 1 2.2 2 5 2s5-1 5-2v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AlumniIcon({ color = ACCENT, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4L2 9l10 5 8-4v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 12v4c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ========================= GRADIENT BUTTON ========================= */

function GradientButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}) {
  const { t } = useLocale();
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} disabled={disabled || loading} style={[btn.wrap, style]}>
      <LinearGradient
        colors={[ACCENT_LIGHT, ACCENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[btn.gradient, (disabled || loading) && btn.disabled]}
      >
        <Text style={btn.text}>{loading ? t('login.please_wait', 'Please wait…') : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const btn = StyleSheet.create({
  wrap: { borderRadius: 999 },
  gradient: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

/* ========================= GET STARTED SHEET ========================= */

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
  const { t } = useLocale();
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

        <Animated.View style={[sheet.cardWrap, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={sheet.handleZone}>
            <View style={sheet.handle} />
          </View>

          <Text style={sheet.title}>{t('login.get_started', 'Get Started')}</Text>
          <Text style={sheet.subtitle}>{t('login.get_started_subtitle', "Choose how you'd like to join MuslimEdu.")}</Text>

          <TouchableOpacity style={sheet.option} activeOpacity={0.85} onPress={() => handleSelect(onSchool)}>
            <View style={sheet.optionIcon}>
              <SchoolIcon />
            </View>
            <View style={sheet.optionText}>
              <Text style={sheet.optionTitle}>{t('login.register_school_title', 'Register Your School')}</Text>
              <Text style={sheet.optionDesc}>{t('login.register_school_desc', 'Create and manage your institution with MuslimEdu.')}</Text>
            </View>
            <ChevronRightIcon />
          </TouchableOpacity>

          <TouchableOpacity style={[sheet.option, sheet.optionSpacer]} activeOpacity={0.85} onPress={() => handleSelect(onAlumni)}>
            <View style={sheet.optionIcon}>
              <AlumniIcon />
            </View>
            <View style={sheet.optionText}>
              <Text style={sheet.optionTitle}>{t('login.create_alumni_title', 'Create Alumni Account')}</Text>
              <Text style={sheet.optionDesc}>{t('login.create_alumni_desc', 'Reconnect with your school and alumni community.')}</Text>
            </View>
            <ChevronRightIcon />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ========================= STEP DOTS ========================= */

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={dots.row}>
      <View style={[dots.dot, step === 1 && dots.active]} />
      <View style={[dots.dot, step === 2 && dots.active]} />
    </View>
  );
}

/* ========================= FOOTER ========================= */

const FOOTER_LINK_KEYS = ['product', 'how_it_works', 'manhaj', 'resources', 'faq', 'guidelines'] as const;
const FOOTER_LINK_FALLBACKS: Record<string, string> = {
  product: 'Product',
  how_it_works: 'How It Works',
  manhaj: 'Manhaj',
  resources: 'Resources',
  faq: 'FAQ',
  guidelines: 'Guidelines',
};
const FOOTER_SECONDARY_LINK_KEYS = ['privacy_statement', 'terms'] as const;
const FOOTER_SECONDARY_LINK_FALLBACKS: Record<string, string> = {
  privacy_statement: 'Privacy Statement',
  terms: 'Terms',
};

function FooterLinkRow({
  itemKeys,
  fallbacks,
  textStyle,
  rowStyle,
}: {
  itemKeys: readonly string[];
  fallbacks: Record<string, string>;
  textStyle: any;
  rowStyle?: any;
}) {
  const { t } = useLocale();
  return (
    <View style={[footer.linkRow, rowStyle]}>
      {itemKeys.map((key, index) => (
        <View key={key} style={footer.linkItem}>
          <Text style={textStyle}>{t(`login.footer_${key}`, fallbacks[key])}</Text>
          {index < itemKeys.length - 1 && <View style={footer.separator} />}
        </View>
      ))}
    </View>
  );
}

function Footer() {
  const { t } = useLocale();
  return (
    <View style={footer.container}>
      <FooterLinkRow itemKeys={FOOTER_LINK_KEYS} fallbacks={FOOTER_LINK_FALLBACKS} textStyle={footer.linkText} />
      <FooterLinkRow
        itemKeys={FOOTER_SECONDARY_LINK_KEYS}
        fallbacks={FOOTER_SECONDARY_LINK_FALLBACKS}
        textStyle={footer.linkText}
        rowStyle={footer.secondaryRow}
      />
      <Text style={footer.copyright}>{t('login.copyright', '© 2026 MuslimEdu. All rights reserved.')}</Text>
    </View>
  );
}

/* ========================= MAIN SCREEN ========================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, isSubmitting, error, clearError, requiresTwoFactor, resetTwoFactorPrompt } = useAuth();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  // Which input row currently has focus, so it can pick up the accent
  // border highlight (mirrors the mockup's `:focus-within` treatment).
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'twoFactor' | null>(null);

  // The server told us this account needs a code - move to step 3 once,
  // without fighting the user if they navigate back and the flag is still
  // true from a moment ago.
  useEffect(() => {
    if (requiresTwoFactor && step !== 3) {
      direction.current = 1;
      setStep(3);
    }
  }, [requiresTwoFactor]);

  const passwordRef = useRef<TextInput>(null);

  // Simple enter transition: whichever step is active fades + slides in.
  // Only one step is ever mounted at a time, so there's no risk of two
  // full-screen panels visually overlapping.
  const direction = useRef<1 | -1>(1);
  const enterX = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fromX = direction.current === 1 ? 28 : -28;
    enterX.setValue(fromX);
    enterOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(enterX, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (step === 2) {
        // Delay focus slightly so the keyboard opens after the transition
        // has fully settled, not while the layout is still animating.
        setTimeout(() => passwordRef.current?.focus(), 80);
      }
    });
  }, [step]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;
  const canSubmitTwoFactor = twoFactorCode.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await login(email.trim(), password);
  };

  const handleSubmitTwoFactor = async () => {
    if (!canSubmitTwoFactor) return;
    await login(email.trim(), password, twoFactorCode.trim());
  };

  const goToStep2 = () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(t('login.invalid_email', 'Please enter a valid email address.'));
      return;
    }
    setEmailError('');
    direction.current = 1;
    setStep(2);
  };

  const goToStep1 = () => {
    direction.current = -1;
    setEmailError('');
    setStep(1);
  };

  const goBackFromTwoFactor = () => {
    direction.current = -1;
    setTwoFactorCode('');
    resetTwoFactorPrompt();
    if (error) clearError();
    setStep(2);
  };

  const heroSideSize = Math.min(Math.max(width * 0.32, 105), 165);

  return (
    <View style={styles.flex}>
      {/* No <StatusBar> here at all - see AnimatedSplash.tsx for why: even
          barStyle-only still crashed, since RN's StatusBar calls the
          Android native module's setColor() for any mounted instance
          regardless of which props are passed, and that method is missing
          on this build. */}
      <LinearGradient
        colors={[CANVAS_SOFT, CANVAS]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          {/* Top bar changes per step but always stays pinned at the top,
              outside the animated block, so it never participates in the
              transition and can never be pushed around by it. */}
          {step === 1 ? (
            <View style={styles.topbar}>
              <Image source={APP_ICON} style={styles.logoImg} resizeMode="contain" />
              <Text style={styles.topbarTitle}>MuslimEdu</Text>
              <View style={{ flex: 1 }} />
              <LanguageSwitcherButton variant="pill" />
            </View>
          ) : (
            <View style={styles.topbar}>
              <TouchableOpacity style={styles.backBtn} onPress={step === 3 ? goBackFromTwoFactor : goToStep1} hitSlop={12}>
                <ChevronLeftIcon />
              </TouchableOpacity>
              <Text style={styles.topbarTitle}>
                {step === 3 ? t('login.verify_its_you', "Verify it's you") : t('login.sign_in', 'Sign in')}
              </Text>
            </View>
          )}

          <Animated.View
            renderToHardwareTextureAndroid
            needsOffscreenAlphaCompositing
            collapsable={false}
            style={{
              opacity: enterOpacity,
              transform: [{ translateX: enterX }],
              backgroundColor: CANVAS,
            }}
          >
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>
                {step === 3 ? t('login.step_pill_two_factor', 'TWO-FACTOR') : t('login.step_pill', 'STEP {step} OF 2').replace('{step}', String(step))}
              </Text>
            </View>

            {step === 1 ? (
              <View style={styles.heroRow}>
                <View style={styles.heroTextCol}>
                  <Text style={styles.titleCompact}>
                    {t('login.greeting_peace_be', 'Peace be')}{'\n'}
                    <Text style={styles.titleAccentItalic}>{t('login.greeting_upon_you', 'upon you!')}</Text>
                  </Text>
                  <View style={styles.subtitleRow}>
                    <Text style={styles.subtitle}>{t('login.connect_through', 'Connect through ')}</Text>
                    <Text style={styles.subtitleGreen}>{t('login.education', 'Education.')}</Text>
                  </View>
                </View>

                <View style={styles.illustrationWrapRow}>
                  <Image
                    source={STUDENTS_ILLUSTRATION}
                    style={{ width: heroSideSize, height: heroSideSize * 1.15 }}
                    resizeMode="contain"
                  />
                </View>
              </View>
            ) : step === 2 ? (
              <View style={styles.hero}>
                <Text style={styles.title}>
                  {t('login.welcome', 'Welcome')}{'\n'}
                  <Text style={styles.titleGreen}>{t('login.back', 'back!')}</Text>
                </Text>
                <View style={styles.emailChip}>
                  <MailIcon color={ACCENT} size={14} />
                  <Text style={styles.emailChipText} numberOfLines={1}>
                    {email.trim()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.hero}>
                <Text style={styles.title}>
                  {t('login.one_more', 'One more')}{'\n'}
                  <Text style={styles.titleGreen}>{t('login.step_dot', 'step.')}</Text>
                </Text>
                <Text style={styles.subtitle}>{t('login.enter_authenticator_code', 'Enter the code from your authenticator app.')}</Text>
              </View>
            )}

            <View style={styles.cardOuter}>
              {/* Same emerald-green radial glow used on the dashboard hero
                  headers (HeroGlow) - lives OUTSIDE the card (which keeps
                  its own overflow:'hidden' for its own content) so the glow
                  isn't clipped and actually extends past the card's edge
                  into the page background instead of staying inside it. */}
              <HeroGlow />
              <View style={styles.card}>
              {step === 1 ? (
                <>
                  <Text style={styles.fieldLabel}>{t('login.email_label', 'E-MAIL')}</Text>
                  <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
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
                        if (emailError) setEmailError('');
                        if (error) clearError();
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                      onSubmitEditing={goToStep2}
                      returnKeyType="next"
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                  <Text style={styles.helperText}>{t('login.email_helper', "We'll verify your account, then set up your password.")}</Text>

                  <GradientButton label={t('login.continue', 'Continue')} onPress={goToStep2} style={styles.actionSpacing} />
                </>
              ) : step === 2 ? (
                <>
                  <Text style={styles.fieldLabel}>{t('login.password_label', 'PASSWORD')}</Text>
                  <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
                    <LockIcon />
                    <TextInput
                      // Remounting on toggle works around an Android quirk where
                      // secureTextEntry can silently stop masking new keystrokes
                      // after the value has already been flipped once.
                      key={secure ? 'password-secure' : 'password-visible'}
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor={PLACEHOLDER}
                      secureTextEntry={secure}
                      textContentType="password"
                      autoComplete="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (error) clearError();
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                      onSubmitEditing={handleSubmit}
                      returnKeyType="go"
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
                      <Text style={styles.rememberText}>{t('login.remember_me', 'Remember me')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8}>
                      <Text style={styles.forgotText}>{t('login.forgot_password', 'Forgot password?')}</Text>
                    </TouchableOpacity>
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <GradientButton
                    label={t('login.log_in', 'Log In')}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    loading={isSubmitting}
                    style={styles.actionSpacing}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{t('login.auth_code_label', 'AUTHENTICATION CODE')}</Text>
                  <View style={[styles.inputRow, focusedField === 'twoFactor' && styles.inputRowFocused]}>
                    <LockIcon />
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit code or recovery code"
                      placeholderTextColor={PLACEHOLDER}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={twoFactorCode}
                      onChangeText={(text) => {
                        setTwoFactorCode(text);
                        if (error) clearError();
                      }}
                      onFocus={() => setFocusedField('twoFactor')}
                      onBlur={() => setFocusedField((f) => (f === 'twoFactor' ? null : f))}
                      onSubmitEditing={handleSubmitTwoFactor}
                      returnKeyType="go"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.helperText}>
                    {t(
                      'login.auth_code_helper',
                      "Open your authenticator app for the current code, or use one of your saved recovery codes if you've lost access to it.",
                    )}
                  </Text>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <GradientButton
                    label={t('login.verify', 'Verify')}
                    onPress={handleSubmitTwoFactor}
                    disabled={!canSubmitTwoFactor}
                    loading={isSubmitting}
                    style={styles.actionSpacing}
                  />
                </>
              )}

              {step !== 3 && <StepDots step={step} />}

              <TouchableOpacity style={styles.getStartedRow} activeOpacity={0.7} onPress={() => setSheetOpen(true)}>
                <Text style={styles.getStartedMuted}>{t('login.new_here', 'New here? ')}</Text>
                <Text style={styles.getStartedLink}>{t('login.get_started', 'Get Started')}</Text>
              </TouchableOpacity>
            </View>
            </View>
          </Animated.View>

          <Footer />
        </View>
      </KeyboardAvoidingView>

      <GetStartedSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSchool={() => {
          setSheetOpen(false);
          (navigation as any).navigate('SchoolRegistration');
        }}
        onAlumni={() => {
          setSheetOpen(false);
          (navigation as any).navigate('AlumniRegistration');
        }}
      />
    </View>
  );
}


/* ========================= STYLES ========================= */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },

  screen: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },

  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logoImg: { width: 32, height: 32, borderRadius: 9 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  topbarTitle: { fontSize: 15, fontWeight: '800', color: INK, letterSpacing: -0.3 },

  stepPill: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: INK,
  },
  stepPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: ACCENT_LIGHT },

  hero: { marginTop: 16 },
  title: { fontSize: 34, fontWeight: '800', color: INK, lineHeight: 39, letterSpacing: -0.5 },
  titleGreen: { color: ACCENT },
  // The mockup's Playfair Display italic flourish on "upon you!" - see
  // android-fonts/README.md for how this .ttf gets into the build.
  // fontWeight is pinned to '400' (not inherited '800' from titleCompact)
  // because this asset is a single fixed-weight (600) instance; letting a
  // heavier requested weight through would make Android look for a
  // "PlayfairDisplay-SemiBoldItalic-Bold" variant that doesn't exist.
  titleAccentItalic: { color: ACCENT, fontFamily: 'PlayfairDisplay-SemiBoldItalic', fontWeight: '400' },

  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  heroTextCol: { flex: 1 },
  titleCompact: { fontSize: 27, fontWeight: '800', color: INK, lineHeight: 32, letterSpacing: -0.4 },

  subtitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 8 },
  subtitle: { fontSize: 15, color: MUTED, lineHeight: 21 },
  subtitleGreen: { fontSize: 15, color: ACCENT, fontWeight: '700', lineHeight: 21 },

  illustrationWrapRow: { alignItems: 'center', justifyContent: 'center' },

  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: ACCENT_GHOST,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  emailChipText: { fontSize: 13, fontWeight: '700', color: ACCENT, flexShrink: 1 },

  // Plain wrapper, no overflow:'hidden' - lets HeroGlow's circles (an
  // absolutely-positioned sibling of `card` below) extend past the card's
  // edge into the page background instead of getting clipped to it.
  cardOuter: { marginTop: 20 },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: 20,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },

  fieldLabel: { fontSize: 12, fontWeight: '800', color: FAINT, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputRowFocused: { borderColor: ACCENT_MID, backgroundColor: '#FFFFFF' },
  input: { flex: 1, fontSize: 16, color: INK, paddingVertical: 0 },

  helperText: { fontSize: 12.5, color: FAINT, marginTop: 10, lineHeight: 18 },
  errorText: { color: DANGER, fontSize: 12.5, fontWeight: '600', marginTop: 8 },

  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12, flexWrap: 'wrap' },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  rememberText: { fontSize: 13, color: INK, fontWeight: '600' },
  forgotText: { fontSize: 13, color: ACCENT, fontWeight: '800' },

  actionSpacing: { marginTop: 18 },

  getStartedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  getStartedMuted: { fontSize: 13, color: FAINT, fontWeight: '600' },
  getStartedLink: { fontSize: 13, color: ACCENT, fontWeight: '800' },
});

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: BORDER },
  active: { width: 24, backgroundColor: INK },
});

const sheet = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,30,22,0.55)' },
  cardWrap: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  handleZone: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(19,42,32,0.25)' },
  title: { fontSize: 22, fontWeight: '800', color: INK, marginTop: 6 },
  subtitle: { fontSize: 14, color: MUTED, marginTop: 6, marginBottom: 22, lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    backgroundColor: SURFACE,
  },
  optionSpacer: { marginTop: 14 },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ACCENT_GHOST,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionText: { flex: 1, paddingRight: 10 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: INK },
  optionDesc: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 18 },
});

const footer = StyleSheet.create({
  container: {
    marginTop: 'auto',
    paddingTop: 28,
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: { marginTop: 18 },
  linkItem: { flexDirection: 'row', alignItems: 'center' },
  linkText: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: BORDER,
    marginHorizontal: 9,
  },
  copyright: {
    fontSize: 12.5,
    color: MUTED,
    marginTop: 18,
  },
});
