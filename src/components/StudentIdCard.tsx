import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import UserAvatar from './UserAvatar';
import { buildStudentIdQrPayload } from '../services/studentIdCardService';
import { RADIUS, SHADOW } from '../theme/glass';

export interface CardTheme {
  key: string;
  label: string;
  colors: [string, string, ...string[]];
}

// A handful of preset backgrounds rather than a color picker + new backend
// storage - "custom" here means the admin/student picks one of these per
// view/export, not that every school gets a bespoke design pipeline.
export const CARD_THEMES: CardTheme[] = [
  { key: 'emerald', label: 'Emerald', colors: ['#0B3D2E', '#0F9D58', '#22C55E'] },
  { key: 'gold', label: 'Gold', colors: ['#7C5A0B', '#B8860B', '#D4A64A'] },
  { key: 'ocean', label: 'Ocean', colors: ['#0B2545', '#134E8A', '#2B7FD4'] },
  { key: 'charcoal', label: 'Charcoal', colors: ['#111827', '#1F2937', '#374151'] },
];

export type IdCardType = 'student' | 'staff';

export interface StudentIdCardData {
  name: string;
  photo: string | null;
  code: string;
  className?: string | null;
  sectionName?: string | null;
  schoolName?: string | null;
  // --- Real-ID-card fields (all optional - the card renders a clean
  // layout with just name/photo/code when a field isn't available yet,
  // and shows the extra row the moment the backend/profile has it). ---
  schoolLogoUrl?: string | null;
  schoolAddress?: string | null;
  cardType?: IdCardType; // 'student' (default) or 'staff' - drives the label
  arabicName?: string | null;
  dateOfBirth?: string | null; // 'YYYY-MM-DD' or any pre-formatted display string
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

function formatDob(value?: string | null): string | null {
  if (!value) return null;
  // Accept 'YYYY-MM-DD' (or a timestamp prefixed with it) and render it
  // human-readable; anything else not matching that shape is shown as-is
  // rather than risking an "Invalid Date" label on the card.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/**
 * `backgroundImageUrl` (a school's uploaded custom background, see
 * IdCardTemplateScreen/my_school_branding) always wins over `theme` - the
 * gradient presets are only the fallback for a school that hasn't
 * uploaded one yet. A dark scrim sits between the image and the content
 * so the card content stays readable regardless of what the uploaded
 * image looks like.
 *
 * Portrait, wallet-style layout modeled on a real physical school ID:
 * school header (logo/name/address) → card-type label → photo →
 * Arabic name → English name → ID rows (code/DOB/address/emergency
 * contact) → signature line, with the QR code tucked in the header for
 * scanning. Every field below the header is optional and simply omitted
 * from the layout when the caller doesn't have that data yet.
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
  const cardType: IdCardType = student.cardType ?? 'student';
  const dob = formatDob(student.dateOfBirth);
  const hasEmergencyContact = !!(student.emergencyContactName || student.emergencyContactPhone);

  const content = (
    <>
      <View style={styles.header}>
        {student.schoolLogoUrl ? (
          <Image source={{ uri: student.schoolLogoUrl }} style={styles.schoolLogo} />
        ) : (
          <View style={styles.schoolLogoPlaceholder}>
            <Text style={styles.schoolLogoPlaceholderText}>{(student.schoolName ?? 'S').trim().charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.schoolTextCol}>
          <Text style={styles.schoolName} numberOfLines={1}>{student.schoolName ?? 'School'}</Text>
          {student.schoolAddress ? (
            <Text style={styles.schoolAddress} numberOfLines={2}>{student.schoolAddress}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.kickerWrap}>
        <Text style={styles.cardKicker}>{cardType === 'staff' ? 'STAFF ID CARD' : 'STUDENT ID CARD'}</Text>
      </View>

      <View style={styles.photoRow}>
        <UserAvatar name={student.name} photo={student.photo} size={92} ringColor="rgba(255,255,255,0.7)" dotColor={null} />
      </View>

      <View style={styles.nameCol}>
        {student.arabicName ? (
          <Text style={styles.arabicName} numberOfLines={1}>{student.arabicName}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
        {classSection ? <Text style={styles.meta} numberOfLines={1}>{classSection}</Text> : null}
      </View>

      <View style={styles.infoCard}>
        <CardRow label={cardType === 'staff' ? 'Staff ID' : 'Student ID'} value={student.code} />
        {dob ? <CardRow label="Date of Birth" value={dob} /> : null}
        {student.address ? <CardRow label="Address" value={student.address} /> : null}
        {hasEmergencyContact ? (
          <CardRow
            label="Emergency Contact"
            value={[student.emergencyContactName, student.emergencyContactPhone].filter(Boolean).join(' · ')}
          />
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.signatureCol}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>{cardType === 'staff' ? 'Staff Signature' : 'Student Signature'}</Text>
        </View>
        <View style={styles.qrWrap}>
          <QRCode value={buildStudentIdQrPayload(student.code)} size={56} backgroundColor="#FFFFFF" color="#111827" />
        </View>
      </View>
    </>
  );

  if (backgroundImageUrl) {
    return (
      <ImageBackground source={{ uri: backgroundImageUrl }} style={styles.card} imageStyle={styles.cardImage}>
        <View style={styles.scrim} />
        <View style={styles.cardInner}>{content}</View>
      </ImageBackground>
    );
  }

  return (
    <LinearGradient
      colors={theme.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.cardInner}>{content}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.level3,
  },
  cardImage: { borderRadius: RADIUS.lg },
  cardInner: { padding: 18 },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,16,0.5)',
  },

  header: { flexDirection: 'row', alignItems: 'center' },
  schoolLogo: { width: 36, height: 36, borderRadius: 8, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  schoolLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolLogoPlaceholderText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  schoolTextCol: { flex: 1 },
  schoolName: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  schoolAddress: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2, lineHeight: 13 },

  kickerWrap: { alignItems: 'center', marginTop: 14, marginBottom: 8 },
  cardKicker: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  photoRow: { alignItems: 'center', marginBottom: 10 },

  nameCol: { alignItems: 'center', marginBottom: 14 },
  arabicName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  rowLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowValue: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', marginLeft: 10, flexShrink: 1, textAlign: 'right' },

  footerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  signatureCol: { flex: 1, marginRight: 12 },
  signatureLine: { borderBottomWidth: 1.4, borderBottomColor: 'rgba(255,255,255,0.65)', marginBottom: 4, height: 30 },
  signatureLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 },
  qrWrap: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 6 },
});
