import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  message: string;
};

export const EmptyState: React.FC<Props> = ({ message }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  text: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
