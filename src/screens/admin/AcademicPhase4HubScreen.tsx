import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenState } from '../../components/ScreenState';
import { useApiResource } from '../../hooks/useApiResource';
import type {
  Phase4Dashboard,
  Phase4ModuleCard,
} from '../../features/academicPhase4/phase4Types';
import type { Phase4Service } from '../../services/phase4Service';

interface Props {
  phase4: Phase4Service;
  onOpenModule: (module: Phase4ModuleCard) => void;
}

export function AcademicPhase4HubScreen({
  phase4,
  onOpenModule,
}: Props) {
  const resource = useApiResource<Phase4Dashboard>(
    () => phase4.dashboard(),
  );

  return (
    <ScreenState
      result={resource.result}
      loading={resource.loading}
      onRetry={resource.reload}
      emptyTitle="Academic setup unavailable"
      testIDPrefix="academic-phase4"
    >
      {(dashboard) => (
        <FlatList
          contentContainerStyle={styles.content}
          data={dashboard.modules.filter((module) => module.enabled)}
          keyExtractor={(module) => module.key}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Academic platform</Text>
              <Text style={styles.subtitle}>
                Setup and operations, driven by your school configuration.
              </Text>

              {dashboard.setupRequired ? (
                <TouchableOpacity
                  style={styles.setup}
                  onPress={() =>
                    onOpenModule({
                      key: 'setup-wizard',
                      title: 'Setup wizard',
                      description: 'Complete setup',
                      enabled: true,
                      routeName: 'admin_academic_setup_show',
                    })
                  }
                >
                  <Text style={styles.setupText}>Finish setup</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onOpenModule(item)}
              accessibilityRole="button"
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>
                {item.description}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenState>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  setup: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#14532d',
  },
  setupText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
});
