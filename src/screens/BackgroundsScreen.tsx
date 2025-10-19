import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { ScreenContainer } from "../components/ScreenContainer";
import { GlassCard } from "../components/GlassCard";
import { BackgroundCard } from "../components/BackgroundCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import { Background } from "../api/types";
import { getBackgrounds, getBackgroundDisplayName } from "../api/backgrounds";
import { usePreferences } from "../context/PreferencesContext";
import { formatTime, fromTimeString } from "../utils/time";
import { applyWallpaper } from "../utils/wallpaper";
import {
  BACKGROUND_ASSET_ERRORS,
  ensureBackgroundLocalUri,
  saveBackgroundToCameraRoll,
} from "../utils/backgroundAssets";

const handledNotificationKeys = new Set<string>();

type NotificationResponseWithDate = Notifications.NotificationResponse & {
  date?: number | Date;
};

const getResponseTimestamp = (
  response: Notifications.NotificationResponse
): number | null => {
  const rawDate = (response as NotificationResponseWithDate).date;
  if (typeof rawDate === "number") {
    return rawDate;
  }
  if (rawDate instanceof Date) {
    return rawDate.getTime();
  }
  return null;
};

const createNotificationHandleKey = (
  response: Notifications.NotificationResponse,
  description: string
) => {
  const identifier = response.notification.request.identifier ?? "unknown";
  const responseTimestamp = getResponseTimestamp(response);
  const rawNotificationDate = (response.notification as { date?: unknown })
    .date;
  let notificationTimestamp: number | null = null;
  if (typeof rawNotificationDate === "number") {
    notificationTimestamp = rawNotificationDate;
  } else if (rawNotificationDate instanceof Date) {
    notificationTimestamp = rawNotificationDate.getTime();
  }

  return [
    identifier,
    responseTimestamp ?? notificationTimestamp ?? "no-timestamp",
    description,
  ].join("|");
};

export type BackgroundsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Backgrounds"
>;

type BackgroundTarget = "home" | "lock";

const TARGET_OPTIONS: Array<{ label: string; value: BackgroundTarget }> = [
  { label: "מסך הבית", value: "home" },
  { label: "מסך הנעילה", value: "lock" },
];

