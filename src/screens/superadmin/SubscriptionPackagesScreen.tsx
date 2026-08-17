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
import { ChevronLeft, CreditCard, Plus, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchPackages,
  createPackage,
  updatePackage,
  setPackageStatus,
  SubscriptionPackage,
  PackageInterval,
} from '../../services/superAdminService';
import { SUBSCRIPTION_FEATURE_KEYS } from '../../services/subscriptionService';
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

const INTERVAL_OPTIONS: { value: PackageInterval; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'life_time', label: 'Lifetime' },
];

const FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: SUBSCRIPTION_FEATURE_KEYS.gradingSystems, label: 'Grading Systems' },
  { key: SUBSCRIPTION_FEATURE_KEYS.examCategories, label: 'Exam Categories' },
  { key: SUBSCRIPTION_FEATURE_KEYS.gradebookReview, label: 'Gradebook Review' },
];

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function PlusIcon({ color }: { color: string }) {
  return <Plus size={19} color={color} strokeWidth={2.4} />;
}
function CloseIcon({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function EmptyIcon() {
  return <CreditCard size={56} color={'#C4C9CF'} strokeWidth={1.6} />;
}

function intervalLabel(interval: PackageInterval) {
  return INTERVAL_OPTIONS.find((o) => o.value === interval)?.label ?? interval;
}

const PackageRow = React.memo(function PackageRow({
  item,
  onPress,
  onToggleStatus,
}: {
  item: SubscriptionPackage;
  onPress: () => void;
  onToggleStatus: () => void;
}) {
  const { t } = useLocale();
  const active = item.status === 1;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.flex1}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {`${item.price} · ${intervalLabel(item.interval)} · ${item.student_limit || 'Unlimited'} students`}
        </Text>
        {item.features.length > 0 ? (
          <Text style={styles.rowFeatures} numberOfLines={1}>
            {t('subscription_packages.features_count', '{count} feature(s) restricted').replace(
              '{count}',
              String(item.features.length),
            )}
          </Text>
        ) : (
          <Text style={styles.rowFeatures} numberOfLines={1}>
            {t('subscription_packages.features_all', 'Grants every admin feature')}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.statusPill, active ? styles.statusPillOk : styles.statusPillMissing]}
        onPress={onToggleStatus}
        hitSlop={6}
      >
        <Text style={active ? styles.statusPillTextOk : styles.statusPillTextMissing}>
          {active ? t('subscription_packages.status_active', 'Active') : t('subscription_packages.status_archived', 'Archived')}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function PackageSheet({
  visible,
  onClose,
  onSaved,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: SubscriptionPackage | null;
}) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [packageType, setPackageType] = useState('Standard');
  const [interval, setInterval] = useState<PackageInterval>('monthly');
  const [days, setDays] = useState('30');
  const [studentLimit, setStudentLimit] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setPrice(String(editing.price));
      setPackageType(editing.package_type);
      setInterval(editing.interval);
      setDays(editing.days ? String(editing.days) : '30');
      setStudentLimit(editing.student_limit && editing.student_limit !== 'Unlimited' ? editing.student_limit : '');
      setFeatures(editing.features ?? []);
      setDescription(editing.description ?? '');
    } else {
      setName('');
      setPrice('');
      setPackageType('Standard');
      setInterval('monthly');
      setDays('30');
      setStudentLimit('');
      setFeatures([]);
      setDescription('');
    }
  }, [visible, editing]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const toggleFeature = (key: string) => {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!name.trim() || !price.trim() || !packageType.trim()) {
      Alert.alert(
        t('subscription_packages.almost_done', 'Almost done'),
        t('subscription_packages.error_required_fields', 'Name, price, and package type are required.'),
      );
      return;
    }
    if (interval !== 'life_time' && !days.trim()) {
      Alert.alert(
        t('subscription_packages.almost_done', 'Almost done'),
        t('subscription_packages.error_days_required', 'Billing length (in days) is required for this interval.'),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      if (editing) {
        await updatePackage(token, {
          package_id: editing.id,
          name: name.trim(),
          price: Number(price),
          package_type: packageType.trim(),
          interval,
          days: interval === 'life_time' ? undefined : Number(days),
          student_limit: studentLimit.trim() || 'Unlimited',
          features,
          description: description.trim(),
        });
      } else {
        await createPackage(token, {
          name: name.trim(),
          price: Number(price),
          package_type: packageType.trim(),
          interval,
          days: interval === 'life_time' ? undefined : Number(days),
          student_limit: studentLimit.trim() || 'Unlimited',
          features,
          description: description.trim(),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      Alert.alert(
        t('subscription_packages.save_error_title', 'Could not save package'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
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
            <Text style={styles.sheetTitle}>
              {editing
                ? t('subscription_packages.edit_title', 'Edit Package')
                : t('subscription_packages.add_title', 'Add Package')}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>{t('subscription_packages.name_label', 'Package Name')}</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. Premium" placeholderTextColor={SUBTLE} value={name} onChangeText={setName} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>{t('subscription_packages.price_label', 'Price')}</Text>
            <TextInput style={styles.fieldInput} placeholder="0.00" placeholderTextColor={SUBTLE} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>{t('subscription_packages.type_label', 'Package Type')}</Text>
            <TextInput style={styles.fieldInput} placeholder="e.g. Standard" placeholderTextColor={SUBTLE} value={packageType} onChangeText={setPackageType} />

            <Text style={styles.fieldLabel}>{t('subscription_packages.interval_label', 'Billing Interval')}</Text>
            <View style={styles.optionRow}>
              {INTERVAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionChip, interval === opt.value && styles.optionChipActive]}
                  onPress={() => setInterval(opt.value)}
                >
                  <Text style={[styles.optionChipText, interval === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {interval !== 'life_time' ? (
              <>
                <Text style={styles.fieldLabel}>
                  {t('subscription_packages.days_label', 'Billing Length (days)')}
                </Text>
                <TextInput style={styles.fieldInput} placeholder="30" placeholderTextColor={SUBTLE} value={days} onChangeText={setDays} keyboardType="number-pad" />
              </>
            ) : null}

            <Text style={styles.fieldLabel}>{t('subscription_packages.student_limit_label', 'Student Limit')}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={t('subscription_packages.student_limit_placeholder', 'Unlimited')}
              placeholderTextColor={SUBTLE}
              value={studentLimit}
              onChangeText={setStudentLimit}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>{t('subscription_packages.features_label', 'Restrict to Features')}</Text>
            <Text style={styles.fieldHint}>
              {t(
                'subscription_packages.features_hint',
                'Leave all unchecked to grant every admin feature while the subscription is active.',
              )}
            </Text>
            <View style={styles.featureList}>
              {FEATURE_OPTIONS.map((opt) => {
                const checked = features.includes(opt.key);
                return (
                  <TouchableOpacity key={opt.key} style={styles.featureRow} onPress={() => toggleFeature(opt.key)}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.featureLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>{t('subscription_packages.description_label', 'Description (optional)')}</Text>
            <TextInput style={[styles.fieldInput, styles.fieldInputMultiline]} value={description} onChangeText={setDescription} multiline />

            <TouchableOpacity style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editing ? t('subscription_packages.save_button', 'Save Changes') : t('subscription_packages.add_title', 'Add Package')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Superadmin-only: the catalog of subscription plans (price, billing interval, student limit, gated features). */
export default function SubscriptionPackagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPackage | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchPackages(token);
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('subscription_packages.load_error', 'Failed to load packages.'));
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

  const handleToggleStatus = (pkg: SubscriptionPackage) => {
    if (!token) return;
    const nextStatus = pkg.status === 1 ? 0 : 1;
    setPackageStatus(token, pkg.id, nextStatus)
      .then(() => load())
      .catch((err) => {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
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
          <Text style={styles.headerTitle}>{t('subscription_packages.header_title', 'Subscription Plans')}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditing(null);
            setSheetVisible(true);
          }}
          hitSlop={8}
        >
          <PlusIcon color="#FFFFFF" />
        </TouchableOpacity>
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
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={packages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => (
            <PackageRow
              item={item}
              onPress={() => {
                setEditing(item);
                setSheetVisible(true);
              }}
              onToggleStatus={() => handleToggleStatus(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyIcon />
              <Text style={styles.emptyTitle}>{t('subscription_packages.empty_title', 'No packages yet')}</Text>
              <Text style={styles.emptyBody}>
                {t('subscription_packages.empty_body', 'Add a plan schools can be subscribed to.')}
              </Text>
            </View>
          }
        />
      )}

      <PackageSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSaved={load}
        editing={editing}
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
  rowMeta: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  rowFeatures: { fontSize: 11.5, color: EMERALD, marginTop: 4, fontWeight: '600' },
  statusPill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 10 },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillMissing: { backgroundColor: '#EEF0F2' },
  statusPillTextOk: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },
  statusPillTextMissing: { fontSize: 11.5, color: SUBTLE, fontWeight: '700' },

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
    maxHeight: '88%',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  fieldHint: { fontSize: 11.5, color: SUBTLE, marginTop: -4, marginBottom: 8, lineHeight: 16 },
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

  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  optionChipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  optionChipText: { fontSize: 13, fontWeight: '600', color: INK },
  optionChipTextActive: { color: '#FFFFFF' },

  featureList: { gap: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: EMERALD, borderColor: EMERALD },
  checkboxMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  featureLabel: { fontSize: 14, color: INK },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
