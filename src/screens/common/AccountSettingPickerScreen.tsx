import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale, RTL_LOCALES } from '../../context/LocaleContext';
import { useDisplayScale, DISPLAY_SCALE_OPTIONS } from '../../context/DisplayScaleContext';
import { INK } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';
import { UserSettings, saveUserSettings } from '../../services/studentPortalService';

/**
 * The "wizard" a single Account Settings row opens into - one focused
 * screen per setting instead of picking it inline in a chip cluster on a
 * long page (see AccountSettingsScreen, which now just lists rows).
 *
 * Every field except `display_scale` is a real UserSettings key and saves
 * to the backend the instant an option is tapped (no separate "Save"
 * step, same as Apple/FB settings) - AccountSettingsScreen re-fetches on
 * focus (useFocusEffect) so it reflects whatever was just changed here.
 * `display_scale` isn't a backend field at all - it's local-only via
 * DisplayScaleContext, so its branch skips the network call entirely and
 * applies instantly through the same context every other screen reads.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const EMERALD_SOFT = '#E5F8F5';

export type AccountSettingField = keyof Pick<
  UserSettings,
  'language' | 'theme' | 'calendar_type' | 'date_format' | 'profile_visibility' | 'digest_frequency'
>;

export interface AccountSettingOption {
  key: string;
  label: string;
}

export interface AccountSettingPickerParams {
  settingField: AccountSettingField | 'display_scale';
  title: string;
  options: AccountSettingOption[];
  currentKey: string;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check size={16} color={color} strokeWidth={3} />;
}

export default function AccountSettingPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, isRTL, refresh: refreshLocale } = useLocale();
  const { setScale } = useDisplayScale();

  const { settingField, title, options, currentKey } = route.params as AccountSettingPickerParams;

  const [selectedKey, setSelectedKey] = useState(currentKey);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const onPick = async (key: string) => {
    if (key === selectedKey || savingKey) return;

    if (settingField === 'display_scale') {
      const opt = DISPLAY_SCALE_OPTIONS.find((o) => o.key === key);
      if (opt) setScale(opt.value);
      setSelectedKey(key);
      navigation.goBack();
      return;
    }

    if (!token) return;
    setSavingKey(key);
    try {
      const wasRTL = isRTL;
      await saveUserSettings(token, { [settingField]: key } as Partial<UserSettings>);
      setSelectedKey(key);

      if (settingField === 'language') {
        await refreshLocale(key);
        const willBeRTL = RTL_LOCALES.has(key);
        if (willBeRTL !== wasRTL) {
          Alert.alert(
            t('account_settings.restart_required_title', 'Restart required'),
            t(
              'account_settings.restart_required_message',
              'Your language was saved. Restart the app for the right-to-left layout to fully apply.',
            ),
          );
          navigation.goBack();
          return;
        }
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(
        t('account_settings.save_error_title', 'Could not save'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <IconChevronLeft color={BRAND.emeraldDeep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {options.map((opt, i) => {
            const selected = opt.key === selectedKey;
            const saving = savingKey === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.row, i !== options.length - 1 && styles.rowDivider]}
                onPress={() => onPick(opt.key)}
                activeOpacity={0.7}
                disabled={!!savingKey}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{opt.label}</Text>
                {saving ? (
                  <ActivityIndicator size="small" color={BRAND.emeraldDeep} />
                ) : selected ? (
                  <View style={styles.checkBadge}>
                    <IconCheck color="#FFFFFF" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLabel: { fontSize: 15, color: INK, fontWeight: '600' },
  rowLabelSelected: { fontWeight: '800' },
  checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.emeraldDeep, alignItems: 'center', justifyContent: 'center' },
});
