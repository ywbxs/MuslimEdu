import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, FileText, IdCard, Plus, Search, UserRound, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchTeacherOverview, TeacherOverview, addTeacher } from '../../services/adminTeacherService';
import { Skeleton } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

// --- Icons (matches the app's existing inline-SVG icon style) ---
function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function SearchIcon({ color }: { color: string }) {
  return <Search size={17} color={color} strokeWidth={2} />;
}
function ChevronRightIcon({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}
function CloseIcon({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function IdCardIcon({ color }: { color: string }) {
  return <IdCard size={20} color={color} strokeWidth={1.8} />;
}
function DocumentIcon({ color }: { color: string }) {
  return <FileText size={20} color={color} strokeWidth={1.8} />;
}
function ReportIcon({ color }: { color: string }) {
  return <FileText size={20} color={color} strokeWidth={1.8} />;
}
function PlusIcon({ color }: { color: string }) {
  return <Plus size={19} color={color} strokeWidth={2.4} />;
}
function EmptyIcon() {
  return <UserRound size={56} color={"#C4C9CF"} strokeWidth={1.6} />;
}

// --- Teacher row ---------------------------------------------------------
const TeacherRow = React.memo(function TeacherRow({
  item,
  onPress,
}: {
  item: TeacherOverview;
  onPress: (item: TeacherOverview) => void;
}) {
  const { t } = useLocale();
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => onPress(item)}>
      <UserAvatar
        name={item.name}
        photo={item.photo}
        size={48}
        ringColor={HAIRLINE}
        dotColor={item.submitted ? EMERALD : DANGER}
      />
      <View style={[styles.flex1, { marginLeft: 14 }]}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name || t('admin_teacher_list.unnamed_teacher', 'Unnamed teacher')}</Text>
        {item.submitted ? (
          <View style={[styles.statusPill, styles.statusPillOk]}>
            <View style={[styles.statusDot, { backgroundColor: EMERALD }]} />
            <Text style={styles.statusPillTextOk} numberOfLines={1}>
              {item.submitted_by
                ? t('admin_teacher_list.report_submitted_by', 'Report submitted · {name}').replace('{name}', item.submitted_by)
                : t('admin_teacher_list.report_submitted', 'Report submitted')}
            </Text>
          </View>
        ) : (
          <View style={[styles.statusPill, styles.statusPillMissing]}>
            <View style={[styles.statusDot, { backgroundColor: DANGER }]} />
            <Text style={styles.statusPillTextMissing}>{t('admin_teacher_list.missing_report', 'Missing report')}</Text>
          </View>
        )}
      </View>
      <ChevronRightIcon color="#C4C9CF" />
    </TouchableOpacity>
  );
});

