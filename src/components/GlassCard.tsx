import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { palette, spacing } from '../theme';

type Props = ViewProps & {
  intensity?: number;
  children: React.ReactNode;
};

export const GlassCard: React.FC<Props> = ({ intensity = 50, style, children, ...rest }) => {
  return (
    <View style={styles.wrapper} {...rest}>
      <BlurView intensity={intensity} tint="light" style={[styles.blur, style]}>
        <View style={styles.inner}>{children}</View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: spacing.lg,
    overflow: 'hidden',
    marginVertical: spacing.md,
  },
  blur: {
    backgroundColor: palette.glassOverlay,
  },
  inner: {
    borderWidth: 1,
    borderColor: palette.glassBorder,
    padding: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    direction: 'rtl',
    writingDirection: 'rtl',
  },
});
