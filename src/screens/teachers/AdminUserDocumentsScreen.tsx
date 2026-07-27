import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import {
  fetchUserDocuments,
  uploadUserDocument,
  deleteUserDocument,
  UserDocument,
} from '../../services/adminTeacherService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const DANGER = COLORS.danger;
const TRACK_BG = COLORS.canvas;
const HAIRLINE = COLORS.border;

type RouteParams = {
  userId: number;
  userName: string;
};

function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T'));
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminUserDocumentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, userName } = (route.params as RouteParams) ?? {};
  const { token, user } = useAuth();
  // This screen is reachable from both the admin Children/Teachers lists
  // (upload + delete allowed) and the teacher's read-only Children overview
  // (view only) - the same distinction the profile sheet makes for editing.
  const canManage = user?.role === 'admin';

  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickedFile, setPickedFile] = useState<{ uri: string; fileName: string | null; type: string | null } | null>(null);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchUserDocuments(token, userId);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    }
  }, [token, userId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const pickFile = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setPickedFile({ uri: asset.uri as string, fileName: asset.fileName ?? null, type: asset.type ?? null });
    setTitle('');
    setTitleModalVisible(true);
  };

  const confirmUpload = async () => {
    if (!token || !pickedFile) return;
    if (!title.trim()) {
      Alert.alert('Name it', 'Give this document a short title (e.g. "National ID", "Certificate").');
      return;
    }
    setIsUploading(true);
    try {
      const doc = await uploadUserDocument(token, userId, title.trim(), pickedFile);
      setDocuments((prev) => [doc, ...prev]);
      setTitleModalVisible(false);
      setPickedFile(null);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDelete = (doc: UserDocument) => {
    Alert.alert('Delete document', `Remove "${doc.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          const prev = documents;
          setDocuments((cur) => cur.filter((d) => d.id !== doc.id));
          try {
            await deleteUserDocument(token, doc.id);
          } catch (err) {
            setDocuments(prev);
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{userName ?? 'Documents'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.docCard}>
              <Skeleton width="60%" height={14} style={{ marginBottom: 8 }} />
              <Skeleton width="30%" height={11} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyBody}>ID, certificates, and other files will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.docCard} onPress={() => Linking.openURL(item.file)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.docDate}>{formatDate(item.created_at)}</Text>
              </View>
              {canManage ? (
                <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      {canManage ? (
        <TouchableOpacity style={styles.uploadButton} onPress={pickFile} activeOpacity={0.85}>
          <Text style={styles.uploadButtonText}>+ Upload Document</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={titleModalVisible} transparent animationType="fade" onRequestClose={() => setTitleModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this document</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. National ID, Certificate"
              placeholderTextColor={SUBTLE}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => {
                  setTitleModalVisible(false);
                  setPickedFile(null);
                }}
                disabled={isUploading}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={confirmUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: COLORS.canvas, paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryText: { color: INK, fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 100 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 10,
  ...SHADOW.level2,
  },
  docTitle: { fontSize: 15, fontWeight: '600', color: INK },
  docDate: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteText: { color: DANGER, fontSize: 13, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  uploadButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 17,
    alignItems: 'center',
    ...SHADOW.glow,
  },
  uploadButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 20, width: '100%', ...SHADOW.level2,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 12 },
  modalInput: {
    backgroundColor: TRACK_BG,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: INK,
  },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: TRACK_BG },
  modalBtnGhostText: { color: INK, fontWeight: '600' },
  modalBtnPrimary: { backgroundColor: EMERALD },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
});
