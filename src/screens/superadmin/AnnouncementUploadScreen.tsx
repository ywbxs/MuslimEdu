import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { preparePostPhoto, InvalidPhotoTypeError } from '../../utils/imagePrep';
import { PickedImage } from '../../services/postService';
import {
  WidgetAnnouncement,
  fetchWidgetAnnouncements,
  createWidgetAnnouncement,
  deleteWidgetAnnouncement,
  setWidgetAnnouncementActive,
} from '../../services/widgetAnnouncementService';
import { Skeleton } from '../../components/Skeleton';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function PlusIcon({ color = '#FFFFFF', size = 20 }: { color?: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.2} />;
}
function TrashIcon({ color = COLORS.danger, size = 18 }: { color?: string; size?: number }) {
  return <Trash2 size={size} color={color} strokeWidth={2} />;
}

function AnnouncementRow({
  item,
  onToggle,
  onDelete,
}: {
  item: WidgetAnnouncement;
  onToggle: (item: WidgetAnnouncement) => void;
  onDelete: (item: WidgetAnnouncement) => void;
}) {
  return (
    <View style={styles.row}>
      <Image source={{ uri: item.image_url }} style={styles.rowThumb} resizeMode="cover" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <TouchableOpacity onPress={() => onToggle(item)} style={[styles.togglePill, item.active ? styles.togglePillActive : styles.togglePillInactive]}>
          <Text style={[styles.togglePillText, item.active ? styles.togglePillTextActive : styles.togglePillTextInactive]}>
            {item.active ? 'Active' : 'Inactive'}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => onDelete(item)} hitSlop={8} style={styles.deleteBtn}>
        <TrashIcon />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Superadmin-only: upload image-only cards that appear in the widget
 * carousel on EVERY role's Home feed (see WidgetCarousel.tsx). Photo-first
 * flow modeled on CreatePostScreen.tsx, but deliberately with no caption
 * field at all - "picture only" per the feature request.
 *
 * Explicit role gate here (unlike most superadmin screens, which rely on
 * reachability + backend 403 enforcement): this writes global, all-roles-
 * visible content, and the backend routes it calls don't exist yet during
 * initial rollout, so this client check is the only gate until they ship.
 */
export default function AnnouncementUploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [announcements, setAnnouncements] = useState<WidgetAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PickedImage | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      Alert.alert('Not allowed', 'Only superadmins can manage widget announcements.');
      navigation.goBack();
    }
  }, [isSuperAdmin, navigation]);

  const load = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    setLoading(true);
    try {
      const rows = await fetchWidgetAnnouncements(token);
      setAnnouncements(rows);
    } catch (err: any) {
      Alert.alert("Couldn't load announcements", err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, isSuperAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setCompressing(true);
    try {
      const prepared = await preparePostPhoto(asset.uri!, asset.fileName, asset.type, asset.fileSize);
      setPreview({ uri: prepared.uri, fileName: prepared.fileName, type: prepared.type });
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        Alert.alert('Unsupported photo', err.message);
      }
    } finally {
      setCompressing(false);
    }
  };

  const submit = async () => {
    if (!token || !preview) return;
    setSubmitting(true);
    try {
      await createWidgetAnnouncement(token, preview);
      setPreview(null);
      load();
    } catch (err: any) {
      Alert.alert("Couldn't upload", err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (item: WidgetAnnouncement) => {
    if (!token) return;
    const nextActive = !item.active;
    setAnnouncements((prev) => prev.map((a) => (a.id === item.id ? { ...a, active: nextActive } : a)));
    try {
      await setWidgetAnnouncementActive(token, item.id, nextActive);
    } catch (err: any) {
      setAnnouncements((prev) => prev.map((a) => (a.id === item.id ? { ...a, active: item.active } : a)));
      Alert.alert("Couldn't update", err?.message ?? 'Please try again.');
    }
  };

  const onDelete = (item: WidgetAnnouncement) => {
    Alert.alert('Delete announcement', 'Remove this card permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
          try {
            await deleteWidgetAnnouncement(token, item.id);
          } catch (err: any) {
            Alert.alert("Couldn't delete", err?.message ?? 'Please try again.');
            load();
          }
        },
      },
    ]);
  };

  if (!isSuperAdmin) return null;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Widget Announcements</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.uploadCard}>
            {preview ? (
              <>
                <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPreview(null)} disabled={submitting}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Upload</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.addTile} onPress={pickImage} disabled={compressing} activeOpacity={0.85}>
                {compressing ? (
                  <ActivityIndicator color={EMERALD} />
                ) : (
                  <>
                    <View style={styles.addIconCircle}>
                      <PlusIcon />
                    </View>
                    <Text style={styles.addTileText}>Add Image</Text>
                    <Text style={styles.addTileHint}>Picture only - shown to every role in the feed widget carousel</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.sectionLabel}>Existing announcements</Text>
          </View>
        }
        renderItem={({ item }) => <AnnouncementRow item={item} onToggle={onToggle} onDelete={onDelete} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              <Skeleton width="100%" height={72} borderRadius={RADIUS.md} />
              <Skeleton width="100%" height={72} borderRadius={RADIUS.md} />
            </View>
          ) : (
            <Text style={styles.emptyText}>No announcements yet.</Text>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
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
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  list: { padding: 16, paddingBottom: 40 },

  uploadCard: { marginBottom: 20 },
  addTile: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  addIconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: EMERALD, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  addTileText: { fontSize: 15, fontWeight: '700', color: INK },
  addTileHint: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 17 },

  previewImage: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.lg, backgroundColor: '#EDEFF2' },
  previewActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  secondaryBtnText: { color: INK, fontWeight: '700', fontSize: 14 },
  primaryBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.pill, backgroundColor: EMERALD, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: '#B9E0C8' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24 },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 12,
    ...SHADOW.level1,
  },
  rowThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EDEFF2' },
  rowDate: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 6 },
  togglePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  togglePillActive: { backgroundColor: COLORS.emeraldSoft },
  togglePillInactive: { backgroundColor: '#F1F2F4' },
  togglePillText: { fontSize: 11.5, fontWeight: '700' },
  togglePillTextActive: { color: EMERALD },
  togglePillTextInactive: { color: SUBTLE },
  deleteBtn: { padding: 6 },
});
