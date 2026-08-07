import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import { updateMyProfile } from '../../services/userProfileService';
import {
  prepareProfilePhoto,
  InvalidPhotoTypeError,
  formatBytes,
  MAX_PHOTO_BYTES,
} from '../../utils/imagePrep';

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';

interface PendingPhoto {
  uri: string;
  fileName: string;
  type: string;
}

function CameraIcon({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.4} stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

/**
 * Generic "edit my own profile" screen, available to every role - name,
 * email, address, and profile photo. Reached from the camera-icon entry
 * point each dashboard shows next to the user's avatar (StudentDashboard/
 * TeacherDashboard's existing glassCard button, or the one added to
 * DashboardShell/AdminDashboard for every other role).
 *
 * Distinct from AccountSettingsScreen (language/theme/privacy/password)
 * and from the admin-only onboarding wizard's "Your Info" step
 * (name+phone only, no email/address/photo) - this is the one place email
 * can be changed post-signup, with a server-side duplicate check.
 */
export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const { t } = useLocale();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(user?.photo ?? null);
  const [newPhoto, setNewPhoto] = useState<PendingPhoto | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initial = name.trim()?.[0]?.toUpperCase() ?? '?';

  const pickPhoto = async () => {
    setPhotoError(null);
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 1 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setPickingPhoto(true);
    try {
      const prepared = await prepareProfilePhoto(asset.uri as string, asset.fileName ?? undefined, asset.type ?? undefined);
      setNewPhoto(prepared);
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        setPhotoError(err.message);
      } else {
        setPhotoError(t('edit_profile.photo_process_error', 'Could not process that image. Please try a different one.'));
      }
    } finally {
      setPickingPhoto(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('edit_profile.name_required', 'Name is required.'));
      return;
    }
    if (!email.trim()) {
      Alert.alert(t('common.error', 'Error'), t('edit_profile.email_required', 'Email is required.'));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile(token, {
        name: name.trim(),
        email: email.trim(),
        address: address.trim() || null,
        photo: newPhoto ? { uri: newPhoto.uri, fileName: newPhoto.fileName, type: newPhoto.type } : undefined,
      });
      updateUser(updated);
      setExistingPhotoUrl(updated.photo ?? null);
      setNewPhoto(null);
      Alert.alert(t('edit_profile.saved_title', 'Saved'), t('edit_profile.saved_message', 'Your profile has been updated.'));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('edit_profile.save_error', 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const displayPhoto = newPhoto?.uri ?? existingPhotoUrl;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('edit_profile.title', 'Edit Profile')}</Text>
          <Text style={styles.headerSub}>{t('edit_profile.subtitle', 'Name, email, address and photo')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={pickPhoto} disabled={pickingPhoto} activeOpacity={0.85}>
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {pickingPhoto ? <ActivityIndicator size="small" color="#FFFFFF" /> : <CameraIcon size={15} />}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {t('edit_profile.photo_hint', 'Max {size} - larger images are compressed automatically. JPG, JPEG, or PNG.').replace(
                '{size}',
                formatBytes(MAX_PHOTO_BYTES),
              )}
            </Text>
            {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t('edit_profile.name_label', 'Name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('edit_profile.name_placeholder', 'Your full name')}
              placeholderTextColor={SUBTLE}
            />

            <Text style={styles.label}>{t('edit_profile.email_label', 'Email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('edit_profile.email_placeholder', 'you@example.com')}
              placeholderTextColor={SUBTLE}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('edit_profile.address_label', 'Address (optional)')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('edit_profile.address_placeholder', 'Your address')}
              placeholderTextColor={SUBTLE}
              multiline
            />
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>{t('edit_profile.save', 'Save Changes')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  flexInner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  avatarWrap: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F2F2F7' },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 34, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: EMERALD,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
  errorText: { color: '#E5484D', fontSize: 12.5, textAlign: 'center', marginTop: 6, paddingHorizontal: 24 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  saveBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
