import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { md3 } from '../theme';
import { useLocale } from '../../../../context/LocaleContext';

export interface ChipOption {
  id: number;
  name: string;
}

export default function ChipGroup({
  label,
  options,
  selectedId,
  onSelect,
  required,
  error,
  emptyHint,
}: {
  label: string;
  options: ChipOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  required?: boolean;
  error?: string | null;
  emptyHint?: string;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, error && styles.labelError]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {options.length === 0 ? (
        <Text style={styles.emptyHint}>{emptyHint ?? t('chip_group.none_available', 'None available yet.')}</Text>
      ) : (
        <View style={styles.row}>
          {options.map((opt) => {
            const active = selectedId === String(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelect(String(opt.id))}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: {
    fontSize: md3.type.labelMedium.fontSize,
    fontWeight: md3.type.labelMedium.fontWeight,
    color: md3.color.onSurfaceVariant,
    marginBottom: 8,
  },
  labelError: { color: md3.color.error },
  required: { color: md3.color.error },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: md3.shape.full,
    backgroundColor: md3.color.surfaceContainerLow,
    borderWidth: 1,
    borderColor: md3.color.outlineVariant,
  },
  chipActive: {
    backgroundColor: md3.color.primaryContainer,
    borderColor: md3.color.primary,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: md3.color.onSurfaceVariant },
  chipTextActive: { color: md3.color.onPrimaryContainer },
  emptyHint: { fontSize: 13, color: md3.color.onSurfaceVariant, lineHeight: 18 },
  errorText: { fontSize: 13, color: md3.color.error, marginTop: 6 },
});
