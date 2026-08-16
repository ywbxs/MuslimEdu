import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import UserAvatar from './UserAvatar';
import { buildStudentIdQrPayload } from '../services/studentIdCardService';
import { RADIUS, SHADOW, COLORS } from '../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const BORDER = COLORS.border;
const SURFACE = COLORS.surface;

export interface CardTheme {
  key: string;
  label: string;
  colors: [string, string, ...string[]];
}

// A handful of preset backgrounds rather than a color picker + new backend
// storage - "custom" here means the admin/student picks one of these per
// view/export, not that every school gets a bespoke design pipeline.
export const CARD_THEMES: CardTheme[] = [
  { key: 'emerald', label: 'Emerald', colors: ['#0B3D2E', '#1FAE64', '#1FAE64'] },
  { key: 'gold', label: 'Gold', colors: ['#7C5A0B', '#B8860B', '#D4A64A'] },
  { key: 'ocean', label: 'Ocean', colors: ['#0B2545', '#134E8A', '#2B7FD4'] },
  { key: 'charcoal', label: 'Charcoal', colors: ['#111827', '#1F2937', '#374151'] },
];

export type IdCardPersonType = 'student' | 'staff';

export interface StudentIdCardData {
  name: string;
  nameAr?: string | null;
  photo: string | null;
  code: string;
  personType?: IdCardPersonType;
  className?: string | null;
  sectionName?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  schoolLogoUrl?: string | null;
  dob?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  signatureUrl?: string | null;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/**
 * Portrait ID card - school logo/name/address, a Student/Staff ID Card
 * label, photo, Arabic + English name, code, DOB, address, emergency
 * contact, QR code and a captured digital signature, in that order (per
 * spec). `backgroundImageUrl` (a school's uploaded custom background, see
 * IdCardTemplateScreen/my_school_branding) always wins over `theme` for the
 * header band - the gradient presets are only the fallback for a school
 * that hasn't uploaded one yet. The body stays plain white/light so the
 * many small text fields stay legible regardless of the header art.
 */
export default function StudentIdCard({
  student,
  theme = CARD_THEMES[0],
  backgroundImageUrl,
}: {
  student: StudentIdCardData;
  theme?: CardTheme;
  backgroundImageUrl?: string | null;
}) {
  const classSection = [student.className, student.sectionName].filter(Boolean).join(' - ');
  const label = student.personType === 'staff' ? 'STAFF ID CARD' : 'STUDENT ID CARD';

  const header = (
    <View style={styles.headerInner}>
      <View style={styles.headerTopRow}>
        {student.schoolLogoUrl ? (
          <Image source={{ uri: student.schoolLogoUrl }} style={styles.schoolLogo} resizeMode="contain" />
        ) : null}
        <View style={styles.schoolTextCol}>
          <Text style={styles.schoolName} numberOfLines={1}>{student.schoolName ?? 'School'}</Text>
          {student.schoolAddress ? (
            <Text style={styles.schoolAddress} numberOfLines={2}>{student.schoolAddress}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      {backgroundImageUrl ? (
        <ImageBackground source={{ uri: backgroundImageUrl }} style={styles.headerBand} imageStyle={styles.headerBandImage}>
          <View style={styles.scrim} />
          {header}
        </ImageBackground>
      ) : (
        <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBand}>
          {header}
        </LinearGradient>
      )}

      <View style={styles.avatarWrap}>
        <UserAvatar name={student.name} photo={student.photo} size={84} ringColor="#FFFFFF" dotColor={null} />
      </View>

      <View style={styles.body}>
        {student.nameAr ? (
          <Text style={styles.nameAr} numberOfLines={1}>{student.nameAr}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
        {classSection ? <Text style={styles.meta} numberOfLines={1}>{classSection}</Text> : null}

        <View style={styles.divider} />

        <FieldRow label="ID No" value={student.code} />
        <FieldRow label="Date of Birth" value={student.dob} />
        <FieldRow label="Address" value={student.address} />
        <FieldRow label="Emergency Contact" value={student.emergencyContactName} />
        <FieldRow label="Emergency Phone" value={student.emergencyContactPhone} />

        <View style={styles.footerRow}>
          <View style={styles.qrWrap}>
            <QRCode value={buildStudentIdQrPayload(student.code)} size={64} backgroundColor="#FFFFFF" color="#111827" />
          </View>

          <View style={styles.signatureCol}>
            {student.signatureUrl ? (
              <Image source={{ uri: student.signatureUrl }} style={styles.signatureImg} resizeMode="contain" />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Signature</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const HEADER_HEIGHT = 96;

const styles = StyleSheet.create({
  card: {
    width: 320,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    ...SHADOW.level3,
  },
  headerBand: { height: HEADER_HEIGHT, paddingTop: 14 },
  headerBandImage: {},
  headerInner: { flex: 1, paddingHorizontal: 16 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,13,16,0.45)' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  schoolLogo: { width: 28, height: 28, borderRadius: 6, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.9)' },
  schoolTextCol: { flex: 1 },
  schoolName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  schoolAddress: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 1 },
  cardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, marginTop: 8 },

  avatarWrap: { alignSelf: 'center', marginTop: -42, marginBottom: 4 },

  body: { paddingHorizontal: 18, paddingBottom: 18, alignItems: 'center' },
  nameAr: { color: INK, fontSize: 17, fontWeight: '800', writingDirection: 'rtl', marginTop: 2 },
  name: { color: INK, fontSize: 16, fontWeight: '700', marginTop: 2 },
  meta: { color: SUBTLE, fontSize: 12.5, marginTop: 2 },

  divider: { alignSelf: 'stretch', height: 1, backgroundColor: BORDER, marginVertical: 10 },

  fieldRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel: { color: SUBTLE, fontSize: 11.5, fontWeight: '600' },
  fieldValue: { color: INK, fontSize: 12.5, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  footerRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  qrWrap: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: BORDER },

  signatureCol: { alignItems: 'center', width: 120 },
  signatureImg: { width: 100, height: 34 },
  signaturePlaceholder: { width: 100, height: 34 },
  signatureLine: { width: 100, height: 1, backgroundColor: BORDER, marginTop: 2 },
  signatureCaption: { color: SUBTLE, fontSize: 9.5, marginTop: 3, fontWeight: '600' },
});
