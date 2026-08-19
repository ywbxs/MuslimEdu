import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Mail, MapPin, Phone, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClassStudents, ClassStudent } from '../../services/teacherClassService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}
function IconClose({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function IconMail({ color }: { color: string }) {
  return <Mail size={16} color={color} strokeWidth={2} />;
}
function IconPhone({ color }: { color: string }) {
  return <Phone size={16} color={color} strokeWidth={2} />;
}
function IconPin({ color }: { color: string }) {
  return <MapPin size={16} color={color} strokeWidth={2} />;
}

function DetailRow({ icon, label, value }: { icon: React.ReactElement; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      {icon}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function StudentSheet({ student, onClose }: { student: ClassStudent | null; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <Modal visible={!!student} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose} hitSlop={10}>
            <IconClose color={SUBTLE} />
          </TouchableOpacity>
          {student ? (
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <UserAvatar name={student.name} photo={student.photo} size={84} dotColor={null} style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={styles.sheetName}>{student.name}</Text>
              <View style={styles.detailCard}>
                <DetailRow icon={<IconMail color={SUBTLE} />} label={t('teacher_class_students.email', 'Email')} value={student.email} />
                <DetailRow icon={<IconPhone color={SUBTLE} />} label={t('teacher_class_students.phone', 'Phone')} value={student.phone} />
                <DetailRow icon={<IconPin color={SUBTLE} />} label={t('teacher_class_students.address', 'Address')} value={student.address} />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function StudentRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonCircle size={44} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="55%" height={14} borderRadius={4} />
        <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 7 }} />
      </View>
    </View>
  );
}

export default function TeacherClassStudentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, classLabel } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassStudent | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token || !sectionId) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchClassStudents(token, sectionId);
        setStudents(data.students);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('teacher_class_students.load_error', 'Could not load the class roster.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, sectionId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('teacher_class_students.title', 'Class Roster')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_class_students.empty_title', 'No students enrolled yet')}</Text>
                <Text style={styles.emptyDesc}>{t('teacher_class_students.empty_desc', "Once students are admitted into this section, they'll show up here.")}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => setSelected(item)}>
              <UserAvatar name={item.name} photo={item.photo} size={44} dotColor={null} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
              </View>
              <IconChevronRight color={SUBTLE} />
            </TouchableOpacity>
          )}
        />
      )}

      <StudentSheet student={selected} onClose={() => setSelected(null)} />
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
  backButton: { width: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: INK, marginHorizontal: 8 },
  listContent: { padding: 16 },
  row: {
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
  rowName: { fontSize: 14.5, fontWeight: '700', color: INK },
  rowEmail: { fontSize: 12.5, color: SUBTLE, marginTop: 3 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.md, padding: 14, marginBottom: 12 },
  errorText: { color: COLORS.danger, fontSize: 13.5, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    paddingTop: 14,
  },
  sheetClose: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 4 },
  sheetContent: { paddingHorizontal: 24, paddingBottom: 40 },
  sheetName: { fontSize: 19, fontWeight: '800', color: INK, textAlign: 'center', marginBottom: 20 },
  detailCard: { backgroundColor: 'transparent', borderRadius: RADIUS.md, padding: 16, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 11.5, color: SUBTLE, marginBottom: 2 },
  detailValue: { fontSize: 14, color: INK, fontWeight: '600' },
});
