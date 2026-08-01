import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

export interface StudentIdCardData {
  name: string;
  photo: string | null;
  code: string;
  className?: string | null;
  sectionName?: string | null;
  schoolName?: string | null;
}

export default function StudentIdCard({
  student,
  theme = CARD_THEMES[0],
}: {
  student: StudentIdCardData;
  theme?: CardTheme;
}) {
  const classSection = [student.className, student.sectionName].filter(Boolean).join(' - ');

  return (
    <LinearGradient
      colors={theme.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.schoolName} numberOfLines={1}>{student.schoolName ?? 'Student ID'}</Text>
        <Text style={styles.cardKicker}>ID CARD</Text>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.identityCol}>
          <UserAvatar name={student.name} photo={student.photo} size={64} ringColor="rgba(255,255,255,0.55)" dotColor={null} />
          <Text style={styles.name} numberOfLines={2}>{student.name}</Text>
          {classSection ? <Text style={styles.meta} numberOfLines={1}>{classSection}</Text> : null}
          <Text style={styles.code} numberOfLines={1}>{student.code}</Text>
        </View>

        <View style={styles.qrWrap}>
          <QRCode value={buildStudentIdQrPayload(student.code)} size={84} backgroundColor="#FFFFFF" color="#111827" />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 190,
    borderRadius: RADIUS.lg,
    padding: 18,
    justifyContent: 'space-between',
    ...SHADOW.level3,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  schoolName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flexShrink: 1, marginRight: 8 },
  cardKicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },

  bodyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  identityCol: { flex: 1, marginRight: 12 },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 10 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  code: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '700', marginTop: 8, letterSpacing: 0.5 },

  qrWrap: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8 },
});
