import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Paperclip, Plus, Trash2, X } from 'lucide-react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchMaterialTargets,
  fetchTeacherMaterials,
  uploadMaterial,
  deleteMaterial,
  Material,
  MaterialTarget,
  MaterialCategory,
} from '../../services/materialService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const CATEGORY_VALUES: MaterialCategory[] = [
  'lecture_notes',
  'presentation',
  'video',
  'audio',
  'worksheet',
  'reading',
  'other',
];
const CATEGORY_FALLBACKS: Record<MaterialCategory, string> = {
  lecture_notes: 'Notes',
  presentation: 'Slides',
  video: 'Video',
  audio: 'Audio',
  worksheet: 'Worksheet',
  reading: 'Reading',
  other: 'Other',
};

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconTrash({ color, size = 17 }: { color: string; size?: number }) {
  return <Trash2 size={size} color={color} strokeWidth={2} />;
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.4} />;
}
function IconPaperclip({ color, size = 16 }: { color: string; size?: number }) {
  return <Paperclip size={size} color={color} strokeWidth={1.8} />;
}
function IconX({ color, size = 14 }: { color: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.2} />;
}

function MaterialCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={15} borderRadius={4} />
      <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Teacher-facing materials library: upload a resource (file required) tagged
// with a category and optional week label, to one subject/section you
// teach. Mirrors TeacherAnnouncementsScreen's layout and compose-drawer
// pattern; the file field is required here (Announcements' is optional).
//
// File picker: @react-native-documents/picker in import mode, unrestricted
// type (matches the backend, which already accepts any file up to 50MB).
// Previously this screen only offered react-native-image-picker (photos
// only) - that dependency is left in place for other screens that still
// use it for photo-only pickers (e.g. profile photos), but Materials now
// has its own document picker so PDFs/video/audio/office docs work too.
export default function TeacherMaterialsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const categoryLabel = (value: MaterialCategory) =>
    t(`teacher_materials.category_${value}`, CATEGORY_FALLBACKS[value]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [targets, setTargets] = useState<MaterialTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isComposing, setIsComposing] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekLabel, setWeekLabel] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('other');
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [list, targetList] = await Promise.all([
          fetchTeacherMaterials(token),
          fetchMaterialTargets(token),
        ]);
        setMaterials(list);
        setTargets(targetList);
        if (!selectedTargetKey && targetList.length > 0) {
          setSelectedTargetKey(targetKey(targetList[0]));
        }
      } catch (e: any) {
        setError(e?.message ?? t('teacher_materials.load_error', 'Could not load materials.'));
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

  const targetKey = (target: MaterialTarget) => `${target.section_id}:${target.subject_id}`;
  const selectedTarget = targets.find((target) => targetKey(target) === selectedTargetKey) ?? null;

  const resetCompose = () => {
    setTitle('');
    setDescription('');
    setWeekLabel('');
    setCategory('other');
    setFile(null);
    setIsComposing(false);
  };

  const pickFile = async () => {
    try {
      // Unrestricted type - the backend already accepts any file up to
      // 50MB, and materials legitimately include PDFs, slides, video and
      // audio, not just images.
      const [result] = await pick({ type: [types.allFiles] });
      if (!result?.uri) return;
      setFile({
        uri: result.uri,
        name: result.name ?? 'material',
        type: result.type ?? 'application/octet-stream',
      });
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert(
        t('teacher_materials.attach_error_title', 'Could not attach file'),
        e instanceof Error ? e.message : t('common.try_again_full', 'Please try again.'),
      );
    }
  };

  const handleUpload = async () => {
    if (!token || !selectedTarget) return;
    if (!title.trim()) {
      Alert.alert(t('teacher_materials.missing_info_title', 'Missing info'), t('teacher_materials.missing_title', 'Please add a title.'));
      return;
    }
    if (!file) {
      Alert.alert(t('teacher_materials.missing_file_title', 'Missing file'), t('teacher_materials.missing_file_message', 'Please attach a file to upload.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await uploadMaterial(token, {
        section_id: selectedTarget.section_id,
        subject_id: selectedTarget.subject_id,
        title: title.trim(),
        description: description.trim() || null,
        week_label: weekLabel.trim() || null,
        category,
        file,
      });
      resetCompose();
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('teacher_materials.upload_error_title', 'Could not upload'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: Material) => {
    if (!token) return;
    Alert.alert(
      t('teacher_materials.delete_confirm_title', 'Delete material?'),
      t('teacher_materials.delete_confirm_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaterial(token, item.id);
              setMaterials((prev) => prev.filter((m) => m.id !== item.id));
            } catch (e: any) {
              Alert.alert(t('teacher_materials.delete_error_title', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
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
          <Text style={styles.headerTitle}>{t('teacher_materials.header_title', 'Materials')}</Text>
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
            <Text style={styles.composeLabel}>{t('teacher_materials.upload_to', 'Upload to')}</Text>
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
                      {item.section_name} · {item.subject_name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <Text style={[styles.composeLabel, { marginTop: 12 }]}>{t('teacher_materials.category', 'Category')}</Text>
            <FlatList
              horizontal
              data={CATEGORY_VALUES}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
              renderItem={({ item }) => {
                const active = item === category;
                return (
                  <TouchableOpacity
                    onPress={() => setCategory(item)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabel(item)}</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TextInput
              placeholder={t('teacher_materials.title_placeholder', 'Title')}
              placeholderTextColor={SUBTLE}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              placeholder={t('teacher_materials.description_placeholder', 'Description (optional)')}
              placeholderTextColor={SUBTLE}
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.textArea]}
            />
            <TextInput
              placeholder={t('teacher_materials.week_label_placeholder', 'Week / chapter label (optional)')}
              placeholderTextColor={SUBTLE}
              value={weekLabel}
              onChangeText={setWeekLabel}
              style={styles.input}
            />

            {file ? (
              <View style={styles.attachmentPicked}>
                <IconPaperclip color={EMERALD} />
                <Text style={styles.attachmentPickedText} numberOfLines={1}>
                  {file.name}
                </Text>
                <TouchableOpacity onPress={() => setFile(null)} hitSlop={10}>
                  <IconX color={SUBTLE} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickFile} style={styles.attachButton}>
                <IconPaperclip color={EMERALD} />
                <Text style={styles.attachButtonText}>{t('teacher_materials.attach_file', 'Attach a file')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.composeActions}>
              <TouchableOpacity onPress={resetCompose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpload}
                disabled={isSubmitting || !selectedTarget}
                style={[styles.postButton, (isSubmitting || !selectedTarget) && { opacity: 0.6 }]}
              >
                <Text style={styles.postButtonText}>{isSubmitting ? t('teacher_materials.uploading', 'Uploading…') : t('teacher_materials.upload', 'Upload')}</Text>
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
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
          </View>
        ) : (
          <FlatList
            data={materials}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            onRefresh={() => {
              setIsRefreshing(true);
              load({ silent: true });
            }}
            refreshing={isRefreshing}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {t('teacher_materials.empty', 'No materials yet. Tap + to upload your first resource.')}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10}>
                    <IconTrash color={SUBTLE} />
                  </TouchableOpacity>
                </View>
                {item.description ? (
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {item.section_name} · {item.subject_name}
                  {item.week_label ? ` · ${item.week_label}` : ''} · {item.file_name}
                </Text>
                <Text style={styles.cardMetaSub}>{item.uploaded_at}</Text>
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
  textArea: { minHeight: 60, textAlignVertical: 'top' },
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
  cardMetaSub: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
});
