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
import Svg, { Path, Polyline, Circle, Line } from 'react-native-svg';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useAuth } from '../../context/AuthContext';
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

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const CATEGORIES: { value: MaterialCategory; label: string }[] = [
  { value: 'lecture_notes', label: 'Notes' },
  { value: 'presentation', label: 'Slides' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'worksheet', label: 'Worksheet' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
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
        setError(e?.message ?? 'Could not load materials.');
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

  const targetKey = (t: MaterialTarget) => `${t.section_id}:${t.subject_id}`;
  const selectedTarget = targets.find((t) => targetKey(t) === selectedTargetKey) ?? null;

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
      Alert.alert('Could not attach file', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!token || !selectedTarget) return;
    if (!title.trim()) {
      Alert.alert('Missing info', 'Please add a title.');
      return;
    }
    if (!file) {
      Alert.alert('Missing file', 'Please attach a file to upload.');
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
      Alert.alert('Could not upload', e?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: Material) => {
    if (!token) return;
    Alert.alert('Delete material?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMaterial(token, item.id);
            setMaterials((prev) => prev.filter((m) => m.id !== item.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
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
          <Text style={styles.headerTitle}>Materials</Text>
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
            <Text style={styles.composeLabel}>Upload to</Text>
            <FlatList
              horizontal
              data={targets}
              keyExtractor={(t) => targetKey(t)}
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

            <Text style={[styles.composeLabel, { marginTop: 12 }]}>Category</Text>
            <FlatList
              horizontal
              data={CATEGORIES}
              keyExtractor={(c) => c.value}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
              renderItem={({ item }) => {
                const active = item.value === category;
                return (
                  <TouchableOpacity
                    onPress={() => setCategory(item.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <TextInput
              placeholder="Title"
              placeholderTextColor={SUBTLE}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              placeholder="Description (optional)"
              placeholderTextColor={SUBTLE}
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.textArea]}
            />
            <TextInput
              placeholder="Week / chapter label (optional)"
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
                <Text style={styles.attachButtonText}>Attach a file</Text>
              </TouchableOpacity>
            )}

            <View style={styles.composeActions}>
              <TouchableOpacity onPress={resetCompose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpload}
                disabled={isSubmitting || !selectedTarget}
                style={[styles.postButton, (isSubmitting || !selectedTarget) && { opacity: 0.6 }]}
              >
                <Text style={styles.postButtonText}>{isSubmitting ? 'Uploading…' : 'Upload'}</Text>
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
                No materials yet. Tap + to upload your first resource.
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
