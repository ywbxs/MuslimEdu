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
import Svg, { Line, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchApiKeys, createApiKey, revokeApiKey, ApiKeyRecord } from '../../services/superAdminService';
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
function KeyIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={15} r={4} stroke={color} strokeWidth={2} />
      <Path d="M11 12l8-8M16 5l3 3M13 8l2 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const KeyRow = React.memo(function KeyRow({ item, onRevoke }: { item: ApiKeyRecord; onRevoke: () => void }) {
  const { t } = useLocale();
  return (
    <View style={styles.row}>
      <View style={styles.keyIconWrap}>
        <KeyIcon color={item.is_active ? EMERALD : SUBTLE} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.key_prefix}...</Text>
        {item.school ? <Text style={styles.rowMeta}>{item.school.title}</Text> : <Text style={styles.rowMeta}>{t('api_locker.all_schools', 'All schools')}</Text>}
        <Text style={styles.rowMeta}>
          {item.last_used_at
            ? `${t('api_locker.last_used', 'Last used')}: ${new Date(item.last_used_at).toLocaleDateString()}`
            : t('api_locker.never_used', 'Never used')}
        </Text>
      </View>
      {item.is_active ? (
        <TouchableOpacity style={styles.revokeBtn} onPress={onRevoke}>
          <Text style={styles.revokeBtnText}>{t('common.revoke', 'Revoke')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.revokedPill}>
          <Text style={styles.revokedPillText}>{t('api_locker.revoked', 'Revoked')}</Text>
        </View>
      )}
    </View>
  );
});

function CreateKeySheet({
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
  const [expiresInDays, setExpiresInDays] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setExpiresInDays('');
    setRawKey(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!name.trim()) {
      Alert.alert(t('api_locker.almost_done', 'Almost done'), t('api_locker.error_name_required', 'Give this key a name so you can recognize it later.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const { rawKey: key } = await createApiKey(token, {
        name: name.trim(),
        expires_in_days: expiresInDays.trim() ? Number(expiresInDays.trim()) : undefined,
      });
      setRawKey(key);
      onCreated();
    } catch (err) {
      Alert.alert(t('api_locker.create_error_title', 'Could not create key'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
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
            <Text style={styles.sheetTitle}>{t('api_locker.create_key_title', 'New API Key')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {rawKey ? (
            <View>
              <Text style={styles.fieldLabel}>{t('api_locker.key_created_label', 'Copy this key now - it will not be shown again.')}</Text>
              <View style={styles.rawKeyBox}>
                <Text style={styles.rawKeyText} selectable>{rawKey}</Text>
              </View>
              <Text style={styles.rawKeyHint}>{t('api_locker.copy_hint', 'Tap and hold the key above to select and copy it.')}</Text>
              <TouchableOpacity style={styles.submitButton} onPress={handleClose}>
                <Text style={styles.submitButtonText}>{t('common.done', 'Done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('api_locker.name_label', 'Name')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('api_locker.name_placeholder', 'e.g. Partner Payment Gateway')}
                placeholderTextColor={SUBTLE}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>{t('api_locker.expires_label', 'Expires in days (optional)')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('api_locker.expires_placeholder', 'Leave blank for no expiration')}
                placeholderTextColor={SUBTLE}
                value={expiresInDays}
                onChangeText={setExpiresInDays}
                keyboardType="number-pad"
              />

              <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{t('api_locker.create_key_title', 'New API Key')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Superadmin-only: issue and revoke 3rd-party API keys. */
export default function ApiLockerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchApiKeys(token);
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('api_locker.load_error', 'Failed to load API keys.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleRevoke = (key: ApiKeyRecord) => {
    Alert.alert(
      t('api_locker.revoke_confirm_title', 'Revoke this key?'),
      t('api_locker.revoke_confirm_message', 'Any system using it will stop being able to call the API immediately.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.revoke', 'Revoke'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await revokeApiKey(token, key.id);
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
          <Text style={styles.headerTitle}>{t('api_locker.header_title', 'API Locker')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateSheetOpen(true)} hitSlop={8}>
          <PlusIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1].map((i) => (
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
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={keys}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => <KeyRow item={item} onRevoke={() => handleRevoke(item)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('api_locker.empty_title', 'No API keys yet')}</Text>
              <Text style={styles.emptyBody}>{t('api_locker.empty_body', 'Issue a key for an outside system to call your API.')}</Text>
            </View>
          }
        />
      )}

      <CreateKeySheet visible={createSheetOpen} onClose={() => setCreateSheetOpen(false)} onCreated={load} />
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
  keyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowName: { fontSize: 15, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  revokeBtnText: { fontSize: 12.5, color: DANGER, fontWeight: '700' },
  revokedPill: { backgroundColor: '#EEF0F2', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  revokedPillText: { fontSize: 11, color: SUBTLE, fontWeight: '700' },

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

  rawKeyBox: {
    backgroundColor: '#F5F6F7',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginTop: 6,
  },
  rawKeyText: { fontSize: 13.5, color: INK, fontFamily: 'monospace' },
  rawKeyHint: { fontSize: 12, color: SUBTLE, marginTop: 10 },
});
