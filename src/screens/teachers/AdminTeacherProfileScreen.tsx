import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchTeacherProfile, updateTeacherProfile, TeacherProfile, TeacherBasicProfileFields } from '../../services/adminTeacherService';
import { Skeleton } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const DANGER = '#D70015';
const TRACK_BG = '#F4F5F7';
const HAIRLINE = '#EDEDED';
const CANVAS = '#F4F5F7';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

function IconPencil({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value ?? '—'}</Text>
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SUBTLE}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

type EditableFields = {
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  birthday: string;
  password: string;
};

const emptyEditable: EditableFields = {
  name: '',
  email: '',
  phone: '',
  address: '',
  gender: '',
  birthday: '',
  password: '',
};

/**
 * A teacher's full profile. `isAdmin` (defaults true - this screen is
 * admin-only today) gates the pencil button; tapping it switches the info
 * cards to editable TextInputs. Save calls admin_teacher_profile_update
 * with name/email/phone/address/gender/birthday and an optional password
 * reset (only sent when non-empty, so leaving it blank keeps the current
 * password).
 */
export default function AdminTeacherProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { teacherId, teacherName, isAdmin = true } = (route.params as { teacherId: number; teacherName: string; isAdmin?: boolean }) ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState<EditableFields>(emptyEditable);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchTeacherProfile(token, teacherId);
      setProfile(data);
      setFields({
        name: data.name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        gender: data.gender ?? '',
        birthday: data.birthday ?? '',
        password: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_teacher_profile.load_error', 'Failed to load profile.'));
    }
  }, [token, teacherId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleSave = async () => {
    if (!token) return;
    if (!fields.name.trim() || !fields.email.trim()) {
      Alert.alert(t('admin_teacher_profile.missing_info_title', 'Missing info'), t('admin_teacher_profile.missing_info_message', 'Name and email are required.'));
      return;
    }
    setIsSaving(true);
    try {
      const updateFields: TeacherBasicProfileFields = {
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        address: fields.address.trim(),
        gender: fields.gender.trim(),
        birthday: fields.birthday.trim(),
      };
      if (fields.password.trim()) {
        updateFields.password = fields.password.trim();
      }
      await updateTeacherProfile(token, teacherId, updateFields);
      setFields((p) => ({ ...p, password: '' }));
      setIsEditing(false);
      Alert.alert(t('admin_teacher_profile.saved_title', 'Saved'), t('admin_teacher_profile.saved_message', "The teacher's profile has been updated."));
      load();
    } catch (err) {
      Alert.alert(t('admin_teacher_profile.save_error', 'Could not save'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFields({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        gender: profile.gender ?? '',
        birthday: profile.birthday ?? '',
        password: '',
      });
    }
    setIsEditing(false);
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{teacherName ?? t('admin_teacher_profile.title', 'Profile')}</Text>
        {isAdmin && !isLoading && profile && !isEditing ? (
          <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={10} style={styles.editBtn}>
            <IconPencil color={EMERALD} />
            <Text style={styles.editBtnText}>{t('common.edit', 'Edit')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.scrollContent}>
          <View style={styles.avatarWrap}>
            <Skeleton width={84} height={84} borderRadius={42} />
            <Skeleton width={140} height={16} style={{ marginTop: 14 }} />
          </View>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.infoCard}>
              <Skeleton width={70} height={11} style={{ marginBottom: 8 }} />
              <Skeleton width="70%" height={14} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : profile ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <UserAvatar name={profile.name} photo={profile.photo} size={84} ringColor={HAIRLINE} dotColor={null} />
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.designation ? <Text style={styles.profileDesignation}>{profile.designation}</Text> : null}
          </View>

          {isEditing ? (
            <>
              <EditField label={t('admin_teacher_profile.name', 'Name')} value={fields.name} onChangeText={(v) => setFields((p) => ({ ...p, name: v }))} />
              <EditField label={t('admin_teacher_profile.email', 'Email')} value={fields.email} onChangeText={(v) => setFields((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <EditField label={t('admin_teacher_profile.phone', 'Phone')} value={fields.phone} onChangeText={(v) => setFields((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
              <EditField label={t('admin_teacher_profile.address', 'Address')} value={fields.address} onChangeText={(v) => setFields((p) => ({ ...p, address: v }))} />
              <EditField label={t('admin_teacher_profile.gender', 'Gender')} value={fields.gender} onChangeText={(v) => setFields((p) => ({ ...p, gender: v }))} placeholder={t('admin_teacher_profile.gender_placeholder', 'male / female')} autoCapitalize="none" />
              <EditField label={t('admin_teacher_profile.birthday', 'Birthday')} value={fields.birthday} onChangeText={(v) => setFields((p) => ({ ...p, birthday: v }))} placeholder="YYYY-MM-DD" />
              <EditField label={t('admin_teacher_profile.new_password', 'New Password')} value={fields.password} onChangeText={(v) => setFields((p) => ({ ...p, password: v }))} placeholder={t('admin_teacher_profile.password_placeholder', 'Leave blank to keep current password')} secureTextEntry autoCapitalize="none" />

              <View style={styles.editActionsRow}>
                <TouchableOpacity style={[styles.editActionBtn, styles.editActionBtnGhost]} onPress={handleCancel} disabled={isSaving}>
                  <Text style={styles.editActionBtnGhostText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editActionBtn, styles.editActionBtnPrimary]} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.editActionBtnPrimaryText}>{t('admin_teacher_profile.save', 'Save')}</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.email', 'Email')} value={profile.email} />
              </View>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.phone', 'Phone')} value={profile.phone} />
              </View>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.address', 'Address')} value={profile.address} />
              </View>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.gender', 'Gender')} value={profile.gender} />
              </View>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.birthday', 'Birthday')} value={profile.birthday} />
              </View>
              <View style={styles.infoCard}>
                <InfoRow label={t('admin_teacher_profile.staff_code', 'Staff Code')} value={profile.code} />
              </View>
            </>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 40, justifyContent: 'flex-end' },
  editBtnText: { color: EMERALD, fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  profileName: { fontSize: 19, fontWeight: '700', color: INK, marginTop: 12 },
  profileDesignation: { fontSize: 13, color: SUBTLE, marginTop: 3 },

  infoCard: { backgroundColor: GLASS_SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOW.level1,
  },
  infoRow: {},
  infoLabel: { fontSize: 11.5, fontWeight: '600', color: SUBTLE, textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 15, color: INK },

  editLabel: { fontSize: 11.5, fontWeight: '600', color: SUBTLE, textTransform: 'uppercase', marginBottom: 6 },
  editInput: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
  },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editActionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  editActionBtnGhost: { backgroundColor: GLASS_SURFACE, borderWidth: 1, borderColor: GLASS_BORDER },
  editActionBtnGhostText: { color: INK, fontWeight: '600' },
  editActionBtnPrimary: { backgroundColor: EMERALD },
  editActionBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
});
