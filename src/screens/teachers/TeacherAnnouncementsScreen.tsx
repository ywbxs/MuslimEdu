import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Circle, Line } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAnnouncementTargets,
  fetchTeacherAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  Announcement,
  AnnouncementTarget,
} from '../../services/announcementService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#2BCBB0';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPin({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2 5 5 1-4 4 1 6-4-3-4 3 1-6-4-4 5-1z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function IconTrash({ color, size = 17 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconPaperclip({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 12l6-6a3 3 0 1 1 4 4l-8 8a5 5 0 1 1-7-7l7-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconX({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={5} x2={19} y2={19} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={19} y1={5} x2={5} y2={19} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function AnnouncementCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={15} borderRadius={4} />
      <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Teacher-facing announcements: list what you've posted, delete your own,
// and compose a new one targeted at a section (whole class) or a single
// subject you teach there. Mirrors TeacherGradebookClassesScreen's layout
// conventions (glass cards, chevron-left header, pull to refresh).
export default function TeacherAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targets, setTargets] = useState<AnnouncementTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isComposing, setIsComposing] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [attachment, setAttachment] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [list, targetList] = await Promise.all([
          fetchTeacherAnnouncements(token),
          fetchAnnouncementTargets(token),
        ]);
        setAnnouncements(list);
        setTargets(targetList);
        if (!selectedTargetKey && targetList.length > 0) {
          setSelectedTargetKey(targetKey(targetList[0]));
        }
      } catch (e: any) {
        setError(e?.message ?? t('teacher_announcements.load_error', 'Could not load announcements.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, selectedTargetKey]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const targetKey = (target: AnnouncementTarget) => `${target.section_id}:${target.subject_id ?? 'class'}`;
  const selectedTarget = targets.find((target) => targetKey(target) === selectedTargetKey) ?? null;

  const resetCompose = () => {
    setTitle('');
    setBody('');
    setIsPinned(false);
    setAttachment(null);
    setIsComposing(false);
  };

  const pickAttachment = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setAttachment({
      uri: asset.uri as string,
      name: asset.fileName ?? 'attachment.jpg',
      type: asset.type ?? 'image/jpeg',
    });
  };

  const handlePost = async () => {
    if (!token || !selectedTarget) return;
    if (!title.trim() || !body.trim()) {
      Alert.alert(
        t('teacher_announcements.missing_info_title', 'Missing info'),
        t('teacher_announcements.missing_info_message', 'Please add a title and a message.'),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await createAnnouncement(token, {
        section_id: selectedTarget.section_id,
        subject_id: selectedTarget.subject_id,
        title: title.trim(),
        body: body.trim(),
        is_pinned: isPinned,
        attachment,
      });
      resetCompose();
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('teacher_announcements.post_error_title', 'Could not post'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: Announcement) => {
    if (!token) return;
    Alert.alert(
      t('teacher_announcements.delete_confirm_title', 'Delete announcement?'),
      t('teacher_announcements.delete_confirm_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(token, item.id);
              setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
            } catch (e: any) {
              Alert.alert(t('teacher_announcements.delete_error_title', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
            <IconChevronLeft color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('teacher_announcements.header_title', 'Announcements')}</Text>
          <TouchableOpacity
            onPress={() => setIsComposing((v) => !v)}
            hitSlop={12}
            style={styles.composeButton}
          >
            <IconPlus color={EMERALD} />
          </TouchableOpacity>
        </View>

        {isComposing ? (
          <View style={styles.composeCard}>
            <Text style={styles.composeLabel}>{t('teacher_announcements.post_to', 'Post to')}</Text>
            <FlatList
              horizontal
              data={targets}
              keyExtractor={(target) => targetKey(target)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
              renderItem={({ item }) => {
                const key = targetKey(item);
                const active = key === selectedTargetKey;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedTargetKey(key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.section_name}
                      {item.subject_name ? ` · ${item.subject_name}` : ` · ${t('teacher_announcements.whole_class', 'Whole class')}`}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TextInput
              placeholder={t('teacher_announcements.title_placeholder', 'Title')}
              placeholderTextColor={SUBTLE}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              placeholder={t('teacher_announcements.body_placeholder', 'Write your announcement…')}
              placeholderTextColor={SUBTLE}
              value={body}
              onChangeText={setBody}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <View style={styles.pinRow}>
              <IconPin color={SUBTLE} />
              <Text style={styles.pinLabel}>{t('teacher_announcements.pin_to_top', 'Pin to top')}</Text>
              <Switch
                value={isPinned}
                onValueChange={setIsPinned}
                trackColor={{ false: '#D8DCE1', true: EMERALD_SOFT }}
                thumbColor={isPinned ? EMERALD : '#FFFFFF'}
              />
            </View>

            {attachment ? (
              <View style={styles.attachmentPicked}>
                <IconPaperclip color={EMERALD} />
                <Text style={styles.attachmentPickedText} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <TouchableOpacity onPress={() => setAttachment(null)} hitSlop={10}>
                  <IconX color={SUBTLE} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickAttachment} style={styles.attachButton}>
                <IconPaperclip color={EMERALD} />
                <Text style={styles.attachButtonText}>{t('teacher_announcements.attach_photo', 'Attach a photo')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.composeActions}>
              <TouchableOpacity onPress={resetCompose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePost}
                disabled={isSubmitting || !selectedTarget}
                style={[styles.postButton, (isSubmitting || !selectedTarget) && { opacity: 0.6 }]}
              >
                <Text style={styles.postButtonText}>{isSubmitting ? t('teacher_announcements.posting', 'Posting…') : t('teacher_announcements.post', 'Post')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <AnnouncementCardSkeleton />
            <AnnouncementCardSkeleton />
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(a) => String(a.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            onRefresh={() => {
              setIsRefreshing(true);
              load({ silent: true });
            }}
            refreshing={isRefreshing}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {t('teacher_announcements.empty', 'No announcements yet. Tap + to post your first one.')}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  {item.is_pinned ? <IconPin color={EMERALD} /> : null}
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10}>
                    <IconTrash color={SUBTLE} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardBody} numberOfLines={4}>
                  {item.body}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.section_name}
                  {item.subject_name ? ` · ${item.subject_name}` : ` · ${t('teacher_announcements.whole_class', 'Whole class')}`} · {item.posted_at}
                </Text>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { padding: 4 },
  composeButton: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 8 },
  composeCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...SHADOW.card,
  },
  composeLabel: { fontSize: 12, fontWeight: '600', color: SUBTLE, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F1F3',
    marginRight: 8,
  },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pinRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  pinLabel: { fontSize: 13, color: INK, marginRight: 'auto', marginLeft: 4 },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: EMERALD_SOFT,
  },
  attachButtonText: { fontSize: 12.5, color: EMERALD, fontWeight: '600' },
  attachmentPicked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F1F3',
  },
  attachmentPickedText: { flex: 1, fontSize: 12.5, color: INK, fontWeight: '500' },
  composeActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 9 },
  cancelButtonText: { color: SUBTLE, fontWeight: '600', fontSize: 14 },
  postButton: {
    backgroundColor: EMERALD,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  postButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#FDECEC' },
  errorText: { color: '#B3261E', fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 12,
    ...SHADOW.card,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  cardBody: { fontSize: 13.5, color: INK, marginTop: 6, lineHeight: 19 },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 8 },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
});
