import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

export const PrimaryButton: React.FC<Props> = ({ label, onPress, disabled, loading, variant = 'primary', style }) => {
  const isSecondary = variant === 'secondary';
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      stiffness: 320,
      damping: 22,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    if (disabled || loading) return;
    animateScale(0.96);
  };

  const handlePressOut = () => {
    animateScale(1);
  };

  const indicatorColor = isSecondary ? colors.textPrimary : colors.background;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.touchable,
        pressed && !disabled && !loading ? styles.touchablePressed : null,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.button,
          isSecondary ? styles.secondary : styles.primary,
          disabled ? styles.disabled : null,
          { transform: [{ scale }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={indicatorColor} />
        ) : (
          <Text style={[styles.label, isSecondary ? styles.labelSecondary : styles.labelPrimary]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    marginVertical: spacing.sm,
    borderRadius: spacing.lg,
  },
  touchablePressed: {
    transform: [{ translateY: 1 }],
  },
  button: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.accentSoft,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  labelPrimary: {
    color: colors.background,
  },
  labelSecondary: {
    color: colors.textPrimary,
  },
});
