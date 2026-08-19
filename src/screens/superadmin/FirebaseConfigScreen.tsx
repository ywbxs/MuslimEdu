import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  fetchFirebaseConfig,
  saveFirebaseConfig,
  sendTestNotification,
  FirebaseConfig,
} from '../../services/firebaseConfigService';
import { Skeleton } from '../../components/Skeleton';
import { GLASS, COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

/** Superadmin-only: configures the backend's Firebase Admin SDK credentials used to send real push notifications. */
export default function FirebaseConfigScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [config, setConfig] = useState<FirebaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState('');
  const [senderId, setSenderId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchFirebaseConfig(token);
      setConfig(data);
      setProjectId(data.project_id);
      setSenderId(data.sender_id);
    } catch (err) {
      // Backend route may not exist yet - the form still works for entering
      // and saving values once it does; this just means "not configured
      // yet" instead of showing whatever was last saved.
      setConfig({ configured: false, project_id: '', sender_id: '', updated_at: null });
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSave = async () => {
    if (!token) return;
    if (!projectId.trim() || !senderId.trim() || !serviceAccountJson.trim()) {
      Alert.alert('Missing fields', 'Project ID, Sender ID, and the service account JSON are all required.');
      return;
    }
    try {
      JSON.parse(serviceAccountJson);
    } catch {
      Alert.alert('Invalid JSON', 'The service account key must be valid JSON, copied exactly from the Firebase console.');
      return;
    }
    setSaving(true);
    try {
      const data = await saveFirebaseConfig(token, {
        project_id: projectId.trim(),
        sender_id: senderId.trim(),
        service_account_json: serviceAccountJson.trim(),
      });
      setConfig(data);
      setServiceAccountJson('');
      Alert.alert('Saved', 'Firebase credentials updated. Send a test notification below to confirm they work.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token) return;
    setTesting(true);
    try {
      const sent = await sendTestNotification(token, 'Test notification', 'Firebase push is configured correctly.');
      Alert.alert(sent > 0 ? 'Sent' : 'No devices', sent > 0 ? `Delivered to ${sent} of your registered device(s).` : 'No devices are registered for push yet on this account.');
    } catch (err) {
      Alert.alert('Could not send test', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Firebase Configuration</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <Skeleton width="100%" height={200} borderRadius={RADIUS.lg} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What this configures</Text>
            <Text style={styles.infoBody}>
              This is the server-side credential the backend uses to actually send push notifications through
              Firebase (Admin SDK, HTTP v1 API). It does not change the client app's own Firebase project file
              (google-services.json) - that's baked into the APK at build time by a developer; see the
              android-config/README.md notes shipped with the app for how that gets updated.
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config?.configured ? EMERALD : SUBTLE }]} />
            <Text style={styles.statusText}>
              {config?.configured ? 'Configured' : 'Not configured yet'}
              {config?.updated_at ? ` · updated ${new Date(config.updated_at).toLocaleDateString()}` : ''}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Project ID</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. muslimedu-12345"
            placeholderTextColor={SUBTLE}
            value={projectId}
            onChangeText={setProjectId}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Sender ID</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="From Firebase console -> Project settings -> Cloud Messaging"
            placeholderTextColor={SUBTLE}
            value={senderId}
            onChangeText={setSenderId}
            autoCapitalize="none"
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Service account JSON</Text>
          <Text style={styles.fieldHint}>
            Firebase console &gt; Project settings &gt; Service accounts &gt; Generate new private key. Paste the
            full downloaded JSON file's contents here.
          </Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputMulti]}
            placeholder='{ "type": "service_account", ... }'
            placeholderTextColor={SUBTLE}
            value={serviceAccountJson}
            onChangeText={setServiceAccountJson}
            multiline
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={[styles.submitButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Save credentials</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, (testing || !config?.configured) && { opacity: 0.5 }]}
            onPress={handleTest}
            disabled={testing || !config?.configured}
          >
            {testing ? <ActivityIndicator color={EMERALD} /> : <Text style={styles.testButtonText}>Send test notification to me</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },

  listContent: { padding: 16, paddingBottom: 60 },

  infoCard: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 13.5, fontWeight: '700', color: INK, marginBottom: 6 },
  infoBody: { fontSize: 12.5, color: SUBTLE, lineHeight: 18 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '600', color: INK },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 11.5, color: SUBTLE, marginBottom: 8 },
  fieldInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    color: INK,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  fieldInputMulti: { height: 160, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12.5 },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    ...SHADOW.level1,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  testButton: {
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: EMERALD,
  },
  testButtonText: { color: EMERALD, fontWeight: '700', fontSize: 14 },
});
