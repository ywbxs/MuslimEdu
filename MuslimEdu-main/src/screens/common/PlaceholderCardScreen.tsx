import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';

interface PlaceholderCardScreenProps {
  title: string;
  emoji: string;
  description: string;
}

/**
 * A designed "coming soon" card, used for any tab that doesn't have real
 * functionality wired up yet (Admission, Chat, and Reports for roles that
 * don't have a report feature). Keeps the tab from ever looking blank.
 */
export default function PlaceholderCardScreen({ title, emoji, description }: PlaceholderCardScreenProps) {
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <Text style={styles.cardTitle}>{title} is on the way</Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: INK },
  body: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 100 },
  card: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  emojiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: { fontSize: 28 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 8, textAlign: 'center' },
  cardDescription: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
});
