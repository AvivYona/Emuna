import React from "react";
import { Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import { useShabbatRestriction } from "../context/ShabbatContext";

const appIcon = require("../../assets/icon.png");

type ShabbatRestrictionScreenProps = {
  loading: boolean;
};

export const ShabbatRestrictionScreen: React.FC<
  ShabbatRestrictionScreenProps
> = ({ loading }) => {
  const { restriction, refresh } = useShabbatRestriction();

  const title =
    restriction?.reason === "yomtov" ? restriction.title : "שבת שלום";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image source={appIcon} style={styles.icon} resizeMode="contain" />
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.subheading}>
          האפליקציה אינה זמינה כעת בשבתות ובמועדי ישראל.
        </Text>
        <Text style={styles.description}>
          מוזמנים לחזור אלינו בצאת השבת או החג. ניתן לבדוק את הסטטוס מאוחר יותר.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subheading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.lg,
    width: "100%",
  },
});
