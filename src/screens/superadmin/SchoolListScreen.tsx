import React, { useCallback, useEffect, useState } from 'react';
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
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchSchools,
  createSchool,
  setSchoolStatus,
  trashSchool,
  School,
  SchoolType,
} from '../../services/superAdminService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={21} y1={21} x2={16.2} y2={16.2} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function EmptyIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 20.5L4.5 9 12 4l7.5 5v11.5" stroke="#C4C9CF" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9.5 20.5V13h5v7.5" stroke="#C4C9CF" strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const SchoolRow = React.memo(function SchoolRow({
  item,
  onPress,
  onToggleStatus,
  onDelete,
}: {
  item: School;
  onPress: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const active = item.status === 1;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.flex1]}>
        <Text style={styles.rowName} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
        <View style={styles.rowMetaRow}>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>
              {item.school_type === 'orphanage' ? t('school_list.type_orphanage', 'Orphanage') : t('school_list.type_regular', 'Regular')}
            </Text>
          </View>
          {item.admin_count != null ? (
            <Text style={styles.adminCountText}>
              {t('school_list.admin_count', '{count} admin(s)').replace('{count}', String(item.admin_count))}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.statusPill, active ? styles.statusPillOk : styles.statusPillMissing]}
        onPress={onToggleStatus}
        hitSlop={6}
      >
        <Text style={active ? styles.statusPillTextOk : styles.statusPillTextMissing}>
          {active ? t('school_list.status_active', 'Active') : t('school_list.status_disabled', 'Disabled')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteIconBtn} onPress={onDelete} hitSlop={8}>
        <TrashIcon color={DANGER} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function AddSchoolSheet({
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
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [schoolType, setSchoolType] = useState<SchoolType>('regular');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setEmail('');
    setPhone('');
    setAddress('');
    setDescription('');
    setSchoolType('regular');
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!title.trim() || !email.trim() || !phone.trim() || !address.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      Alert.alert(t('school_list.almost_done', 'Almost done'), t('school_list.error_required_fields', 'School name, email, phone, address, and the first admin\'s details are all required.'));
      return;
    }
    if (adminPassword.trim().length < 8) {
      Alert.alert(t('school_list.almost_done', 'Almost done'), t('school_list.error_password_length', 'Admin password must be at least 8 characters.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await createSchool(token, {
        title: title.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        school_type: schoolType,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword.trim(),
      });
      resetForm();
      onClose();
      onCreated();
      Alert.alert(t('school_list.school_added_title', 'School created'), t('school_list.school_added_message', 'The school and its first admin can now log in.'));
    } catch (err) {
      Alert.alert(t('school_list.add_error_title', 'Could not create school'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
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
            <Text style={styles.sheetTitle}>{t('school_list.add_school_title', 'Add School')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('school_list.school_name_label', 'School Name')}</Text>
            <TextInput style={styles.fieldInput} placeholder={t('school_list.school_name_placeholder', 'e.g. Al-Falah Academy')} placeholderTextColor={SUBTLE} value={title} onChangeText={setTitle} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>{t('school_list.school_email_label', 'School Email')}</Text>
            <TextInput style={styles.fieldInput} placeholder="school@example.com" placeholderTextColor={SUBTLE} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={styles.fieldLabel}>{t('school_list.school_phone_label', 'School Phone')}</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. 012-345 6789" placeholderTextColor={SUBTLE} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>{t('school_list.school_address_label', 'Address')}</Text>
            <TextInput style={styles.fieldInput} placeholder={t('school_list.school_address_placeholder', 'Street, city')} placeholderTextColor={SUBTLE} value={address} onChangeText={setAddress} />

            <Text style={styles.fieldLabel}>{t('school_list.school_description_label', 'Description (optional)')}</Text>
            <TextInput style={[styles.fieldInput, styles.fieldInputMultiline]} value={description} onChangeText={setDescription} multiline />

            <Text style={styles.fieldLabel}>{t('school_list.school_type_label', 'School Type')}</Text>
            <View style={styles.typeToggleRow}>
              {(['regular', 'orphanage'] as SchoolType[]).map((typeOption) => (
                <TouchableOpacity
                  key={typeOption}
                  style={[styles.typeToggle, schoolType === typeOption && styles.typeToggleActive]}
                  onPress={() => setSchoolType(typeOption)}
                >
                  <Text style={[styles.typeToggleText, schoolType === typeOption && styles.typeToggleTextActive]}>
                    {typeOption === 'regular' ? t('school_list.type_regular', 'Regular') : t('school_list.type_orphanage', 'Orphanage')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sheetDivider}>{t('school_list.first_admin_label', 'First Admin')}</Text>

            <Text style={styles.fieldLabel}>{t('school_list.admin_name_label', 'Admin Name')}</Text>
            <TextInput style={styles.fieldInput} value={adminName} onChangeText={setAdminName} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>{t('school_list.admin_email_label', 'Admin Email')}</Text>
            <TextInput style={styles.fieldInput} value={adminEmail} onChangeText={setAdminEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={styles.fieldLabel}>{t('school_list.admin_password_label', 'Admin Password')}</Text>
            <TextInput style={styles.fieldInput} placeholder={t('school_list.admin_password_placeholder', 'At least 8 characters')} placeholderTextColor={SUBTLE} value={adminPassword} onChangeText={setAdminPassword} secureTextEntry autoCapitalize="none" />

            <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{t('school_list.add_school_title', 'Add School')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Superadmin-only: list, search, create, and enable/disable schools. */
export default function SchoolListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const load = useCallback(async (search = '') => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchSchools(token, search);
      setSchools(data.schools);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('school_list.load_error', 'Failed to load schools.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(query);
    setIsRefreshing(false);
  }, [load, query]);

  const handleSearchChange = (text: string) => {
    setQuery(text);
    load(text);
  };

  const handleToggleStatus = (school: School) => {
    const nextStatus = school.status === 1 ? 0 : 1;
    const title = nextStatus === 0 ? t('school_list.disable_confirm_title', 'Disable this school?') : t('school_list.enable_confirm_title', 'Enable this school?');
    const message = nextStatus === 0
      ? t('school_list.disable_confirm_message', 'This does not delete any data - it just marks the school disabled. You can re-enable it any time.')
      : t('school_list.enable_confirm_message', 'This school will be active again.');
    Alert.alert(title, message, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: nextStatus === 0 ? t('common.disable', 'Disable') : t('common.enable', 'Enable'),
        style: nextStatus === 0 ? 'destructive' : 'default',
        onPress: async () => {
          if (!token) return;
          try {
            await setSchoolStatus(token, school.id, nextStatus);
            load(query);
          } catch (err) {
            Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  const handleDelete = (school: School) => {
    Alert.alert(
      t('school_list.delete_confirm_title', 'Delete this school?'),
      t('school_list.delete_confirm_message', 'It moves to Trash and is removed everywhere immediately. It can be restored for 30 days, after which it - and everything in it - is permanently deleted.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await trashSchool(token, school.id);
              load(query);
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
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
          <Text style={styles.headerTitle}>{t('school_list.header_title', 'Schools')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => (navigation as any).navigate('SuperAdminTrash')} hitSlop={8} style={styles.trashLinkBtn}>
            <TrashIcon color={SUBTLE} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddSheetOpen(true)} hitSlop={8}>
            <PlusIcon color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('school_list.search_placeholder', 'Search schools...')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={handleSearchChange}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(query)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={schools}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => (
            <SchoolRow
              item={item}
              onPress={() => (navigation as any).navigate('SuperAdminSchoolAdmins', { schoolId: item.id, schoolName: item.title })}
              onToggleStatus={() => handleToggleStatus(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('school_list.empty_title', 'No schools found')}</Text>
              <Text style={styles.emptyBody}>
                {query ? t('school_list.empty_body_search', 'Try a different search term.') : t('school_list.empty_body_none', 'Schools you add will show up here.')}
              </Text>
            </View>
          }
        />
      )}

      <AddSchoolSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} onCreated={() => load(query)} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trashLinkBtn: { padding: 4 },
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
  rowEmail: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  typePill: { backgroundColor: EMERALD_SOFT, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 10.5, color: EMERALD, fontWeight: '700' },
  adminCountText: { fontSize: 11.5, color: SUBTLE },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 10,
  },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillMissing: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusPillTextOk: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },
  statusPillTextMissing: { fontSize: 11.5, color: DANGER, fontWeight: '700' },
  deleteIconBtn: { marginLeft: 10, padding: 4 },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  sheetDivider: { fontSize: 12, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 22, marginBottom: 4 },

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
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  typeToggleRow: { flexDirection: 'row', gap: 10 },
  typeToggle: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeToggleActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  typeToggleText: { fontSize: 13.5, fontWeight: '600', color: INK },
  typeToggleTextActive: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
