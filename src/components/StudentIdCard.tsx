import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import UserAvatar from './UserAvatar';
import { buildStudentIdQrPayload } from '../services/studentIdCardService';
import { RADIUS, SHADOW, COLORS, BRAND } from '../theme/glass';

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

function FieldRow({ label, value, isLast }: { label: string; value?: string | null; isLast?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/**
 * Portrait ID card - school logo/name/address, a Student/Staff ID Card
 * badge, photo, Arabic + English name, code, DOB, address, emergency
 * contact, QR code and a captured digital signature, in that order (per
 * spec). `backgroundImageUrl` (a school's uploaded custom background, see
 * IdCardTemplateScreen/my_school_branding) always wins over `theme` for the
 * header band - the gradient presets are only the fallback for a school
 * that hasn't uploaded one yet. The body stays plain white/light so the
 * many small text fields stay legible regardless of the header art.
 *
 * A fixed, genuinely portrait width (was width-only, no ratio - the card
 * read almost square once only a couple of fields were populated, since
 * height was purely whatever the sparse content added up to) plus a
 * bordered/divided info panel replacing loosely-spaced rows keeps the
 * proportions looking like an actual ID badge instead of a stretched form,
 * regardless of how many optional fields a given person/staff row has.
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
  const fields = [
    { label: 'Date of Birth', value: student.dob },
    { label: 'Address', value: student.address },
    { label: 'Emergency Contact', value: student.emergencyContactName },
    { label: 'Emergency Phone', value: student.emergencyContactPhone },
  ].filter((f) => !!f.value);

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
      <View style={styles.cardLabelBadge}>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
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
        <UserAvatar name={student.name} photo={student.photo} size={80} ringColor="#FFFFFF" dotColor={null} />
      </View>

      <View style={styles.body}>
        {student.nameAr ? (
          <Text style={styles.nameAr} numberOfLines={1}>{student.nameAr}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>{student.name}</Text>
        {classSection ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText} numberOfLines={1}>{classSection}</Text>
          </View>
        ) : null}

        <View style={styles.infoPanel}>
          <FieldRow label="ID No" value={student.code} isLast={fields.length === 0} />
          {fields.map((f, i) => (
            <FieldRow key={f.label} label={f.label} value={f.value} isLast={i === fields.length - 1} />
          ))}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.qrWrap}>
            <QRCode value={buildStudentIdQrPayload(student.code)} size={70} backgroundColor="#FFFFFF" color="#111827" />
          </View>

          <View style={styles.signatureCol}>
            <View style={styles.signatureBox}>
              {student.signatureUrl ? (
                <Image source={{ uri: student.signatureUrl }} style={styles.signatureImg} resizeMode="contain" />
              ) : null}
            </View>
            <Text style={styles.signatureCaption}>Signature</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const HEADER_HEIGHT = 100;

const styles = StyleSheet.create({
  card: {
    // Narrower than before (was 320 with no ratio target) - a real ID
    // badge reads taller than wide; combined with the tightened body
    // below, this keeps the card portrait-proportioned even for a staff
    // row with only one or two fields filled in.
    width: 288,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    ...SHADOW.level3,
  },
  headerBand: { height: HEADER_HEIGHT, paddingTop: 16 },
  headerBandImage: {},
  headerInner: { flex: 1, paddingHorizontal: 16 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,13,16,0.45)' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  schoolLogo: { width: 26, height: 26, borderRadius: 6, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.9)' },
  schoolTextCol: { flex: 1 },
  schoolName: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  schoolAddress: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 1 },
  cardLabelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  cardLabel: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1 },

  avatarWrap: { alignSelf: 'center', marginTop: -40, marginBottom: 6 },

  body: { paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  nameAr: { color: INK, fontSize: 16, fontWeight: '800', writingDirection: 'rtl', marginTop: 2 },
  name: { color: INK, fontSize: 15, fontWeight: '700', marginTop: 2 },
  metaPill: {
    backgroundColor: COLORS.emeraldSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  metaPillText: { color: BRAND.emeraldDeep, fontSize: 11, fontWeight: '700' },

  // A single bordered/divided panel replaces the old plain rows - tight
  // rhythm regardless of how many optional fields are populated, instead
  // of leaving a growing gap of dead space for staff/students with fewer
  // fields on file.
  infoPanel: {
    alignSelf: 'stretch',
    backgroundColor: '#FAFBFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: RADIUS.sm,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabel: { color: SUBTLE, fontSize: 11, fontWeight: '600' },
  fieldValue: { color: INK, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  footerRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  qrWrap: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.sm, padding: 6, borderWidth: 1, borderColor: BORDER },

  signatureCol: { alignItems: 'center', width: 116 },
  signatureBox: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: '#FAFBFA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  signatureImg: { width: '90%', height: '80%' },
  signatureCaption: { color: SUBTLE, fontSize: 9.5, marginTop: 4, fontWeight: '600' },
});
