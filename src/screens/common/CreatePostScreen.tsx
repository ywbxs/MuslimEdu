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
import UserAvatar from '../../components/UserAvatar';
import { PickedImage, Post, PostPrivacy, createPost, repost, updatePost } from '../../services/postService';
import { preparePostPhoto, InvalidPhotoTypeError } from '../../utils/imagePrep';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const HAIRLINE = '#ECEEF0';
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

const PRIVACY_OPTIONS: { key: PostPrivacy; label: string }[] = [
  { key: 'school', label: 'School' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Only me' },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const repostOfId = (route.params as any)?.repostOfId as number | undefined;
  const editPost = (route.params as any)?.editPost as Post | undefined;

  const [content, setContent] = useState(editPost?.content ?? '');
  const [privacy, setPrivacy] = useState<PostPrivacy>(editPost?.privacy ?? 'school');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const hasExistingImages = !!editPost && editPost.images.length > 0;
  const canSubmit =
    (content.trim().length > 0 || images.length > 0 || hasExistingImages) && !submitting && !compressing;

  // Admins and teachers can author content (new posts, edits, or a repost
  // with a comment attached). Students only ever reach this screen via a
  // deep-linked/back-nav edge case, since the feed hides every entry point
  // for them - bounce them out defensively rather than trust the UI alone.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';
  useEffect(() => {
    if (!canPost) {
      Alert.alert('Not allowed', 'Only admins and teachers can create or edit posts.');
      navigation.goBack();
    }
  }, [canPost, navigation]);

  if (!canPost) return null;

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.9,
    });
    if (result.didCancel || result.errorCode || !result.assets) return;

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
          picked.push({ uri: prepared.uri, fileName: prepared.fileName, type: prepared.type });
        } catch (err) {
          if (err instanceof InvalidPhotoTypeError) {
            Alert.alert('Unsupported photo', err.message);
          }
        }
      }
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } finally {
      setCompressing(false);
    }
  };

  const removeImage = (uri: string) => setImages((prev) => prev.filter((p) => p.uri !== uri));

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
      Alert.alert('Couldn\u2019t post', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={styles.headerTitle}>{editPost ? 'Edit Post' : repostOfId ? 'Repost' : 'New Post'}</Text>
        <TouchableOpacity
          style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>{editPost ? 'Save' : repostOfId ? 'Repost' : 'Post'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.composerRow}>
          <UserAvatar name={user?.name ?? '?'} photo={user?.photo} size={42} dotColor={null} />
          <TextInput
            style={styles.input}
            placeholder={repostOfId ? 'Add a comment (optional)...' : "What's on your mind?"}
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
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
              </View>
            ))}
          </View>
        )}

        {!repostOfId && !editPost && images.length > 0 && (
          <View style={styles.imageGrid}>
            {images.map((img) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(img.uri)} hitSlop={8}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.privacyRow}>
          <Text style={styles.privacyLabel}>Who can see this?</Text>
          <View style={styles.segmented}>
            {PRIVACY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segment, privacy === opt.key && styles.segmentActive]}
                onPress={() => setPrivacy(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, privacy === opt.key && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {!repostOfId && !editPost && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addPhotoBtn, (images.length >= MAX_IMAGES || compressing) && styles.addPhotoBtnDisabled]}
            onPress={pickImages}
            disabled={images.length >= MAX_IMAGES || compressing}
            activeOpacity={0.8}
          >
            {compressing ? (
              <ActivityIndicator size="small" color={EMERALD} />
            ) : (
              <Text style={styles.addPhotoText}>
                {images.length > 0 ? `Add photos (${images.length}/${MAX_IMAGES})` : 'Add photos'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  postButton: { backgroundColor: EMERALD, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, minWidth: 64, alignItems: 'center' },
  postButtonDisabled: { backgroundColor: '#B9E0C8' },
  postButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  composerRow: { flexDirection: 'row' },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: INK, minHeight: 90, textAlignVertical: 'top', paddingTop: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  thumbWrap: { width: '31%', aspectRatio: 1, marginRight: '3.5%', marginBottom: 10, position: 'relative' },
  thumb: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#F0F1F2' },
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
  privacyRow: { marginTop: 26 },
  privacyLabel: { fontSize: 13, fontWeight: '600', color: SUBTLE, marginBottom: 10 },
  segmented: { flexDirection: 'row', backgroundColor: '#F5F6F7', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: EMERALD },
  segmentText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  segmentTextActive: { color: '#FFFFFF' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: HAIRLINE },
  addPhotoBtn: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#EAF7EF' },
  addPhotoBtnDisabled: { opacity: 0.5 },
  addPhotoText: { color: EMERALD, fontWeight: '700', fontSize: 14 },
});
