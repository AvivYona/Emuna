import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Background } from "../api/types";
import { colors, spacing } from "../theme";

type Props = {
  item: Background;
  selected: boolean;
  onSelect: () => void;
  loading?: boolean;
};

export const BackgroundCard: React.FC<Props> = ({
  item,
  selected,
  onSelect,
  loading = false,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.pressed : null,
        selected ? styles.selected : null,
        loading ? styles.disabled : null,
      ]}
    >
      <ImageBackground
        source={{ uri: item.thumbnailUrl ?? item.imageUrl }}
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        {selected ? (
          <View pointerEvents="none" style={styles.selectedOverlay} />
        ) : null}
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.background} />
          </View>
        ) : null}
      </ImageBackground>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: spacing.sm,
    borderRadius: spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.divider,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.65,
  },
  image: {
    flex: 1,
    justifyContent: "space-between",
  },
  imageRadius: {
    borderRadius: spacing.lg,
  },
  selectedOverlay: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
    left: spacing.xs,
    borderRadius: spacing.lg,
    borderColor: colors.accent,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(58, 32, 22, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
