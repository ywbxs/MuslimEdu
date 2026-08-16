import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchSetupStatus, saveInstitutionProfile, SchoolProfile } from '../../services/academicSetupService';
import { prepareProfilePhoto, InvalidPhotoTypeError, PreparedPhoto } from '../../utils/imagePrep';
import StudentIdCard, { CARD_THEMES } from '../../components/StudentIdCard';
import GlassBackground from '../../components/glass/GlassBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const BORDER = COLORS.border;
const DANGER = COLORS.danger;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}

const SAMPLE_STUDENT = {
  name: 'Jane Student',
  photo: null,
  code: 'DEMO-0001',
  className: 'Grade 5',
  sectionName: 'A',
};

/**
 * Admin uploads ONE custom background image used on every student's
 * ID card at this school - not a per-card choice. Reuses the same
 * admin_school_profile_update endpoint InstitutionProfileScreen uses
 * (via saveInstitutionProfile), but only ever sends the one
 * `id_card_background` field, so it's safe to call from this focused
 * screen without needing to also carry every other institution-profile
 * field along with it.
 */
export default function IdCardTemplateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBackground, setNewBackground] = useState<PreparedPhoto | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const status = await fetchSetupStatus(token);
      setSchool(status.school);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('id_card_template.load_error', 'Could not load the ID card template.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickBackground = async () => {
    setPhotoError(null);
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 1 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setIsPicking(true);
    try {
      const prepared = await prepareProfilePhoto(asset.uri as string, asset.fileName ?? undefined, asset.type ?? undefined);
      setNewBackground(prepared);
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        setPhotoError(err.message);
      } else {
        setPhotoError(t('id_card_template.photo_process_error', 'Could not process that image. Please try a different one.'));
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handleSave = async () => {
    if (!token || !newBackground) return;
    setIsSaving(true);
    try {
      const updated = await saveInstitutionProfile(token, {
        id_card_background: { uri: newBackground.uri, fileName: newBackground.fileName, type: newBackground.type },
      });
      setSchool(updated);
      setNewBackground(null);
      Alert.alert(
        t('id_card_template.saved_title', 'Saved'),
        t('id_card_template.saved_message', 'Every student’s ID card will now use this background.'),
      );
    } catch (err) {
      Alert.alert(
        t('id_card_template.save_error_title', 'Could not save'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const previewBackgroundUrl = newBackground?.uri ?? school?.id_card_background ?? null;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('id_card_template.title', 'ID Card Template')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={EMERALD} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>{t('id_card_template.preview_label', 'Preview')}</Text>
          <View style={styles.previewWrap}>
            <StudentIdCard student={SAMPLE_STUDENT} theme={CARD_THEMES[0]} backgroundImageUrl={previewBackgroundUrl} />
          </View>

          <Text style={styles.hint}>
            {t(
              'id_card_template.hint',
              'This background will be used on every student’s ID card at your school. If none is set, cards use a default color theme instead.',
            )}
          </Text>

          <TouchableOpacity style={styles.pickBtn} onPress={pickBackground} activeOpacity={0.85} disabled={isPicking}>
            {isPicking ? (
              <ActivityIndicator color={EMERALD} />
            ) : (
              <Text style={styles.pickBtnText}>
                {previewBackgroundUrl ? t('id_card_template.change_image', 'Change Background Image') : t('id_card_template.choose_image', 'Choose Background Image')}
              </Text>
            )}
          </TouchableOpacity>
          {photoError ? <Text style={styles.photoErrorText}>{photoError}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, !newBackground && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={!newBackground || isSaving}
          >
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
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
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },

  content: { padding: SPACING.lg, alignItems: 'center' },
  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', marginBottom: 12, alignSelf: 'flex-start' },
  previewWrap: { marginBottom: SPACING.md, ...SHADOW.level2 },

  hint: { fontSize: 12.5, color: SUBTLE, textAlign: 'center', lineHeight: 18, marginBottom: SPACING.lg, paddingHorizontal: 8 },

  pickBtn: {
    alignSelf: 'stretch',
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: EMERALD,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  pickBtnText: { color: EMERALD, fontWeight: '700', fontSize: 14.5 },
  photoErrorText: { color: DANGER, fontSize: 12.5, textAlign: 'center', marginBottom: 10 },

  saveBtn: { alignSelf: 'stretch', backgroundColor: EMERALD, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
