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
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import UserAvatar from '../../components/UserAvatar';
import { PickedImage, Post, PostPrivacy, createPost, repost, updatePost } from '../../services/postService';
import { preparePostPhoto, InvalidPhotoTypeError } from '../../utils/imagePrep';
import { checkImageModeration, ModeratedContentError } from '../../services/contentModerationService';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const HAIRLINE = '#ECEEF0';
const PLACEHOLDER = '#EDEFF2';
const MAX_IMAGES = 6;

function CloseIcon({ color = '#FFFFFF', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={INK} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PlusIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

const PRIVACY_OPTIONS: { key: PostPrivacy; labelKey: string; label: string }[] = [
  { key: 'school', labelKey: 'school', label: 'School' },
  { key: 'public', labelKey: 'public', label: 'Public' },
  { key: 'private', labelKey: 'only_me', label: 'Only me' },
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

  const pickImages = async (opts: { initial?: boolean } = {}) => {
    if (images.length >= MAX_IMAGES) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.9,
    });
    if (result.didCancel || result.errorCode || !result.assets) {
      // Backing out of the very first picker means the post was abandoned
      // before it ever existed - close the composer rather than strand the
      // user on an empty screen with nothing they're allowed to post.
      if (opts.initial && images.length === 0) navigation.goBack();
      return;
    }

    setCompressing(true);
    try {
      const picked: PickedImage[] = [];
      for (const a of result.assets) {
        if (!a.uri) continue;
        try {
          // Every photo gets squeezed down to ~200KB before it ever reaches
          // the composer preview or the upload - keeps posts light on data
          // and server storage regardless of the original camera resolution.
          const prepared = await preparePostPhoto(a.uri, a.fileName, a.type, a.fileSize);
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
      if (opts.initial && picked.length === 0) navigation.goBack();
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

  // A new post opens straight into the photo library, the way Instagram's
  // "New post" does - the photo IS the post, so there's nothing worth
  // showing until one is chosen. Edits and reposts skip this: they're built
  // around existing content and their text is the point.
  const [pickerOpened, setPickerOpened] = useState(false);
  useEffect(() => {
    if (!canPost || pickerOpened || !isNewPost) return;
    setPickerOpened(true);
    pickImages({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPost, pickerOpened, isNewPost]);

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
    <View style={styles.privacyRow}>
      <Text style={styles.privacyLabel}>{t('create_post.who_can_see', 'Who can see this?')}</Text>
      <View style={styles.segmented}>
        {PRIVACY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, privacy === opt.key && styles.segmentActive]}
            onPress={() => setPrivacy(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, privacy === opt.key && styles.segmentTextActive]}>
              {t(`create_post.privacy_${opt.labelKey}`, opt.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // --- New post: photo-first composer ------------------------------------
  // The chosen photo is the subject of the screen (big preview up top, the
  // rest of the picked set as a strip under it), with the caption beneath
  // it and a single Share action pinned to the bottom - rather than a text
  // box with thumbnails tacked on underneath, which buried the photo that's
  // actually required.
  if (isNewPost) {
    const preview = images[previewIndex] ?? images[0];
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_post.new_title', 'New Post')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.newBody} keyboardShouldPersistTaps="handled">
          <View style={styles.previewWrap}>
            {preview ? (
              <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={[styles.preview, styles.previewEmpty]}>
                {compressing ? <ActivityIndicator color={EMERALD} /> : null}
              </View>
            )}
          </View>

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

          <TextInput
            style={styles.captionInput}
            placeholder={t('create_post.caption_placeholder', 'Add a caption (optional)...')}
            placeholderTextColor={SUBTLE}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
          />

          {privacyPicker}
        </ScrollView>

        <View style={[styles.shareFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.shareButton, !canSubmit && styles.shareButtonDisabled]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.shareButtonText}>{t('create_post.share', 'Share')}</Text>
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
  postButton: { backgroundColor: EMERALD, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 64, alignItems: 'center' },
  postButtonDisabled: { backgroundColor: '#B9E0C8' },
  postButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 40 },
  composerRow: { flexDirection: 'row' },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: INK, minHeight: 90, textAlignVertical: 'top', paddingTop: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  gridThumbWrap: { width: '31%', aspectRatio: 1, marginRight: '3.5%', marginBottom: 10 },

  // --- New-post (photo-first) layout ---
  newBody: { paddingBottom: 24 },
  previewWrap: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: PLACEHOLDER },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  strip: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, backgroundColor: '#FFFFFF' },
  thumbWrap: { width: 62, height: 62, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  thumbWrapActive: { borderColor: EMERALD },
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
  captionInput: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: INK,
    minHeight: 96,
    textAlignVertical: 'top',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: HAIRLINE,
  },
  shareFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: '#FFFFFF',
  },
  shareButton: { backgroundColor: EMERALD, borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
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
  privacyRow: { marginTop: 20, paddingHorizontal: 20 },
  privacyLabel: { fontSize: 13, fontWeight: '600', color: SUBTLE, marginBottom: 10 },
  segmented: { flexDirection: 'row', backgroundColor: '#F5F6F7', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: EMERALD },
  segmentText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  segmentTextActive: { color: '#FFFFFF' },
});
