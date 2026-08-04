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
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchSchoolAdmins,
  createSchoolAdmin,
  deleteSchoolAdmin,
  resetSchoolAdminPassword,
  fetchUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  SchoolAdmin,
  UserSession,
} from '../../services/superAdminService';
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
      <Circle cx={12} cy={8} r={3.6} stroke="#C4C9CF" strokeWidth={1.6} />
      <Path d="M4.5 20c0-3.6 3.4-6.4 7.5-6.4s7.5 2.8 7.5 6.4" stroke="#C4C9CF" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function SessionsSheet({ visible, onClose, admin }: { visible: boolean; onClose: () => void; admin: SchoolAdmin | null }) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !admin) return;
    setIsLoading(true);
    try {
      const data = await fetchUserSessions(token, admin.id);
      setSessions(data.sessions);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, admin, t]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleRevoke = async (session: UserSession) => {
    if (!token) return;
    try {
      await revokeUserSession(token, session.id);
      load();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    }
  };

  const handleRevokeAll = () => {
    if (!token || !admin) return;
    Alert.alert(
      t('school_admins.revoke_all_title', 'Sign out everywhere?'),
      t('school_admins.revoke_all_message', 'This admin will need to log in again on every device.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('school_admins.revoke_all_confirm', 'Sign out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAllUserSessions(token, admin.id);
              load();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.formSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('school_admins.sessions_title', 'Active Sessions')} - {admin?.name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <Skeleton width="100%" height={60} />
          ) : sessions.length === 0 ? (
            <Text style={styles.sessionsEmpty}>{t('school_admins.sessions_empty', 'No active sessions.')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }}>
              {sessions.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.sessionName}>{s.name}</Text>
                    <Text style={styles.sessionMeta}>
                      {t('school_admins.session_last_used', 'Last used')}: {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : t('school_admins.session_never', 'never')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.sessionRevokeBtn} onPress={() => handleRevoke(s)}>
                    <Text style={styles.sessionRevokeText}>{t('common.revoke', 'Revoke')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {sessions.length > 0 ? (
            <TouchableOpacity style={styles.revokeAllButton} onPress={handleRevokeAll}>
              <Text style={styles.revokeAllButtonText}>{t('school_admins.revoke_all_confirm', 'Sign out everywhere')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const AdminRow = React.memo(function AdminRow({
  item,
  onDelete,
  onResetPassword,
  onViewSessions,
}: {
  item: SchoolAdmin;
  onDelete: () => void;
  onResetPassword: () => void;
  onViewSessions: () => void;
}) {
  const { t } = useLocale();
  const active = item.status === 1;
  return (
    <View style={styles.row}>
      <UserAvatar name={item.name} photo={null} size={44} ringColor={HAIRLINE} dotColor={active ? EMERALD : DANGER} />
      <View style={[styles.flex1, { marginLeft: 14 }]}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onViewSessions}>
            <Text style={styles.actionLink}>{t('school_admins.sessions_link', 'Sessions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onResetPassword}>
            <Text style={styles.actionLink}>{t('school_admins.reset_password_link', 'Reset password')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Text style={[styles.actionLink, { color: DANGER }]}>{t('common.delete', 'Delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

function ResetPasswordSheet({
  visible,
  onClose,
  admin,
}: {
  visible: boolean;
  onClose: () => void;
  admin: SchoolAdmin | null;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setPassword('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!token || !admin) return;
    if (password.trim().length < 8) {
      Alert.alert(t('school_admins.almost_done', 'Almost done'), t('school_admins.error_password_length', 'Password must be at least 8 characters.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await resetSchoolAdminPassword(token, admin.id, password.trim());
      setPassword('');
      onClose();
      Alert.alert(t('common.done', 'Done'), t('school_admins.reset_password_done', 'Password reset.'));
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
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
            <Text style={styles.sheetTitle}>{t('school_admins.reset_password_title', 'New password')} - {admin?.name}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>{t('school_admins.reset_password_message', 'At least 8 characters. This also signs them out everywhere.')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('school_admins.password_placeholder', 'At least 8 characters')}
            placeholderTextColor={SUBTLE}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{t('school_admins.reset_password_title', 'New password')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AddAdminSheet({
  visible,
  onClose,
  onCreated,
  schoolId,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  schoolId: number;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('school_admins.almost_done', 'Almost done'), t('school_admins.error_required_fields', 'Name, email, and password are required.'));
      return;
    }
    if (password.trim().length < 8) {
      Alert.alert(t('school_admins.almost_done', 'Almost done'), t('school_admins.error_password_length', 'Password must be at least 8 characters.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await createSchoolAdmin(token, { school_id: schoolId, name: name.trim(), email: email.trim(), password: password.trim() });
      resetForm();
      onClose();
      onCreated();
    } catch (err) {
      Alert.alert(t('school_admins.add_error_title', 'Could not add admin'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
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
            <Text style={styles.sheetTitle}>{t('school_admins.add_admin_title', 'Add Admin')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('school_admins.full_name_label', 'Full Name')}</Text>
            <TextInput style={styles.fieldInput} value={name} onChangeText={setName} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>{t('school_admins.email_label', 'Email')}</Text>
            <TextInput style={styles.fieldInput} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={styles.fieldLabel}>{t('school_admins.password_label', 'Password')}</Text>
            <TextInput style={styles.fieldInput} placeholder={t('school_admins.password_placeholder', 'At least 8 characters')} placeholderTextColor={SUBTLE} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

            <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{t('school_admins.add_admin_title', 'Add Admin')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Superadmin-only: admins for one school - add/delete/reset password/sessions. */
export default function SchoolAdminsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = useAuth();
  const { t } = useLocale();
  const { schoolId, schoolName } = (route.params as { schoolId: number; schoolName: string }) ?? {};

  const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [sessionsAdmin, setSessionsAdmin] = useState<SchoolAdmin | null>(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<SchoolAdmin | null>(null);

  const load = useCallback(async () => {
    if (!token || !schoolId) return;
    setError(null);
    try {
      const data = await fetchSchoolAdmins(token, schoolId);
      setAdmins(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('school_admins.load_error', 'Failed to load admins.'));
    }
  }, [token, schoolId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleDelete = (admin: SchoolAdmin) => {
    Alert.alert(
      t('school_admins.delete_confirm_title', 'Delete this admin?'),
      t('school_admins.delete_confirm_message', 'They lose access immediately and are signed out everywhere. They move to Trash and can be restored for 30 days, after which they\'re permanently deleted.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteSchoolAdmin(token, admin.id);
              load();
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
          <Text style={styles.headerTitle} numberOfLines={1}>{schoolName ?? t('school_admins.header_title', 'Admins')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddSheetOpen(true)} hitSlop={8}>
          <PlusIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.row}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE' }} />
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
          data={admins}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => (
            <AdminRow
              item={item}
              onDelete={() => handleDelete(item)}
              onResetPassword={() => setResetPasswordAdmin(item)}
              onViewSessions={() => setSessionsAdmin(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('school_admins.empty_title', 'No admins yet')}</Text>
              <Text style={styles.emptyBody}>{t('school_admins.empty_body', 'Add the first admin for this school.')}</Text>
            </View>
          }
        />
      )}

      <AddAdminSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} onCreated={load} schoolId={schoolId} />
      <SessionsSheet visible={!!sessionsAdmin} onClose={() => setSessionsAdmin(null)} admin={sessionsAdmin} />
      <ResetPasswordSheet visible={!!resetPasswordAdmin} onClose={() => setResetPasswordAdmin(null)} admin={resetPasswordAdmin} />
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
  headerTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
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
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionLink: { fontSize: 12, color: EMERALD, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },

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
  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  sessionsEmpty: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', paddingVertical: 30 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  sessionName: { fontSize: 14, fontWeight: '600', color: INK },
  sessionMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },
  sessionRevokeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  sessionRevokeText: { fontSize: 12.5, color: DANGER, fontWeight: '700' },
  revokeAllButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  revokeAllButtonText: { color: DANGER, fontWeight: '700', fontSize: 14 },
});
