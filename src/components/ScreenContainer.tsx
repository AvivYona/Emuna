import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View, ViewProps } from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  withScroll?: boolean;
  avoidKeyboard?: boolean;
} & ViewProps;

export const ScreenContainer: React.FC<Props> = ({
  children,
  withScroll = true,
  avoidKeyboard = true,
  style,
  ...rest
}) => {
  const content = withScroll ? (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
      {children}
    </ScrollView>
  ) : (
    children
  );
  return (
    <View style={[styles.root, style]} {...rest}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.avoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={64}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.avoiding}>{content}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    direction: 'rtl',
    writingDirection: 'rtl',
  },
  avoiding: {
    flex: 1,
  },
  scrollView: {
    direction: 'rtl',
    writingDirection: 'rtl',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    direction: 'rtl',
    writingDirection: 'rtl',
  },
});
