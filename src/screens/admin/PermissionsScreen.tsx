import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  CapabilityFlag,
  GrantDraft,
  PermissionCatalogData,
  PermissionGrant,
  deletePermissionGrant,
  fetchCapabilityFlags,
  fetchPermissionCatalog,
  fetchPermissionGrants,
  saveCapabilityFlag,
  savePermissionGrant,
} from '../../services/permissionsAdminService';

/**
 * §4.20 Real permissions CRUD.
 *
 * IMPORTANT caveat carried over from the backend work: PermissionGrant and
 * CapabilityFlag are primitives only right now — saving a grant here does
 * NOT yet make any existing endpoint respect it. This screen lets an admin
 * build up the data; wiring other controllers to check it is separate,
 * future work. Never executed against a live backend.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';

type Tab = 'grants' | 'modules';

export default function PermissionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [tab, setTab] = useState<Tab>('grants');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<PermissionCatalogData | null>(null);
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [flags, setFlags] = useState<CapabilityFlag[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<PermissionGrant | null>(null);
  const [saving, setSaving] = useState(false);
  const [fRoleId, setFRoleId] = useState<number | null>(null);
  const [fPermKey, setFPermKey] = useState<string | null>(null);
  const [fCanAccess, setFCanAccess] = useState(true);
  const [fCanApprove, setFCanApprove] = useState(false);
  const [fCanOverride, setFCanOverride] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, g, f] = await Promise.all([
        fetchPermissionCatalog(token),
        fetchPermissionGrants(token),
        fetchCapabilityFlags(token),
      ]);
      setCatalog(cat);
      setGrants(g);
      setFlags(f);
    } catch (e: any) {
      setError(e?.message ?? t('permissions.load_error', 'Could not load permissions.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const roleLabel = useCallback(
    (roleId: number) => catalog?.roles?.[String(roleId)] ?? t('permissions.role_fallback', 'Role {id}').replace('{id}', String(roleId)),
    [catalog, t]
  );
  const permLabel = useCallback(
    (key: string) => catalog?.permission_keys?.[key] ?? key,
    [catalog]
  );

  const roleOptions = useMemo(
    () => Object.entries(catalog?.roles ?? {}).map(([id, label]) => ({ id: Number(id), label })),
    [catalog]
  );
  const permOptions = useMemo(
    () => Object.entries(catalog?.permission_keys ?? {}).map(([key, label]) => ({ key, label })),
    [catalog]
  );

  const openNewGrant = () => {
    setEditing(null);
    setFRoleId(roleOptions[0]?.id ?? null);
    setFPermKey(permOptions[0]?.key ?? null);
    setFCanAccess(true);
    setFCanApprove(false);
    setFCanOverride(false);
    setFormVisible(true);
  };

  const openEditGrant = (g: PermissionGrant) => {
    setEditing(g);
    setFRoleId(g.role_id);
    setFPermKey(g.permission_key);
    setFCanAccess(g.can_access);
    setFCanApprove(g.can_approve);
    setFCanOverride(g.can_override);
    setFormVisible(true);
  };

  const onSaveGrant = async () => {
    if (!token || fRoleId == null || !fPermKey) {
      Alert.alert(t('permissions.missing_info', 'Missing info'), t('permissions.choose_role_permission', 'Choose a role and a permission first.'));
      return;
    }
    setSaving(true);
    try {
      const draft: GrantDraft = {
        id: editing?.id,
        role_id: fRoleId,
        permission_key: fPermKey,
        can_access: fCanAccess,
        can_approve: fCanApprove,
        can_override: fCanOverride,
      };
      const saved = await savePermissionGrant(token, draft);
      setGrants((prev) => {
        const others = prev.filter((g) => g.id !== saved.id);
        return [...others, saved];
      });
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(t('permissions.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteGrant = (g: PermissionGrant) => {
    Alert.alert(
      t('permissions.remove_grant_title', 'Remove grant?'),
      t('permissions.remove_grant_message', '{role} will lose "{perm}".')
        .replace('{role}', roleLabel(g.role_id))
        .replace('{perm}', permLabel(g.permission_key)),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('permissions.remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deletePermissionGrant(token, g.id);
              setGrants((prev) => prev.filter((x) => x.id !== g.id));
            } catch (e: any) {
              Alert.alert(t('permissions.remove_error', 'Could not remove'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const toggleFlag = async (flag: CapabilityFlag) => {
    if (!token) return;
    try {
      const saved = await saveCapabilityFlag(token, flag.module_key, !flag.is_enabled, flag.config);
      setFlags((prev) => prev.map((f) => (f.module_key === saved.module_key ? saved : f)));
    } catch (e: any) {
      Alert.alert(t('permissions.update_error', 'Could not update'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('permissions.loading', 'Loading permissions…')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('permissions.load_failed_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('permissions.title', 'Permissions')}</Text>
          <Text style={styles.headerSub}>{t('permissions.subtitle', 'Role capabilities and optional modules')}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'grants' && styles.tabActive]} onPress={() => setTab('grants')}>
          <Text style={[styles.tabText, tab === 'grants' && styles.tabTextActive]}>{t('permissions.tab_grants', 'Role Grants')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'modules' && styles.tabActive]} onPress={() => setTab('modules')}>
          <Text style={[styles.tabText, tab === 'modules' && styles.tabTextActive]}>{t('permissions.tab_modules', 'Optional Modules')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {tab === 'grants' ? (
          grants.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('permissions.empty_grants', 'No permission grants yet. Add one to give a role fine-grained access.')}</Text>
            </View>
          ) : (
            grants.map((g) => (
              <View key={g.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexCol}>
                    <Text style={styles.rowTitle}>{permLabel(g.permission_key)}</Text>
                    <Text style={styles.rowSub}>
                      {roleLabel(g.role_id)}
                      {g.can_approve ? ` · ${t('permissions.can_approve', 'can approve')}` : ''}
                      {g.can_override ? ` · ${t('permissions.can_override', 'can override')}` : ''}
                      {!g.is_active ? ` · ${t('permissions.inactive', 'inactive')}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => openEditGrant(g)}>
                    <Text style={styles.actionLink}>{t('common.edit', 'Edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteGrant(g)}>
                    <Text style={[styles.actionLink, styles.deleteLink]}>{t('permissions.remove', 'Remove')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : flags.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('permissions.empty_modules', 'No optional modules configured for this school yet.')}</Text>
          </View>
        ) : (
          flags.map((f) => (
            <View key={f.module_key} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{f.label}</Text>
                  <Text style={styles.rowSub}>{f.is_enabled ? t('permissions.enabled', 'Enabled for this school') : t('permissions.disabled', 'Disabled')}</Text>
                </View>
                <Switch value={f.is_enabled} onValueChange={() => toggleFlag(f)} trackColor={{ false: '#D8DED9', true: EMERALD }} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {tab === 'grants' && (
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.addBtn} onPress={openNewGrant}>
            <Text style={styles.addBtnText}>{t('permissions.add_grant', '+ Add Grant')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? t('permissions.edit_grant', 'Edit Grant') : t('permissions.new_grant', 'New Grant')}</Text>

            <Text style={styles.label}>{t('permissions.role_label', 'Role')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {roleOptions.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.chip, fRoleId === r.id && styles.chipActive]}
                  onPress={() => setFRoleId(r.id)}
                  disabled={!!editing}
                >
                  <Text style={[styles.chipText, fRoleId === r.id && styles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('permissions.permission_label', 'Permission')}</Text>
            <ScrollView style={styles.permList} nestedScrollEnabled>
              {permOptions.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.permRow, fPermKey === p.key && styles.permRowActive]}
                  onPress={() => setFPermKey(p.key)}
                  disabled={!!editing}
                >
                  <Text style={[styles.permRowText, fPermKey === p.key && styles.permRowTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.switchRow}>
              <Text style={styles.label}>{t('permissions.can_access', 'Can access')}</Text>
              <Switch value={fCanAccess} onValueChange={setFCanAccess} trackColor={{ false: '#D8DED9', true: EMERALD }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>{t('permissions.can_approve_label', 'Can approve')}</Text>
              <Switch value={fCanApprove} onValueChange={setFCanApprove} trackColor={{ false: '#D8DED9', true: EMERALD }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>{t('permissions.can_override_label', 'Can override')}</Text>
              <Switch value={fCanOverride} onValueChange={setFCanOverride} trackColor={{ false: '#D8DED9', true: EMERALD }} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveGrant} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>{t('common.save', 'Save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  center: { flex: 1, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: EMERALD, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: '#FFFFFF' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: '#F1F3F2' },
  tabActive: { backgroundColor: EMERALD },
  tabText: { fontSize: 13.5, fontWeight: '700', color: SUBTLE },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  actionLink: { fontSize: 13, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  addBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '86%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 10 },
  chipScroll: { marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFBFA', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },
  permList: { marginTop: 8, maxHeight: 160, borderWidth: 1, borderColor: BORDER, borderRadius: 12 },
  permRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: BORDER },
  permRowActive: { backgroundColor: EMERALD_SOFT },
  permRowText: { fontSize: 13.5, color: INK },
  permRowTextActive: { color: EMERALD, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
