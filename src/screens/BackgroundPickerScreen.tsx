import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "../components/ScreenContainer";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import { Background } from "../api/types";
import { getCleanBackgrounds } from "../api/backgrounds";
import {
  BackgroundSelectionParam,
  RootStackParamList,
} from "../navigation/RootNavigator";

type BackgroundPickerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "BackgroundPicker"
>;

type BackgroundOptionProps = {
  background: Background;
  selected: boolean;
  onSelect(): void;
};

const BackgroundOption: React.FC<BackgroundOptionProps> = ({
  background,
  selected,
  onSelect,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.backgroundOption,
        selected ? styles.backgroundOptionSelected : null,
        pressed ? styles.backgroundOptionPressed : null,
      ]}
      onPress={onSelect}
    >
      <Image
        source={{ uri: background.thumbnailUrl ?? background.imageUrl }}
        style={styles.backgroundOptionImage}
      />
    </Pressable>
  );
};

export const BackgroundPickerScreen: React.FC<BackgroundPickerScreenProps> = ({
  navigation,
}) => {
  const [cleanBackgrounds, setCleanBackgrounds] = useState<Background[]>([]);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCleanId, setSelectedCleanId] = useState<string | null>(null);
  const [selection, setSelection] = useState<BackgroundSelectionParam | null>(
    null
  );
  const [importing, setImporting] = useState(false);

  const previewUri = useMemo(() => {
    if (!selection) {
      return null;
    }
    if (selection.type === "clean") {
      return selection.background.imageUrl;
    }
    return selection.uri;
  }, [selection]);

  const loadBackgrounds = useCallback(async () => {
    setLoadingBackgrounds(true);
    try {
      const data = await getCleanBackgrounds();
      setCleanBackgrounds(data);
    } catch (error) {
      console.warn("Failed to load clean backgrounds", error);
    } finally {
      setLoadingBackgrounds(false);
    }
  }, []);

  useEffect(() => {
    void loadBackgrounds();
  }, [loadBackgrounds]);

  const handleConfirmCleanSelection = useCallback(() => {
    if (!selectedCleanId) {
      setModalVisible(false);
      return;
    }
    const background = cleanBackgrounds.find(
      (item) => item._id === selectedCleanId
    );
    if (background) {
      setSelection({ type: "clean", background });
    }
    setModalVisible(false);
  }, [cleanBackgrounds, selectedCleanId]);

  const handleOpenCleanPicker = useCallback(() => {
    if (cleanBackgrounds.length === 0 && !loadingBackgrounds) {
      void loadBackgrounds();
    }
    setModalVisible(true);
  }, [cleanBackgrounds.length, loadBackgrounds, loadingBackgrounds]);

  const handleImportFromLibrary = useCallback(async () => {
    if (importing) {
      return;
    }
    setImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const [asset] = result.assets;
      if (asset?.uri) {
        setSelection({ type: "import", uri: asset.uri });
        setSelectedCleanId(null);
      }
    } catch (error) {
      console.warn("Failed to import custom background", error);
    } finally {
      setImporting(false);
    }
  }, [importing]);

  const handleContinue = useCallback(() => {
    if (!selection) {
      return;
    }
    navigation.navigate("CreateBackground", {
      initialBackground: selection,
    });
  }, [navigation, selection]);

  return (
    <ScreenContainer withScroll>
      <GlassCard style={styles.card}>
        <Text style={styles.heading}>בחרו רקע אישי</Text>
        <Text style={styles.subheading}>
          התחילו בבחירת רקע מוכן מתוך גלריית אמונה או העלו תמונה מהטלפון
        </Text>
        <PrimaryButton
          label="בחרו רקע מאמונה"
          onPress={handleOpenCleanPicker}
        />
        <PrimaryButton
          label="העלו תמונה מהטלפון"
          onPress={handleImportFromLibrary}
          variant="secondary"
          loading={importing}
          disabled={importing}
        />
        <View style={styles.previewBox}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} />
          ) : (
            <></>
          )}
        </View>
        <PrimaryButton
          label="המשיכו לעריכה"
          onPress={handleContinue}
          disabled={!selection}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed ? styles.closeButtonPressed : null,
          ]}
        >
          <Text style={styles.closeButtonLabel}>חזרה לספריית הרקעים</Text>
        </Pressable>
      </GlassCard>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>בחרו רקע נקי</Text>
            {loadingBackgrounds ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={cleanBackgrounds}
                keyExtractor={(item) => item._id}
                numColumns={2}
                columnWrapperStyle={styles.backgroundRow}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <BackgroundOption
                    background={item}
                    selected={selectedCleanId === item._id}
                    onSelect={() => setSelectedCleanId(item._id)}
                  />
                )}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSecondaryButton,
                  pressed ? styles.modalSecondaryButtonPressed : null,
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalSecondaryLabel}>ביטול</Text>
              </Pressable>
              <Pressable
                disabled={!selectedCleanId}
                style={({ pressed }) => [
                  styles.modalPrimaryButton,
                  !selectedCleanId ? styles.modalPrimaryButtonDisabled : null,
                  pressed && selectedCleanId
                    ? styles.modalPrimaryButtonPressed
                    : null,
                ]}
                onPress={handleConfirmCleanSelection}
              >
                <Text
                  style={[
                    styles.modalPrimaryLabel,
                    !selectedCleanId ? styles.modalPrimaryLabelDisabled : null,
                  ]}
                >
                  בחירת הרקע
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subheading: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
  previewBox: {
    alignSelf: "center",
    width: 120,
    aspectRatio: 9 / 19.5,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  closeButton: {
    paddingVertical: spacing.sm,
  },
  closeButtonPressed: {
    opacity: 0.85,
  },
  closeButtonLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  backgroundRow: {
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  backgroundOption: {
    width: 120,
    height: 160,
    borderRadius: spacing.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: spacing.xs,
  },
  backgroundOptionSelected: {
    borderColor: colors.accent,
  },
  backgroundOptionPressed: {
    opacity: 0.8,
  },
  backgroundOptionImage: {
    width: "100%",
    height: "100%",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonPressed: {
    opacity: 0.85,
  },
  modalSecondaryLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalPrimaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: colors.divider,
  },
  modalPrimaryButtonPressed: {
    opacity: 0.9,
  },
  modalPrimaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.background,
  },
  modalPrimaryLabelDisabled: {
    color: colors.textSecondary,
  },
});
