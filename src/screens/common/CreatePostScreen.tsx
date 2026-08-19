import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronLeft, Plus, X, Users, Globe, Lock, Check, ImagePlus } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import UserAvatar from '../../components/UserAvatar';
import { PickedImage, Post, PostPrivacy, createPost, repost, updatePost } from '../../services/postService';
import { preparePostPhoto, InvalidPhotoTypeError, MAX_POST_COMPOSER_PHOTO_BYTES } from '../../utils/imagePrep';
import { checkImageModeration, ModeratedContentError } from '../../services/contentModerationService';
import { WizardStepHeader } from '../../components/wizard/WizardKit';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, COLORS } from '../../theme/spatial';
const EMERALD = '#1FAE64';
const EMERALD_DEEP = BRAND.emeraldDeep;
const EMERALD_SOFT = 'rgba(31,174,100,0.08)';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const HAIRLINE = '#ECEEF0';
const PLACEHOLDER = '#EDEFF2';
const MAX_IMAGES = 20;

function CloseIcon({ color = '#FFFFFF', size = 14 }: { color?: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.4} />;
}
function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function PlusIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.2} />;
}
function ImagePlusIcon({ color = EMERALD_DEEP, size = 26 }: { color?: string; size?: number }) {
  return <ImagePlus size={size} color={color} strokeWidth={1.8} />;
}
// Filled check for "selected", plain outline ring otherwise - matches the
// met/unmet checklist pattern used elsewhere in the app (SchoolRegistrationScreen's
// password rules), so selection reads by shape too, not just color.
function OptionRadio({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <View style={styles.radioSelected}>
        <Check size={12} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  }
  return <View style={styles.radioEmpty} />;
}

