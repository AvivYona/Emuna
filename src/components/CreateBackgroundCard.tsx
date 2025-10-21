import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
  onPress: () => void;
};

export const CreateBackgroundCard: React.FC<Props> = ({ onPress }) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.label}>לחץ כאן ליצור רקע אישי״</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: spacing.sm,
    borderRadius: spacing.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.accent,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.9,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  label: {
    textAlign: "center",
    color: colors.accent,
    fontSize: 18,
    fontWeight: "600",
  },
});
