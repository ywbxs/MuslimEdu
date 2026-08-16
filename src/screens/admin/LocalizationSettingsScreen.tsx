import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Globe, Plus } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  LocaleOption,
  fetchLocaleBundle,
  saveLocales,
  saveTranslations,
} from '../../services/academicLocaleService';
import { Skeleton } from '../../components/Skeleton';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const BORDER = COLORS.border;

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function PlusIcon({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.2} />;
}
function GlobeIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Globe size={size} color={color} strokeWidth={1.8} />;
}

/**
 * School-scoped language/translation management - see
 * academicLocaleService.ts for the backend contract this drives (already
 * live: AcademicLocaleController). Two sections: which languages this
 * school has configured, and per-language text overrides (translation
 * key/value pairs) for whatever strings an admin wants to customize.
 *
 * There's no master list of every translatable string in the app to walk
 * through - a translation key is just whatever a screen's t('key',
 * 'fallback') call already uses, so this is an "add the keys you want to
 * override" editor, not a guided checklist of every term.
 */
export default function LocalizationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [locales, setLocales] = useState<LocaleOption[]>([]);
  const [loadingLocales, setLoadingLocales] = useState(true);
  const [savingLocale, setSavingLocale] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsRtl, setNewIsRtl] = useState(false);
  const [addingLocale, setAddingLocale] = useState(false);

  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [savingTranslations, setSavingTranslations] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const loadLocales = useCallback(async () => {
    if (!token) return;
    setLoadingLocales(true);
    try {
      const rows = await saveLocales(token, []);
      setLocales(rows);
      setSelectedLocale((prev) => prev ?? rows[0]?.code ?? 'en');
    } catch (err: any) {
      Alert.alert("Couldn't load languages", err?.message ?? 'Please try again.');
    } finally {
      setLoadingLocales(false);
    }
  }, [token]);

  useEffect(() => {
    loadLocales();
  }, [loadLocales]);

  const loadTranslations = useCallback(
    async (locale: string) => {
      if (!token) return;
      setLoadingTranslations(true);
      try {
        const bundle = await fetchLocaleBundle(token, locale);
        setTranslations(bundle.translations ?? {});
        setDirtyKeys(new Set());
      } catch (err: any) {
        Alert.alert("Couldn't load translations", err?.message ?? 'Please try again.');
      } finally {
        setLoadingTranslations(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (selectedLocale) loadTranslations(selectedLocale);
  }, [selectedLocale, loadTranslations]);

  const addLocale = async () => {
    if (!token || !newCode.trim() || !newName.trim()) return;
    setSavingLocale(true);
    try {
      const merged = [
        ...locales.map((l) => ({ code: l.code, name: l.name, is_rtl: l.is_rtl })),
        { code: newCode.trim().toLowerCase(), name: newName.trim(), is_rtl: newIsRtl },
      ];
      const rows = await saveLocales(token, merged);
      setLocales(rows);
      setNewCode('');
      setNewName('');
      setNewIsRtl(false);
      setAddingLocale(false);
    } catch (err: any) {
      Alert.alert("Couldn't add language", err?.message ?? 'Please try again.');
    } finally {
      setSavingLocale(false);
    }
  };

  const editValue = (key: string, value: string) => {
    setTranslations((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const addTerm = () => {
    const key = newKey.trim();
    if (!key || !newValue.trim()) return;
    setTranslations((prev) => ({ ...prev, [key]: newValue }));
    setDirtyKeys((prev) => new Set(prev).add(key));
    setNewKey('');
    setNewValue('');
  };

  const saveDirtyTranslations = async () => {
    if (!token || !selectedLocale || dirtyKeys.size === 0) return;
    setSavingTranslations(true);
    try {
      const rows = Array.from(dirtyKeys).map((key) => ({ locale: selectedLocale, key, value: translations[key] ?? '' }));
      await saveTranslations(token, rows);
      setDirtyKeys(new Set());
      Alert.alert('Saved', 'Translations updated.');
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? 'Please try again.');
    } finally {
      setSavingTranslations(false);
    }
  };

  const translationRows = useMemo(() => Object.entries(translations).sort(([a], [b]) => a.localeCompare(b)), [translations]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Localization</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Languages</Text>
        {loadingLocales ? (
          <Skeleton width="100%" height={64} borderRadius={RADIUS.md} />
        ) : (
          <View style={styles.localeList}>
            {locales.map((l) => (
              <View key={l.code} style={styles.localeCard}>
                <View style={styles.localeIconWrap}>
                  <GlobeIcon />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.localeName}>{l.name}</Text>
                  <Text style={styles.localeMeta}>{l.code}{l.is_rtl ? ' · RTL' : ''}</Text>
                </View>
              </View>
            ))}
            {locales.length === 0 && <Text style={styles.emptyText}>No languages configured yet.</Text>}
          </View>
        )}

        {addingLocale ? (
          <View style={styles.addLocaleCard}>
            <TextInput
              style={styles.input}
              placeholder="Code (e.g. ar)"
              placeholderTextColor={SUBTLE}
              value={newCode}
              onChangeText={setNewCode}
              autoCapitalize="none"
              maxLength={12}
            />
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Name (e.g. العربية)"
              placeholderTextColor={SUBTLE}
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Right-to-left</Text>
              <Switch value={newIsRtl} onValueChange={setNewIsRtl} trackColor={{ true: EMERALD }} />
            </View>
            <View style={styles.addLocaleActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAddingLocale(false)} disabled={savingLocale}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (savingLocale || !newCode.trim() || !newName.trim()) && styles.primaryBtnDisabled]}
                onPress={addLocale}
                disabled={savingLocale || !newCode.trim() || !newName.trim()}
              >
                {savingLocale ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addLocaleBtn} onPress={() => setAddingLocale(true)} activeOpacity={0.85}>
            <PlusIcon color={EMERALD} />
            <Text style={styles.addLocaleBtnText}>Add Language</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Translations</Text>
        <View style={styles.chipRow}>
          {locales.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.chip, selectedLocale === l.code && styles.chipActive]}
              onPress={() => setSelectedLocale(l.code)}
            >
              <Text style={[styles.chipText, selectedLocale === l.code && styles.chipTextActive]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          Add any translation key used in the app (e.g. feed.header_home) to override its text for this language. There's no
          master list - only keys you've added here show up.
        </Text>

        {loadingTranslations ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Skeleton width="100%" height={54} borderRadius={RADIUS.md} />
            <Skeleton width="100%" height={54} borderRadius={RADIUS.md} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 8 }}>
            {translationRows.map(([key, value]) => (
              <View key={key} style={styles.termRow}>
                <Text style={styles.termKey} numberOfLines={1}>{key}</Text>
                <TextInput style={styles.termInput} value={value} onChangeText={(v) => editValue(key, v)} multiline />
                {dirtyKeys.has(key) && <View style={styles.dirtyDot} />}
              </View>
            ))}
            {translationRows.length === 0 && <Text style={styles.emptyText}>No overrides yet for this language.</Text>}
          </View>
        )}

        <View style={styles.addTermCard}>
          <TextInput
            style={styles.input}
            placeholder="Key (e.g. feed.header_home)"
            placeholderTextColor={SUBTLE}
            value={newKey}
            onChangeText={setNewKey}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Text for this language"
            placeholderTextColor={SUBTLE}
            value={newValue}
            onChangeText={setNewValue}
          />
          <TouchableOpacity
            style={[styles.addLocaleBtn, { marginTop: 10 }, (!newKey.trim() || !newValue.trim()) && styles.primaryBtnDisabled]}
            onPress={addTerm}
            disabled={!newKey.trim() || !newValue.trim()}
          >
            <PlusIcon color={EMERALD} />
            <Text style={styles.addLocaleBtnText}>Add Term</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveAllBtn, (dirtyKeys.size === 0 || savingTranslations) && styles.primaryBtnDisabled]}
          onPress={saveDirtyTranslations}
          disabled={dirtyKeys.size === 0 || savingTranslations}
        >
          {savingTranslations ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>{dirtyKeys.size > 0 ? `Save Changes (${dirtyKeys.size})` : 'Save Changes'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  body: { padding: 16, paddingBottom: 60 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  hint: { fontSize: 12, color: SUBTLE, marginTop: 8, lineHeight: 17 },
  emptyText: { fontSize: 13, color: SUBTLE, textAlign: 'center', paddingVertical: 12 },

  localeList: { gap: 8 },
  localeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 12, ...SHADOW.level1 },
  localeIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  localeName: { fontSize: 14, fontWeight: '700', color: INK },
  localeMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },

  addLocaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: EMERALD,
    borderStyle: 'dashed',
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
    marginTop: 10,
  },
  addLocaleBtnText: { color: EMERALD, fontWeight: '700', fontSize: 13.5 },
  addLocaleCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 14, marginTop: 10, ...SHADOW.level1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 13.5, color: INK, fontWeight: '600' },
  addLocaleActions: { flexDirection: 'row', gap: 10, marginTop: 14 },

  input: { borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: INK, backgroundColor: COLORS.surface },

  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  secondaryBtnText: { color: INK, fontWeight: '700', fontSize: 13.5 },
  primaryBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: EMERALD, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: INK },
  chipTextActive: { color: '#FFFFFF' },

  termRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 12, ...SHADOW.level1, gap: 8 },
  termKey: { width: 120, fontSize: 11.5, color: SUBTLE, fontWeight: '600' },
  termInput: { flex: 1, fontSize: 13.5, color: INK, paddingVertical: 4 },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4A64A' },

  addTermCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: 14, marginTop: 16, ...SHADOW.level1 },

  saveAllBtn: { backgroundColor: EMERALD, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
});
