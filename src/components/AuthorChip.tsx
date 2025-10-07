import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, palette, spacing } from '../theme';

type Props = {
  name: string;
  selected: boolean;
  onToggle: () => void;
};

export const AuthorChip: React.FC<Props> = ({ name, selected, onToggle }) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{name}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    margin: spacing.sm,
    borderWidth: 1,
    borderColor: palette.glassBorder,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  unselected: {
    backgroundColor: palette.glassOverlay,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  selectedLabel: {
    color: colors.background,
    fontWeight: '600',
  },
});