// --- Action modal: Profile / Documents / Monthly Report -------------------
function TeacherActionModal({
  visible,
  teacher,
  onClose,
  onSelect,
}: {
  visible: boolean;
  teacher: TeacherOverview | null;
  onClose: () => void;
  onSelect: (action: 'profile' | 'documents' | 'report') => void;
}) {
  const { t } = useLocale();
  const options: { key: 'profile' | 'documents' | 'report'; label: string; desc: string; icon: (c: string) => React.ReactElement }[] = [
    { key: 'profile', label: t('admin_teacher_list.action_profile', 'Profile'), desc: t('admin_teacher_list.action_profile_desc', 'View contact info and role details'), icon: (c) => <IdCardIcon color={c} /> },
    { key: 'documents', label: t('admin_teacher_list.action_documents', 'Documents'), desc: t('admin_teacher_list.action_documents_desc', 'ID, certificates, and other files'), icon: (c) => <DocumentIcon color={c} /> },
    { key: 'report', label: t('admin_teacher_list.action_report', 'Monthly Report'), desc: t('admin_teacher_list.action_report_desc', 'View this teacher\u2019s report history'), icon: (c) => <ReportIcon color={c} /> },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View style={[styles.flex1, { flexDirection: 'row', alignItems: 'center' }]}>
              <UserAvatar name={teacher?.name ?? ''} photo={teacher?.photo} size={38} ringColor={HAIRLINE} dotColor={null} />
              <Text style={styles.sheetTitle} numberOfLines={1}>{teacher?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => onSelect(opt.key)}
            >
              <View style={styles.actionIconWrap}>{opt.icon(EMERALD)}</View>
              <View style={styles.flex1}>
                <Text style={styles.actionLabel}>{opt.label}</Text>
                <Text style={styles.actionDesc}>{opt.desc}</Text>
              </View>
              <ChevronRightIcon color="#C4C9CF" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// --- Add Teacher sheet ---------------------------------------------------
function AddTeacherSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setNameAr('');
    setEmail('');
    setPassword('');
    setPhone('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('admin_teacher_list.almost_done', 'Almost done'), t('admin_teacher_list.error_required_fields', 'Name, email, and password are required.'));
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert(t('admin_teacher_list.almost_done', 'Almost done'), t('admin_teacher_list.error_password_length', 'Password must be at least 6 characters.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await addTeacher(token, {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactPhone.trim() || undefined,
      });
      resetForm();
      onClose();
      onCreated();
      const message = created.code
        ? t('admin_teacher_list.teacher_added_message_with_code', '{name} can now log in with the email and password you set. Staff code: {code}').replace('{name}', name.trim()).replace('{code}', created.code)
        : t('admin_teacher_list.teacher_added_message', '{name} can now log in with the email and password you set.').replace('{name}', name.trim());
      Alert.alert(t('admin_teacher_list.teacher_added_title', 'Teacher added'), message);
    } catch (err) {
      Alert.alert(t('admin_teacher_list.add_error_title', 'Could not add teacher'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={handleClose} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('admin_teacher_list.add_teacher_title', 'Add Teacher')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('admin_teacher_list.full_name_label', 'Full Name')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.full_name_placeholder', 'e.g. Ahmad bin Abdullah')}
              placeholderTextColor={SUBTLE}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.name_ar_label', 'Arabic Name (optional)')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.name_ar_placeholder', 'الاسم بالعربية')}
              placeholderTextColor={SUBTLE}
              value={nameAr}
              onChangeText={setNameAr}
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.email_label', 'Email')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.email_placeholder', 'teacher@example.com')}
              placeholderTextColor={SUBTLE}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.password_label', 'Password')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.password_placeholder', 'At least 6 characters')}
              placeholderTextColor={SUBTLE}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.phone_label', 'Phone (optional)')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.phone_placeholder', 'e.g. 012-345 6789')}
              placeholderTextColor={SUBTLE}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.emergency_contact_name_label', 'Emergency Contact Name (optional)')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.emergency_contact_name_placeholder', 'e.g. Fatimah binti Ahmad')}
              placeholderTextColor={SUBTLE}
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>{t('admin_teacher_list.emergency_contact_phone_label', 'Emergency Contact Phone (optional)')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('admin_teacher_list.emergency_contact_phone_placeholder', 'e.g. 012-345 6789')}
              placeholderTextColor={SUBTLE}
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{t('admin_teacher_list.add_teacher_title', 'Add Teacher')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function AdminTeacherListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [teachers, setTeachers] = useState<TeacherOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherOverview | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchTeacherOverview(token);
      setTeachers(data.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_teacher_list.load_error', 'Failed to load teachers.'));
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((teacher) => teacher.name.toLowerCase().includes(q));
  }, [teachers, query]);

  const keyExtractor = useCallback((item: TeacherOverview) => String(item.teacher_id), []);

  const handleSelect = (action: 'profile' | 'documents' | 'report') => {
    const teacher = selectedTeacher;
    setSelectedTeacher(null);
    if (!teacher) return;

    if (action === 'report') {
      (navigation as any).navigate('AdminTeacherReportDetail', {
        teacherId: teacher.teacher_id,
        teacherName: teacher.name,
      });
      return;
    }

    if (action === 'profile') {
      (navigation as any).navigate('AdminTeacherProfile', {
        teacherId: teacher.teacher_id,
        teacherName: teacher.name,
      });
      return;
    }

    // action === 'documents'
    (navigation as any).navigate('AdminUserDocuments', {
      userId: teacher.teacher_id,
      userName: teacher.name,
    });
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('admin_teacher_list.header_title', 'Teachers')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddSheetOpen(true)} hitSlop={8}>
          <PlusIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin_teacher_list.search_placeholder', 'Search teachers...')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={44} height={44} borderRadius={22} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => <TeacherRow item={item} onPress={setSelectedTeacher} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('admin_teacher_list.empty_title', 'No teachers found')}</Text>
              <Text style={styles.emptyBody}>
                {query ? t('admin_teacher_list.empty_body_search', 'Try a different search term.') : t('admin_teacher_list.empty_body_none', 'Teachers added to your school will show up here.')}
              </Text>
            </View>
          }
        />
      )}

      <TeacherActionModal
        visible={!!selectedTeacher}
        teacher={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        onSelect={handleSelect}
      />

      <AddTeacherSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onCreated={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  ...SHADOW.level1,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK, padding: 0 },

  listContent: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level2,
  },
  rowName: { fontSize: 15.5, fontWeight: '700', color: INK },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 6,
    gap: 6,
  },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillMissing: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillTextOk: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },
  statusPillTextMissing: { fontSize: 11.5, color: DANGER, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // --- Sheets ---
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  actionSheet: { backgroundColor: GLASS_SURFACE_STRONG, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: 34, paddingHorizontal: 20 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    gap: 14,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15.5, fontWeight: '700', color: INK },
  actionDesc: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  formSheet: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  fieldInput: {
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
  },
  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