const PRIVACY_OPTIONS: { key: PostPrivacy; labelKey: string; label: string; descKey: string; desc: string; Icon: typeof Users }[] = [
  { key: 'school', labelKey: 'school', label: 'School', descKey: 'privacy_desc_school', desc: 'People at your school can see this', Icon: Users },
  { key: 'public', labelKey: 'public', label: 'Public', descKey: 'privacy_desc_public', desc: 'Anyone can see this', Icon: Globe },
  { key: 'private', labelKey: 'only_me', label: 'Only me', descKey: 'privacy_desc_private', desc: 'Only you can see this', Icon: Lock },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation();
  const route = useRoute();
  const repostOfId = (route.params as any)?.repostOfId as number | undefined;
  const editPost = (route.params as any)?.editPost as Post | undefined;

  const [content, setContent] = useState(editPost?.content ?? '');
  const [privacy, setPrivacy] = useState<PostPrivacy>(editPost?.privacy ?? 'school');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const hasExistingImages = !!editPost && editPost.images.length > 0;
  // Brand-new posts require a photo, same as Instagram - the caption is
  // optional on top of it. Editing an existing post (which may predate this
  // rule) and reposting (commenting on someone else's already-posted
  // content) are unaffected - neither one is "posting text only" from
  // scratch.
  const isNewPost = !editPost && !repostOfId;
  const canSubmit =
    (isNewPost
      ? images.length > 0
      : content.trim().length > 0 || images.length > 0 || hasExistingImages) &&
    !submitting &&
    !compressing;

  // Admins and teachers can author content (new posts, edits, or a repost
  // with a comment attached). Students only ever reach this screen via a
  // deep-linked/back-nav edge case, since the feed hides every entry point
  // for them - bounce them out defensively rather than trust the UI alone.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.9,
    });
    if (result.didCancel || result.errorCode || !result.assets) {
      return;
    }

    setCompressing(true);
    try {
      const picked: PickedImage[] = [];
      for (const a of result.assets) {
        if (!a.uri) continue;
        try {
          // Every photo gets squeezed down to ~100KB before it ever reaches
          // the composer preview or the upload - a post can carry up to 20
          // of them, so keeping each one small matters a lot here.
          const prepared = await preparePostPhoto(a.uri, a.fileName, a.type, a.fileSize, MAX_POST_COMPOSER_PHOTO_BYTES);
          const candidate: PickedImage = { uri: prepared.uri, fileName: prepared.fileName, type: prepared.type };

          // Nudity/violence screening before the photo is ever added to the
          // composer - blocked photos never make it into the preview strip,
          // let alone get posted. See contentModerationService.ts.
          if (token) await checkImageModeration(token, candidate);

          picked.push(candidate);
        } catch (err) {
          if (err instanceof InvalidPhotoTypeError) {
            Alert.alert(t('create_post.unsupported_photo', 'Unsupported photo'), err.message);
          } else if (err instanceof ModeratedContentError) {
            Alert.alert(t('create_post.moderation_title', "Photo can't be posted"), err.message);
          }
        }
      }
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } finally {
      setCompressing(false);
    }
  };

  const removeImage = (uri: string) => {
    const next = images.filter((p) => p.uri !== uri);
    setImages(next);
    // Keep the big preview pointing at something that still exists.
    setPreviewIndex((i) => Math.max(0, Math.min(i, next.length - 1)));
  };

  useEffect(() => {
    if (!canPost) {
      Alert.alert(t('create_post.not_allowed_title', 'Not allowed'), t('create_post.not_allowed_message', 'Only admins and teachers can create or edit posts.'));
      navigation.goBack();
    }
  }, [canPost, navigation, t]);

  if (!canPost) return null;

  const submit = async () => {
    if (!token || !canSubmit) return;
    setSubmitting(true);
    try {
      if (editPost) {
        await updatePost(token, editPost.id, { content: content.trim(), privacy });
      } else if (repostOfId) {
        await repost(token, repostOfId, content.trim() || undefined, privacy);
      } else {
        await createPost(token, { content: content.trim() || undefined, privacy }, images);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('create_post.error_title', 'Couldn’t post'), err?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const privacyPicker = (
    <View style={styles.privacySection}>
      <Text style={styles.privacyLabel}>{t('create_post.who_can_see', 'Who can see this?')}</Text>
      <View style={styles.privacyList}>
        {PRIVACY_OPTIONS.map((opt) => {
          const active = privacy === opt.key;
          const Icon = opt.Icon;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.privacyOption, active && styles.privacyOptionActive]}
              onPress={() => setPrivacy(opt.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.privacyIconWrap, active && styles.privacyIconWrapActive]}>
                <Icon size={17} color={active ? EMERALD_DEEP : SUBTLE} strokeWidth={1.9} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.privacyOptionLabel, active && styles.privacyOptionLabelActive]}>
                  {t(`create_post.privacy_${opt.labelKey}`, opt.label)}
                </Text>
                <Text style={styles.privacyOptionDesc}>{t(`create_post.${opt.descKey}`, opt.desc)}</Text>
              </View>
              <OptionRadio selected={active} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // --- New post: photo-first wizard ---------------------------------------
  // Three steps (same WizardStepHeader stepper every other wizard in the app
  // uses): the required photo, an optional caption, then who sees it - each
  // one gets its own focused screen instead of a single long scroll that
  // buried the photo requirement under a caption box and a privacy toggle.
  if (isNewPost) {
    const preview = images[previewIndex] ?? images[0];
    const isLastStep = step === 3;
    const nextDisabled = compressing || (step === 1 && images.length === 0) || (isLastStep && !canSubmit);

    const goNext = () => {
      if (nextDisabled) return;
      if (isLastStep) {
        submit();
      } else {
        setStep((s) => (Math.min(3, s + 1) as 1 | 2 | 3));
      }
    };
    const goBackStep = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3));

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => (step === 1 ? navigation.goBack() : goBackStep())} hitSlop={10}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_post.new_title', 'New Post')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <WizardStepHeader
          step={step}
          labels={[
            t('create_post.step_photo', 'Photo'),
            t('create_post.step_caption', 'Caption'),
            t('create_post.step_privacy', 'Privacy'),
          ]}
        />

        <ScrollView contentContainerStyle={styles.newBody} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <View style={styles.previewWrap}>
                {preview ? (
                  <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="cover" />
                ) : (
                  <TouchableOpacity
                    style={[styles.preview, styles.previewEmpty]}
                    activeOpacity={0.85}
                    onPress={() => pickImages()}
                    disabled={compressing}
                  >
                    {compressing ? (
                      <ActivityIndicator color={EMERALD} />
                    ) : (
                      <>
                        <View style={styles.addPhotoIconWrap}>
                          <ImagePlusIcon />
                        </View>
                        <Text style={styles.addPhotoTitle}>{t('create_post.add_photos_title', 'Add Photos')}</Text>
                        <Text style={styles.addPhotoDesc}>
                          {t('create_post.add_photos_desc', 'Choose up to 20 photos from your library')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {images.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.strip}
                  keyboardShouldPersistTaps="handled"
                >
                  {images.map((img, i) => (
                    <TouchableOpacity
                      key={img.uri}
                      style={[styles.thumbWrap, i === previewIndex && styles.thumbWrapActive]}
                      activeOpacity={0.85}
                      onPress={() => setPreviewIndex(i)}
                    >
                      <Image source={{ uri: img.uri }} style={styles.thumb} />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(img.uri)} hitSlop={8}>
                        <CloseIcon />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}

                  {images.length < MAX_IMAGES ? (
                    <TouchableOpacity
                      style={styles.addTile}
                      onPress={() => pickImages()}
                      disabled={compressing}
                      activeOpacity={0.8}
                    >
                      {compressing ? <ActivityIndicator size="small" color={EMERALD} /> : <PlusIcon />}
                    </TouchableOpacity>
                  ) : null}
                </ScrollView>
              )}
            </>
          )}

          {step === 2 && (
            <View style={styles.captionStep}>
              <View style={styles.captionRow}>
                {preview ? <Image source={{ uri: preview.uri }} style={styles.captionThumb} /> : null}
                <TextInput
                  style={styles.captionField}
                  placeholder={t('create_post.caption_placeholder', 'Add a caption (optional)...')}
                  placeholderTextColor={SUBTLE}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  autoFocus
                  maxLength={2000}
                />
              </View>
            </View>
          )}

          {step === 3 && privacyPicker}
        </ScrollView>

        <View style={[styles.shareFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.shareButton, nextDisabled && styles.shareButtonDisabled]}
            onPress={goNext}
            disabled={nextDisabled}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.shareButtonText}>{isLastStep ? t('create_post.share', 'Share') : t('create_post.next', 'Next')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- Edit / repost: text-first, unchanged -------------------------------
  // Neither one picks photos, and their text is the whole point of the
  // screen, so they keep the classic composer layout.
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editPost ? t('create_post.edit_title', 'Edit Post') : t('create_post.repost_title', 'Repost')}</Text>
        <TouchableOpacity
          style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>{editPost ? t('create_post.save', 'Save') : t('create_post.repost_button', 'Repost')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.composerRow}>
          <UserAvatar name={user?.name ?? '?'} photo={user?.photo} size={42} dotColor={null} />
          <TextInput
            style={styles.input}
            placeholder={
              repostOfId
                ? t('create_post.comment_placeholder', 'Add a comment (optional)...')
                : t('create_post.mind_placeholder', "What's on your mind?")
            }
            placeholderTextColor={SUBTLE}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            maxLength={2000}
          />
        </View>

        {hasExistingImages && (
          <View style={styles.imageGrid}>
            {editPost!.images.map((uri) => (
              <View key={uri} style={styles.gridThumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
              </View>
            ))}
          </View>
        )}

        {privacyPicker}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  // Balances the back arrow so the title stays optically centered now that
  // the primary action lives in the footer instead of the header.
  headerSpacer: { width: 22 },
  postButton: { backgroundColor: EMERALD_DEEP, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 64, alignItems: 'center' },
  postButtonDisabled: { backgroundColor: '#B9E0C8' },
  postButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 40 },
  composerRow: { flexDirection: 'row' },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: INK, minHeight: 90, textAlignVertical: 'top', paddingTop: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  gridThumbWrap: { width: '31%', aspectRatio: 1, marginRight: '3.5%', marginBottom: 10 },

  // --- New-post (photo-first wizard) layout ---
  newBody: { paddingBottom: 24 },
  previewWrap: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: PLACEHOLDER },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    borderStyle: 'dashed',
  },
  addPhotoIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  addPhotoTitle: { fontSize: 16, fontWeight: '700', color: INK },
  addPhotoDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  strip: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, backgroundColor: '#FFFFFF' },
  thumbWrap: { width: 62, height: 62, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  thumbWrapActive: { borderColor: EMERALD_DEEP },
  thumb: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: PLACEHOLDER },
  addTile: {
    width: 62,
    height: 62,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  captionStep: { paddingTop: 20, paddingHorizontal: 20 },
  captionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  captionThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: PLACEHOLDER },
  captionField: { flex: 1, fontSize: 16, color: INK, minHeight: 120, textAlignVertical: 'top', paddingTop: 4 },

  shareFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: '#FFFFFF',
  },
  shareButton: { backgroundColor: EMERALD_DEEP, borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  shareButtonDisabled: { backgroundColor: '#B9E0C8' },
  shareButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privacySection: { paddingTop: 20, paddingHorizontal: 20 },
  privacyLabel: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 12 },
  privacyList: { gap: 10 },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    padding: 13,
    backgroundColor: '#FFFFFF',
  },
  privacyOptionActive: { borderColor: EMERALD_DEEP, backgroundColor: EMERALD_SOFT },
  privacyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F6F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconWrapActive: { backgroundColor: '#FFFFFF' },
  privacyOptionLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  privacyOptionLabelActive: { color: EMERALD_DEEP },
  privacyOptionDesc: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: EMERALD_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: HAIRLINE },
});