export const BackgroundsScreen: React.FC<BackgroundsScreenProps> = ({
  navigation,
}) => {
  const {
    selectedBackground,
    selectedBackgroundTarget,
    setSelectedBackground,
    wantsQuotes,
    setWantsQuotes,
    notificationTime,
    loaded,
  } = usePreferences();
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<Background | null>(
    null
  );
  const [notificationDescription, setNotificationDescription] = useState<
    string | null
  >(null);
  const [target, setTarget] = useState<BackgroundTarget>("home");
  const [loadingAction, setLoadingAction] = useState<
    null | "apply" | "save" | "share"
  >(null);
  const [saveInstructionsVisible, setSaveInstructionsVisible] = useState(false);
  const [saveInstructionsTarget, setSaveInstructionsTarget] =
    useState<BackgroundTarget>("home");

  const isIOS = Platform.OS === "ios";
  const isProcessing = loadingAction !== null;
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const isFocused = useIsFocused();
  const handledNotificationKeyRef = useRef<string | null>(null);
  const focusTimestampRef = useRef<number>(Date.now());

  const loadBackgrounds = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getBackgrounds();
      setBackgrounds(result);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBackgrounds();
  }, [loadBackgrounds]);

  useEffect(() => {
    if (isFocused) {
      focusTimestampRef.current = Date.now();
    }
  }, [isFocused]);

  useEffect(() => {
    if (!wantsQuotes) {
      return;
    }
    if (!isFocused || !lastNotificationResponse) {
      return;
    }

    const { notification, actionIdentifier } = lastNotificationResponse;
    const responseTimestamp = getResponseTimestamp(lastNotificationResponse);
    if (
      responseTimestamp !== null &&
      responseTimestamp <= focusTimestampRef.current
    ) {
      return;
    }
    const description = notification?.request.content.data?.description;
    if (
      actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
      typeof description !== "string"
    ) {
      return;
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0) {
      return;
    }

    const notificationKey = createNotificationHandleKey(
      lastNotificationResponse,
      trimmedDescription
    );

    if (
      handledNotificationKeyRef.current === notificationKey ||
      handledNotificationKeys.has(notificationKey)
    ) {
      return;
    }

    handledNotificationKeys.add(notificationKey);
    handledNotificationKeyRef.current = notificationKey;
    setNotificationDescription(trimmedDescription);
    setPreviewBackground(null);
    setTarget("home");
    setModalVisible(true);
  }, [isFocused, lastNotificationResponse, wantsQuotes]);

  const handleSelectBackground = (background: Background) => {
    const initialTarget: BackgroundTarget =
      selectedBackground === background._id && selectedBackgroundTarget
        ? selectedBackgroundTarget
        : "home";

    setPreviewBackground(background);
    setTarget(initialTarget);
    setModalVisible(true);
  };

  const handleCloseModal = (force = false) => {
    if (isProcessing && !force) {
      return;
    }
    setModalVisible(false);
    setPreviewBackground(null);
    setNotificationDescription(null);
    setTarget("home");
  };

  const handleApplyWallpaper = async () => {
    if (!previewBackground) return;
    if (isIOS) {
      await handleSaveToLibrary();
      return;
    }
    if (loadingAction) return;

    setLoadingAction("apply");
    try {
      await applyWallpaper(previewBackground, target);
      setSelectedBackground(previewBackground._id, target);
      handleCloseModal(true);
      Alert.alert(
        "הרקע עודכן",
        target === "lock"
          ? "הרקע הוחל על מסך הנעילה."
          : "הרקע הוחל על מסך הבית."
      );
    } catch (error) {
      console.warn("Error applying background", error);
      Alert.alert(
        "שגיאה בהגדרת הרקע",
        "לא הצלחנו להחיל את הרקע שבחרת. נסה שוב מאוחר יותר."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!previewBackground) return;
    if (loadingAction) return;

    setLoadingAction("save");
    const backgroundToSave = previewBackground;
    const appliedTarget = target;

    if (isIOS) {
      setSaveInstructionsTarget(appliedTarget);
      setSaveInstructionsVisible(true);
      handleCloseModal(true);
    }

    try {
      await saveBackgroundToCameraRoll(backgroundToSave);
      setSelectedBackground(backgroundToSave._id, appliedTarget);

      if (!isIOS) {
        handleCloseModal(true);
        Alert.alert(
          "הרקע נשמר",
          "הרקע נשמר לאלבום התמונות. ניתן להגדיר אותו כרקע דרך הגדרות המכשיר."
        );
      }
    } catch (error) {
      console.warn("Error saving background", error);

      if (isIOS) {
        setSaveInstructionsVisible(false);
        setPreviewBackground(backgroundToSave);
        setTarget(appliedTarget);
        setModalVisible(true);
      }

      if (error instanceof Error) {
        if (error.message === BACKGROUND_ASSET_ERRORS.permissionDenied) {
          Alert.alert(
            "נדרשת הרשאה",
            "כדי לשמור רקעים, אפשרו לאפליקציית אמונה גישה לתמונות בהגדרות המכשיר."
          );
          return;
        }
        if (error.message === BACKGROUND_ASSET_ERRORS.moduleUnavailable) {
          Alert.alert(
            "דרושה התקנה מלאה",
            "כדי לשמור רקעים, ודאו שהאפליקציה נבנתה עם Expo Media Library (הריצו מחדש את הבנייה המקורית של iOS/Android)."
          );
          return;
        }
      }
      Alert.alert(
        "שגיאה בשמירת הרקע",
        "לא הצלחנו לשמור את הרקע. נסו שוב מאוחר יותר."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShareBackground = async () => {
    if (!previewBackground) return;
    if (loadingAction) return;

    setLoadingAction("share");
    try {
      const localUri = await ensureBackgroundLocalUri(previewBackground);
      const backgroundName = getBackgroundDisplayName(previewBackground);
      await Share.share({
        url: localUri,
        message: `רקע מאמונה`,
      });
    } catch (error) {
      console.warn("Error sharing background", error);
      Alert.alert(
        "שגיאה בשיתוף",
        "לא הצלחנו לשתף את הרקע. נסו שוב מאוחר יותר."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEditSchedule = () => {
    navigation.navigate("Welcome", {
      startAtSchedule: true,
      showPicker: true,
      returnTo: "Backgrounds",
    });
  };

  const handleEnableQuotes = () => {
    navigation.navigate("Welcome", {
      startAtSchedule: true,
      showPicker: true,
      returnTo: "Backgrounds",
    });
  };

  const handleDisableQuotes = () => {
    setWantsQuotes(false);
  };

  useEffect(() => {
    if (!loaded) return;
    if (wantsQuotes === undefined) {
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    }
  }, [loaded, wantsQuotes, navigation]);

  const renderHeader = () => (
    <GlassCard style={styles.headerCard}>
      <Text style={styles.heading}>ספריית הרקעים</Text>
      <Text style={styles.subtitle}>החלק ובחר רקע שמעצים אותך.</Text>
      {wantsQuotes ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>התזכורת היומית שלך</Text>
          <Text style={styles.summaryText}>
            שעה:{" "}
            {notificationTime
              ? formatTime(fromTimeString(notificationTime))
              : "לא נבחרה"}
          </Text>
          <PrimaryButton
            label="עריכת זמן ההתראה"
            onPress={handleEditSchedule}
            style={styles.summaryButton}
          />
          <PrimaryButton
            label="כיבוי ההתראות"
            onPress={handleDisableQuotes}
            variant="secondary"
          />
        </View>
      ) : (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>הציטוטים היומיים כבויים כרגע.</Text>
          <PrimaryButton
            label="הפעלת ציטוטים יומיים"
            onPress={handleEnableQuotes}
            style={styles.summaryButton}
          />
        </View>
      )}
    </GlassCard>
  );

  return (
    <>
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => handleCloseModal()}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => handleCloseModal()}
            disabled={isProcessing}
          >
            <View />
          </Pressable>
          {previewBackground || notificationDescription ? (
            <View style={styles.modalCard}>
              {previewBackground ? (
                <>
                  <ImageBackground
                    source={{ uri: previewBackground.imageUrl }}
                    style={styles.modalImage}
                    imageStyle={styles.modalImageRadius}
                  >
                    <View style={styles.modalImageOverlay} />
                  </ImageBackground>
                  {isIOS ? (
                    <View style={styles.instructions}>
                      <Text style={styles.instructionsTitle}>
                        איך להגדיר את הרקע
                      </Text>
                      <Text style={styles.instructionsItem}>
                        1. פתחו את אפליקציית התמונות.
                      </Text>
                      <Text style={styles.instructionsItem}>
                        2. בחרו את הרקע ששמרתם הרגע.
                      </Text>
                      <Text style={styles.instructionsItem}>
                        3. הקישו על שיתוף › השתמש כרקע.
                      </Text>
                      <Text style={styles.instructionsItem}>
                        4. אשרו למסך המתאים.
                      </Text>
                    </View>
                  ) : null}
                  <PrimaryButton
                    label={
                      isIOS
                        ? "שמירת הרקע לאלבום התמונות"
                        : target === "lock"
                        ? "החלת הרקע למסך הנעילה"
                        : "החלת הרקע למסך הבית"
                    }
                    onPress={handleApplyWallpaper}
                    loading={loadingAction === (isIOS ? "save" : "apply")}
                    disabled={
                      isProcessing &&
                      loadingAction !== (isIOS ? "save" : "apply")
                    }
                  />
                  {!isIOS ? (
                    <PrimaryButton
                      label="שמירת הרקע לאלבום התמונות"
                      variant="secondary"
                      onPress={handleSaveToLibrary}
                      loading={loadingAction === "save"}
                      disabled={isProcessing}
                    />
                  ) : null}
                  <PrimaryButton
                    label="שיתוף הרקע"
                    variant="secondary"
                    onPress={handleShareBackground}
                    loading={loadingAction === "share"}
                    disabled={isProcessing}
                  />
                </>
              ) : notificationDescription ? (
                <View style={styles.notificationDescriptionBox}>
                  <Text style={styles.notificationDescriptionText}>
                    {notificationDescription}
                  </Text>
                </View>
              ) : null}
              <PrimaryButton
                label="סגירה"
                variant="secondary"
                onPress={() => handleCloseModal()}
                disabled={isProcessing}
              />
            </View>
          ) : null}
        </View>
      </Modal>
      <ScreenContainer withScroll={false}>
        <FlatList
          data={backgrounds}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <BackgroundCard
              item={item}
              selected={selectedBackground === item._id}
              onSelect={() => handleSelectBackground(item)}
              loading={
                loadingAction !== null && previewBackground?._id === item._id
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadBackgrounds}
              tintColor={colors.accent}
            />
          }
        />
      </ScreenContainer>
      <Modal
        visible={saveInstructionsVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSaveInstructionsVisible(false)}
      >
        <View style={styles.alertOverlay}>
          <Pressable
            style={styles.alertBackdrop}
            onPress={() => setSaveInstructionsVisible(false)}
          >
            <View />
          </Pressable>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>הרקע נשמר</Text>
            <Text style={styles.alertMessage}>
              {"הרקע נשמר לאלבום התמונות. כך תגדירו אותו כרקע:"}
            </Text>
            <Text style={styles.alertMessage}>
              {"1. פתחו את אפליקציית התמונות."}
            </Text>
            <Text style={styles.alertMessage}>
              {"2. בחרו את הרקע ששמרתם הרגע."}
            </Text>
            <Text style={styles.alertMessage}>
              {"3. הקישו על שיתוף > השתמש כרקע."}
            </Text>
            <Text style={styles.alertMessage}>
              {saveInstructionsTarget === "lock"
                ? "4. בחרו במסך הנעילה ואשרו."
                : "4. בחרו במסך הבית ואשרו."}
            </Text>
            <PrimaryButton
              label="סגירה"
              variant="secondary"
              onPress={() => setSaveInstructionsVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    justifyContent: "space-between",
  },
  headerCard: {
    marginTop: spacing.md,
  },
  summaryBox: {
    borderRadius: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
  summaryButton: {
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(58, 32, 22, 0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderRadius: spacing.xl,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(58, 32, 22, 0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  alertBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  alertCard: {
    borderRadius: spacing.xl,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "left",
  },
  alertMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "left",
    lineHeight: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "left",
  },
  modalImage: {
    height: 240,
    borderRadius: spacing.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  modalImageRadius: {
    borderRadius: spacing.lg,
  },
  modalImageOverlay: {
    height: 80,
    backgroundColor: "rgba(58, 32, 22, 0.45)",
  },
  instructions: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  notificationDescriptionBox: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    textAlign: "left",
    padding: spacing.md,
    gap: spacing.xs,
  },
  notificationDescriptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "left",
  },
  notificationDescriptionText: {
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "left",
    lineHeight: 22,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "left",
  },
  instructionsItem: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "left",
  },
});
