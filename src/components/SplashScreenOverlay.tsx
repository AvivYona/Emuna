import React, { useMemo } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export interface SplashScreenOverlayProps {
  footerText?: string;
}

export const SplashScreenOverlay: React.FC<SplashScreenOverlayProps> = () => {
  const logoSize = useMemo(() => {
    const width = Dimensions.get("window").width;
    return Math.min(width * 0.65, 320);
  }, []);

  return (
    <View style={styles.overlay}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={[styles.logo, { width: logoSize, height: logoSize }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  logo: {
    marginBottom: spacing.lg,
  },
  footer: {
    position: "absolute",
    bottom: spacing.xl,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
  },
});
