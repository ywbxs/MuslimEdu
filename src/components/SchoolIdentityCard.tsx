import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { School as SchoolGlyph, Pencil } from 'lucide-react-native';
import { fetchSetupStatus, SchoolProfile } from '../services/academicSetupService';
import { Skeleton } from './Skeleton';

const PALE_GREEN = '#7FD9A8';
// Same faux-glass values AnalyticsCard/MonthlyReportsCard use, so this reads
// as the same "glass on dark green" card family.
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

function PencilIcon({ color }: { color: string }) {
  return <Pencil color={color} size={15} strokeWidth={1.8} />;
}

function schoolInitials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Standalone school identity card - logo, name, address, and an edit
 * shortcut to InstitutionProfileScreen. AnalyticsCard shows this same strip
 * at its own top, but AnalyticsCard is hidden entirely for orphan schools
 * (they have no class-based academic data for the rest of that card), which
 * meant orphan admins had no way to see or edit their school's name/address/
 * logo from the dashboard at all. Pulled out standalone so both the orphan
 * (paired with MonthlyReportsCard) and non-orphan dashboards can show it.
 */
export default function SchoolIdentityCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchSetupStatus(token)
      .then((status) => {
        if (!cancelled) setSchool(status.school);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const editSchoolProfile = () => (navigation as any).navigate('InstitutionProfile');

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Skeleton width={40} height={40} style={{ borderRadius: 12 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="60%" height={14} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="40%" height={11} style={{ borderRadius: 4 }} />
          </View>
        </View>
      </View>
    );
  }

  // Nothing to show or edit if the school profile itself never loaded -
  // fails silently rather than showing a broken/empty card.
  if (!school) return null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {school.logo ? (
          <Image source={{ uri: school.logo }} style={styles.logo} />
        ) : (
          <View style={styles.logoFallback}>
            {school.name ? (
              <Text style={styles.initials}>{schoolInitials(school.name)}</Text>
            ) : (
              <SchoolGlyph color={PALE_GREEN} size={18} strokeWidth={1.8} />
            )}
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={1}>
            {school.name ?? 'Your school'}
          </Text>
          {school.address ? (
            <Text style={styles.address} numberOfLines={1}>
              {school.address}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={editSchoolProfile}
          hitSlop={10}
          android_ripple={{ color: 'rgba(255,255,255,0.15)', radius: 18 }}
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
        >
          <PencilIcon color={PALE_GREEN} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: PALE_GREEN, fontSize: 14, fontWeight: '800' },
  name: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  address: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
