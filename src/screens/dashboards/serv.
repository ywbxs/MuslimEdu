import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import DashboardShell, { EMERALD, INK, SUBTLE } from './DashboardShell';

// Menu items for things an admin manages.
// "route" is the screen name to navigate to; "params" are passed along.
// Items without a route yet show as inert - Phase 6+ will wire those up.
//
// Note: there's no separate "Orphan Students" entry. Orphan status is set
// per-school (school_type = 'orphanage'), not per-child, so an orphanage
// admin's "Students" list already only ever contains orphan children. The
// label below adapts automatically based on the logged-in admin's school.
const MENU_ITEMS = [
  { key: 'students', route: 'StudentsList', params: {} },
  { key: 'teachers', label: 'Teachers', route: null },
  { key: 'classes', label: 'Classes', route: null },
  { key: 'fees', label: 'Fee Reports', route: null },
  { key: 'attendance', label: 'Attendance', route: null },
];

export default function AdminDashboard() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const studentsLabel = user?.is_orphan ? 'Children' : 'Students';

  return (
    <DashboardShell title="Admin">
      <Text style={styles.sectionLabel}>Manage</Text>

      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
              if (item.route) {
                (navigation as any).navigate(item.route, item.params);
              }
            }}
          >
            <Text style={styles.cardText}>
              {item.key === 'students' ? studentsLabel : item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {studentsLabel} is now wired to real data. The rest are
          placeholders - tell me which to build out next.
        </Text>
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 13,
    color: SUBTLE,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cardText: { fontSize: 14, fontWeight: '600', color: INK, textAlign: 'center' },
  noteBox: {
    marginTop: 16,
    backgroundColor: '#EAF7EF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: EMERALD,
  },
  noteText: { fontSize: 13, color: INK, lineHeight: 19 },
});
