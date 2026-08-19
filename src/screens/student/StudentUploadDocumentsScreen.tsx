import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, FileText, Folder, Plus, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchMyUploadedDocuments,
  uploadMyDocument,
  deleteMyDocument,
  MyUploadedDocument,
} from '../../services/studentDocumentUploadService';
import { pickFiles } from '../../utils/filePicker';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import GlassBackground from '../../components/glass/GlassBackground';
import { GlassButton, GlassInput } from '../../components/glass/GlassKit';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const DANGER = COLORS.danger;
const HAIRLINE = COLORS.border;

// --- Icons ---------------------------------------------------------------
function ChevronLeftIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.3} />;
}
function FileIcon({ color = EMERALD, size = 26 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={1.9} />;
}
function PlusIcon({ color = EMERALD, size = 26 }: { color?: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.3} />;
}
function TrashIcon({ color = DANGER, size = 16 }: { color?: string; size?: number }) {
  return <Trash2 size={size} color={color} strokeWidth={1.9} />;
}
function FolderIcon({ color = EMERALD, size = 40 }: { color?: string; size?: number }) {
  return <Folder size={size} color={color} strokeWidth={1.8} />;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Bento tiles -----------------------------------------------------------
// Every tile in the grid is the same footprint (a squarish card, icon top,
// label below) whether it holds a real document or is the "Add" tile - a
// consistent spatial rhythm rather than a plain list row per item.

function DocumentTile({ doc, onDelete }: { doc: MyUploadedDocument; onDelete: () => void }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(doc.file)}
    >
      <View style={styles.tileIconRow}>
        <View style={styles.tileIconWrap}>
          <FileIcon color={EMERALD} size={22} />
        </View>
        <TouchableOpacity style={styles.tileDeleteBtn} onPress={onDelete} hitSlop={8}>
          <TrashIcon />
        </TouchableOpacity>
      </View>
      <Text style={styles.tileTitle} numberOfLines={2}>{doc.title}</Text>
      <Text style={styles.tileDate}>{formatDate(doc.created_at)}</Text>
    </TouchableOpacity>
  );
}

function AddTile({ onPress, busy, label }: { onPress: () => void; busy: boolean; label: string }) {
  return (
    <TouchableOpacity style={[styles.tile, styles.addTile]} activeOpacity={0.8} onPress={onPress} disabled={busy}>
      {busy ? (
        <ActivityIndicator color={EMERALD} />
      ) : (
        <>
          <View style={styles.addTileIconWrap}>
            <PlusIcon color={EMERALD} size={22} />
          </View>
          <Text style={styles.addTileText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function TileSkeleton() {
  return (
    <View style={styles.tile}>
      <SkeletonCircle size={40} style={{ marginBottom: 14 }} />
      <Skeleton width="80%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={11} />
    </View>
  );
}

export default function StudentUploadDocumentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [documents, setDocuments] = useState<MyUploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        setDocuments(await fetchMyUploadedDocuments(token));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('student_upload_documents.load_error', 'Could not load your documents.'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const pickDocument = async () => {
    setIsPicking(true);
    try {
      const result = await pickFiles(false);
      if (result.cancelled || result.files.length === 0) return;
      const file = result.files[0];
      setPickedFile({ uri: file.uri, name: file.name, type: file.type });
      setTitle(file.name.replace(/\.[a-zA-Z0-9]+$/, ''));
      setTitleModalVisible(true);
    } catch (err) {
      Alert.alert(
        t('student_upload_documents.pick_failed', "Couldn't open the file picker"),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsPicking(false);
    }
  };

  const confirmUpload = async () => {
    if (!token || !pickedFile) return;
    if (!title.trim()) {
      Alert.alert(
        t('student_upload_documents.name_it_title', 'Name it'),
        t('student_upload_documents.name_it_message', 'Give this document a short title (e.g. "National ID", "Guardian Consent").'),
      );
      return;
    }
    setIsUploading(true);
    try {
      const doc = await uploadMyDocument(token, title.trim(), pickedFile);
      setDocuments((prev) => [doc, ...prev]);
      setTitleModalVisible(false);
      setPickedFile(null);
    } catch (err) {
      Alert.alert(
        t('student_upload_documents.upload_failed', 'Upload failed'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const onDelete = (doc: MyUploadedDocument) => {
    Alert.alert(
      t('student_upload_documents.delete_title', 'Delete document'),
      `${t('student_upload_documents.remove_confirm', 'Remove')} "${doc.title}"?`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('student_upload_documents.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            const prev = documents;
            setDocuments((cur) => cur.filter((d) => d.id !== doc.id));
            try {
              await deleteMyDocument(token, doc.id);
            } catch (err) {
              setDocuments(prev);
              Alert.alert(
                t('student_upload_documents.delete_failed', 'Delete failed'),
                err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('student_upload_documents.title', 'My Documents')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <TileSkeleton key={i} />
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <Text style={styles.hint}>
            {t(
              'student_upload_documents.hint',
              'Upload your ID, guardian consent, medical records or any other document your school needs on file.',
            )}
          </Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && documents.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <FolderIcon />
              </View>
              <Text style={styles.emptyTitle}>{t('student_upload_documents.empty_title', 'No documents yet')}</Text>
              <Text style={styles.emptyBody}>
                {t('student_upload_documents.empty_desc', 'Tap "Add Document" below to upload your first one.')}
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {documents.map((doc) => (
              <DocumentTile key={doc.id} doc={doc} onDelete={() => onDelete(doc)} />
            ))}
            <AddTile
              onPress={pickDocument}
              busy={isPicking}
              label={t('student_upload_documents.add_document', 'Add Document')}
            />
          </View>
        </ScrollView>
      )}

      <Modal
        visible={titleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTitleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t('student_upload_documents.name_this_document', 'Name this document')}
            </Text>
            <GlassInput
              style={styles.modalInputWrap}
              placeholder={t('student_upload_documents.title_placeholder', 'e.g. National ID, Guardian Consent')}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <View style={styles.modalActions}>
              <GlassButton
                label={t('common.cancel', 'Cancel')}
                variant="ghost"
                radius={RADIUS.sm}
                style={styles.modalBtn}
                disabled={isUploading}
                onPress={() => {
                  setTitleModalVisible(false);
                  setPickedFile(null);
                }}
              />
              <GlassButton
                label={t('student_upload_documents.upload', 'Upload')}
                radius={RADIUS.sm}
                style={styles.modalBtn}
                loading={isUploading}
                onPress={confirmUpload}
              />
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
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: INK },

  scrollContent: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: SUBTLE, lineHeight: 19, marginBottom: 16 },

  errorBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.md, padding: 14, marginBottom: 16 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },

  emptyWrap: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  // --- Bento grid: every tile the same squarish footprint, 2 per row,
  // whether it's a real document or the trailing "Add" tile - a spatial
  // grid of self-contained cards instead of a flat list of rows.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    justifyContent: 'space-between',
    ...SHADOW.level1,
  },
  tileIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDeleteBtn: { padding: 4 },
  tileTitle: { fontSize: 13.5, fontWeight: '700', color: INK, lineHeight: 18 },
  tileDate: { fontSize: 11, color: SUBTLE, marginTop: 4 },

  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD_SOFT,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: EMERALD,
    shadowOpacity: 0,
    elevation: 0,
  },
  addTileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addTileText: { fontSize: 13, fontWeight: '700', color: EMERALD, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 20, width: '100%', ...SHADOW.level2 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 14 },
  modalInputWrap: { marginBottom: 4 },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1 },
});
