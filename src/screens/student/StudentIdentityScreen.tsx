import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import { fetchStudentIdentity, StudentIdentity } from '../../services/studentIdentityService';

export default function StudentIdentityScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();
  const [identity, setIdentity] = useState<StudentIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try { setIdentity(await fetchStudentIdentity(token)); }
    catch (e: any) { setError(e?.message ?? t('student_identity.load_error', 'Could not load your student ID.')); }
    finally { setLoading(false); }
  }, [token, t]);

  useEffect(() => { load(); }, [load]);

  const shareIdentity = async () => {
    if (!identity) return;
    await Share.share({ message: `${identity.name}\n${t('student_identity.student_number_label', 'Student number')}: ${identity.student_number ?? t('student_identity.not_assigned', 'Not assigned')}\n${identity.school.name ?? 'MuslimEdu'}` });
  };

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={EMERALD} /><Text style={styles.muted}>{t('student_identity.loading', 'Loading your student ID…')}</Text></View>;
  if (error || !identity) return <View style={[styles.center, { paddingTop: insets.top }]}><Text style={styles.errorTitle}>{t('student_identity.unavailable_title', 'Student ID unavailable')}</Text><Text style={styles.muted}>{error ?? t('student_identity.no_record', 'No identity record was returned.')}</Text><TouchableOpacity onPress={load} style={styles.retry}><Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text></TouchableOpacity></View>;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View><Text style={styles.title}>{t('student_identity.title', 'My Student ID')}</Text><Text style={styles.subtitle}>{t('student_identity.subtitle', 'Your official school identity')}</Text></View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.idCard}>
          <View style={styles.cardTop}>
            {identity.school.logo ? <Image source={{ uri: identity.school.logo }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoText}>M</Text></View>}
            <View style={styles.schoolText}><Text style={styles.schoolName}>{identity.school.name ?? 'MuslimEdu'}</Text><Text style={styles.cardCaption}>{t('student_identity.card_caption', 'STUDENT IDENTITY CARD')}</Text></View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.profileRow}>
            {identity.photo ? <Image source={{ uri: identity.photo }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{identity.name.slice(0, 1).toUpperCase()}</Text></View>}
            <View style={styles.profileText}><Text style={styles.name}>{identity.name}</Text><Text style={styles.number}>{identity.student_number ?? t('student_identity.number_pending', 'Number pending')}</Text></View>
          </View>
          <View style={styles.cardDivider} />
          <IdentityRow label={t('student_identity.program', 'Program')} value={identity.academic.program} />
          <IdentityRow label={t('student_identity.class_section', 'Class / Section')} value={[identity.academic.class_name, identity.academic.section].filter(Boolean).join(' / ')} />
          <IdentityRow label={t('student_identity.academic_year', 'Academic year')} value={identity.academic.academic_year} />
          <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>{identity.academic.status ?? t('student_identity.active_student', 'Active student')}</Text></View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('student_identity.student_number_label', 'Student number')}</Text>
          <Text style={styles.bigNumber}>{identity.student_number ?? t('student_identity.not_assigned_yet', 'Not assigned yet')}</Text>
          <Text style={styles.muted}>{t('student_identity.number_note', 'This number is assigned by your school and cannot be edited from the app.')}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('student_identity.digital_identity', 'Digital identity')}</Text>
          <Text style={styles.muted}>{t('student_identity.digital_identity_note', 'Your school can use this identity payload for QR or ID verification. The app does not invent a scannable QR code when the backend has not enabled one.')}</Text>
          <View style={styles.payload}><Text style={styles.payloadLabel}>{t('student_identity.verification_payload', 'VERIFICATION PAYLOAD')}</Text><Text style={styles.payloadText} numberOfLines={3}>{identity.qr_payload}</Text></View>
          {!identity.qr_available ? <Text style={styles.pending}>{t('student_identity.qr_pending', 'QR display will appear once QR verification is enabled by the school.')}</Text> : null}
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={shareIdentity}><Text style={styles.shareText}>{t('student_identity.share_button', 'Share student details')}</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function IdentityRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <View style={styles.identityRow}><Text style={styles.identityLabel}>{label}</Text><Text style={styles.identityValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F7F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#F5F7F6' },
  muted: { color: SUBTLE, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  errorTitle: { color: INK, fontWeight: '800', fontSize: 19 },
  retry: { backgroundColor: EMERALD, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 18 },
  retryText: { color: '#FFF', fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8E4' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: EMERALD_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backText: { color: EMERALD, fontSize: 28, lineHeight: 30, marginTop: -3 },
  title: { color: INK, fontSize: 20, fontWeight: '800' },
  subtitle: { color: SUBTLE, fontSize: 12.5, marginTop: 2 },
  content: { padding: 16 },
  idCard: { backgroundColor: '#123D2B', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF' },
  logoFallback: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: EMERALD, fontSize: 22, fontWeight: '900' },
  schoolText: { flex: 1, marginLeft: 12 },
  schoolName: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cardCaption: { color: '#A9E2BE', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#FFF' },
  avatarFallback: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#A9E2BE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#123D2B', fontSize: 28, fontWeight: '900' },
  profileText: { flex: 1, marginLeft: 14 },
  name: { color: '#FFF', fontSize: 21, fontWeight: '800' },
  number: { color: '#A9E2BE', fontSize: 14, fontWeight: '800', marginTop: 7, letterSpacing: 0.7 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  identityLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  identityValue: { color: '#FFF', fontSize: 13, fontWeight: '700', maxWidth: '62%', textAlign: 'right' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(169,226,190,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A9E2BE', marginRight: 7 },
  statusText: { color: '#A9E2BE', fontSize: 11, fontWeight: '800' },
  infoCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 17, marginTop: 14, borderWidth: 1, borderColor: '#E2E8E4' },
  sectionTitle: { color: SUBTLE, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  bigNumber: { color: INK, fontSize: 25, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  payload: { backgroundColor: '#F3F6F4', borderRadius: 12, padding: 12, marginTop: 14 },
  payloadLabel: { color: SUBTLE, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  payloadText: { color: INK, fontSize: 11, lineHeight: 16, marginTop: 7, fontFamily: 'monospace' },
  pending: { color: '#8A6A00', fontSize: 12, lineHeight: 17, marginTop: 12 },
  shareButton: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  shareText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
