import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Notifications from "expo-notifications";
import * as FileSystem from "expo-file-system";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  Alert,
  ActivityIndicator,
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
import { CreateBackgroundCard } from "../components/CreateBackgroundCard";
import { PrimaryButton } from "../components/PrimaryButton";
import ViewShot from "react-native-view-shot";
import { colors, spacing } from "../theme";
import { SplashScreenOverlay } from "../components/SplashScreenOverlay";
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
import {
  getCustomBackgrounds,
  removeCustomBackground,
  CustomBackgroundRecord,
} from "../storage/customBackgroundsStorage";

const handledNotificationKeys = new Set<string>();

const parseQuoteNotificationPayload = (
  description: unknown,
  quoteContent?: string | null
): { description: string; quote: string | null } | null => {
  if (typeof description !== "string") {
    return null;
  }
  const trimmedDescription = description.trim();
  if (!trimmedDescription.length) {
    return null;
  }
  const trimmedQuote =
    typeof quoteContent === "string" && quoteContent.trim().length
      ? quoteContent.trim()
      : null;
  return { description: trimmedDescription, quote: trimmedQuote };
};

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

type BackgroundListItem =
  | { type: "create" }
  | { type: "background"; background: Background }
  | { type: "spacer"; key: string };

export const BackgroundsScreen: React.FC<BackgroundsScreenProps> = ({
  navigation,
  route,
}) => {
  const {
    selectedBackground,
    selectedBackgroundTarget,
    setSelectedBackground,
    wantsQuotes,
    setWantsQuotes,
    notificationTime,
    loaded,
    lastNotificationPreview,
    setLastNotificationPreview,
  } = usePreferences();
  const [customBackgrounds, setCustomBackgrounds] = useState<Background[]>([]);
  const [remoteBackgrounds, setRemoteBackgrounds] = useState<Background[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<Background | null>(
    null
  );
  const [notificationDescription, setNotificationDescription] = useState<
    string | null
  >(null);
  const [notificationQuote, setNotificationQuote] = useState<string | null>(
    null
  );
  const [target, setTarget] = useState<BackgroundTarget>("home");
  const [loadingAction, setLoadingAction] = useState<
    null | "apply" | "save" | "share"
  >(null);
  const [saveInstructionsVisible, setSaveInstructionsVisible] = useState(false);
  const [sharingQuote, setSharingQuote] = useState(false);
  const [justCreatedBackgroundId, setJustCreatedBackgroundId] = useState<
    string | null
  >(null);
  const [newBackgroundModalVisible, setNewBackgroundModalVisible] =
    useState(false);
  const [backgroundPendingDeletion, setBackgroundPendingDeletion] =
    useState<Background | null>(null);
  const [deletingBackgroundId, setDeletingBackgroundId] = useState<
    string | null
  >(null);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashDelayDone, setSplashDelayDone] = useState(false);

  const allBackgrounds = useMemo(
    () => [...customBackgrounds, ...remoteBackgrounds],
    [customBackgrounds, remoteBackgrounds]
  );

  const customBackgroundIds = useMemo(
    () => new Set(customBackgrounds.map((background) => background._id)),
    [customBackgrounds]
  );

  const backgroundItems = useMemo<BackgroundListItem[]>(() => {
    const items: BackgroundListItem[] = [
      { type: "create" },
      ...allBackgrounds.map((background) => ({
        type: "background" as const,
        background,
      })),
    ];

    if (items.length % 2 !== 0) {
      items.push({ type: "spacer", key: `spacer-${items.length}` });
    }

    return items;
  }, [allBackgrounds]);

  const handleOpenCustomCreator = useCallback(() => {
    navigation.navigate("BackgroundPicker");
  }, [navigation]);

  const isIOS = Platform.OS === "ios";
  const isProcessing = loadingAction !== null;
  const isPreviewCustom =
    previewBackground !== null &&
    customBackgroundIds.has(previewBackground._id);
  const deleteInProgress =
    previewBackground !== null &&
    deletingBackgroundId === previewBackground._id;
  const pendingDeleteInProgress =
    backgroundPendingDeletion !== null &&
    deletingBackgroundId === backgroundPendingDeletion._id;
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  const refreshingRef = useRef(false);
  const handledNotificationKeyRef = useRef<string | null>(null);
  const focusTimestampRef = useRef<number>(Date.now());
  const notificationShareRef = useRef<ViewShot>(null);
  const applyQuotePreview = useCallback(
    (description: unknown, quoteContent?: string | null) => {
      const parsed = parseQuoteNotificationPayload(description, quoteContent);
      if (!parsed) {
        return null;
      }
      setLastNotificationPreview(parsed);
      return parsed;
    },
    [setLastNotificationPreview]
  );
  const refreshLatestDeliveredQuote = useCallback(async () => {
    if (!wantsQuotes) {
      return;
    }
    try {
      const presentedNotifications =
        await Notifications.getPresentedNotificationsAsync();
      if (!presentedNotifications.length) {
        return;
      }
      const latestWithQuote = presentedNotifications
        .filter((item) =>
          parseQuoteNotificationPayload(
            item.request.content.data?.description,
            item.request.content.body ?? item.request.content.title ?? null
          )
        )
        .sort((a, b) => a.date - b.date)
        .pop();
      if (!latestWithQuote) {
        return;
      }
      const quote =
        latestWithQuote.request.content.body ??
        latestWithQuote.request.content.title ??
        null;
      applyQuotePreview(
        latestWithQuote.request.content.data?.description,
        quote
      );
    } catch (error) {
      console.warn("Failed to read presented notifications", error);
    }
  }, [applyQuotePreview, wantsQuotes]);

  const loadCustomBackgrounds = useCallback(async () => {
    const customItems = await getCustomBackgrounds();
    if (customItems.length === 0) {
      setCustomBackgrounds([]);
      return;
    }

    const validated = await Promise.all(
      customItems.map(async (item) => {
        if (item.imageUrl?.startsWith("file://")) {
          try {
            const info = await FileSystem.getInfoAsync(item.imageUrl);
            if (!info.exists) {
              await removeCustomBackground(item._id);
              return null;
            }
          } catch (error) {
            console.warn("Failed to validate custom background file", error);
            return null;
          }
        }
        return item;
      })
    );

    const filtered = validated.filter(
      (item): item is CustomBackgroundRecord => item !== null
    );
    setCustomBackgrounds(filtered);
  }, []);

  const loadRemoteBackgrounds = useCallback(async () => {
    const remoteItems = await getBackgrounds();
    setRemoteBackgrounds(remoteItems);
  }, []);

  const loadBackgrounds = useCallback(
    async ({
      refreshRemote = false,
      showSpinner = true,
    }: { refreshRemote?: boolean; showSpinner?: boolean } = {}) => {
      if (showSpinner && isFocusedRef.current && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
      }
      try {
        const tasks: Array<Promise<unknown>> = [loadCustomBackgrounds()];
        if (refreshRemote || initialLoading) {
          tasks.push(loadRemoteBackgrounds());
        }
        await Promise.all(tasks);
      } finally {
        if (refreshingRef.current) {
          refreshingRef.current = false;
          setRefreshing(false);
        } else if (!isFocusedRef.current) {
          requestAnimationFrame(() => setRefreshing(false));
        }
        setInitialLoading(false);
      }
    },
    [initialLoading, loadCustomBackgrounds, loadRemoteBackgrounds]
  );

  useFocusEffect(
    useCallback(() => {
      void loadBackgrounds({ refreshRemote: false, showSpinner: false });
      void refreshLatestDeliveredQuote();
    }, [loadBackgrounds, refreshLatestDeliveredQuote])
  );

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused || refreshingRef.current) {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!initialLoading) {
      setSplashVisible(false);
    }
  }, [initialLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDelayDone(true), 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const highlightId = route.params?.highlightBackgroundId;
    if (!highlightId) {
      return;
    }
    setJustCreatedBackgroundId(highlightId);
    navigation.setParams({ highlightBackgroundId: undefined });
  }, [navigation, route.params?.highlightBackgroundId]);

  useEffect(() => {
    if (!justCreatedBackgroundId) {
      return;
    }
    setNewBackgroundModalVisible(true);
    const timer = setTimeout(() => {
      setNewBackgroundModalVisible(false);
      setJustCreatedBackgroundId(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [justCreatedBackgroundId]);

  useEffect(() => {
    if (isFocused) {
      focusTimestampRef.current = Date.now();
    }
  }, [isFocused]);

  useEffect(() => {
    if (!wantsQuotes) {
      return;
    }
    const subscription = Notifications.addNotificationReceivedListener(
      (receivedNotification) => {
        const quote =
          receivedNotification.request.content.body ??
          receivedNotification.request.content.title ??
          null;
        applyQuotePreview(
          receivedNotification.request.content.data?.description,
          quote
        );
      }
    );
    return () => {
      subscription.remove();
    };
  }, [applyQuotePreview, wantsQuotes]);

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
    const quote =
      notification?.request.content.body ??
      notification?.request.content.title ??
      null;
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
    const preview = applyQuotePreview(trimmedDescription, quote);
    if (!preview) {
      return;
    }
    setNotificationDescription(preview.description);
    setNotificationQuote(preview.quote);
    setPreviewBackground(null);
    setTarget("home");
    setModalVisible(true);
    setSharingQuote(false);
    setSaveInstructionsVisible(false);
  }, [applyQuotePreview, isFocused, lastNotificationResponse, wantsQuotes]);

  const handleSelectBackground = (background: Background) => {
    const initialTarget: BackgroundTarget =
      selectedBackground === background._id && selectedBackgroundTarget
        ? selectedBackgroundTarget
        : "home";

    setPreviewBackground(background);
    setNotificationDescription(null);
    setNotificationQuote(null);
    setTarget(initialTarget);
    setModalVisible(true);
  };

  const handleCloseModal = (force = false) => {
    if (isProcessing && !force) {
      return;
    }
    if (handledNotificationKeyRef.current) {
      handledNotificationKeyRef.current = null;
    }
    setModalVisible(false);
    setPreviewBackground(null);
    setNotificationDescription(null);
    setNotificationQuote(null);
    setSharingQuote(false);
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

  const handleRequestDeleteBackground = useCallback(() => {
    if (!previewBackground) {
      return;
    }
    if (!customBackgroundIds.has(previewBackground._id)) {
      return;
    }
    const target = previewBackground;
    handleCloseModal(true);
    setBackgroundPendingDeletion(target);
  }, [customBackgroundIds, handleCloseModal, previewBackground]);

  const handleCancelDeleteBackground = useCallback(() => {
    if (deletingBackgroundId) {
      return;
    }
    setBackgroundPendingDeletion(null);
  }, [deletingBackgroundId]);

  const handleConfirmDeleteBackground = useCallback(async () => {
    if (!backgroundPendingDeletion) {
      return;
    }
    const targetBackground = backgroundPendingDeletion;
    setDeletingBackgroundId(targetBackground._id);
    try {
      const wasPreviewed = previewBackground?._id === targetBackground._id;
      if (wasPreviewed) {
        handleCloseModal(true);
      }
      await removeCustomBackground(targetBackground._id);
      if (
        targetBackground.imageUrl &&
        targetBackground.imageUrl.startsWith("file://")
      ) {
        try {
          await FileSystem.deleteAsync(targetBackground.imageUrl, {
            idempotent: true,
          });
        } catch (fileError) {
          console.warn("Failed to delete custom background file", fileError);
        }
      }
      setCustomBackgrounds((items) =>
        items.filter((item) => item._id !== targetBackground._id)
      );
      if (selectedBackground === targetBackground._id) {
        setSelectedBackground();
      }
    } catch (error) {
      console.warn("Failed to delete custom background", error);
      Alert.alert(
        "שגיאה במחיקה",
        "לא הצלחנו למחוק את הרקע. נסו שוב מאוחר יותר."
      );
    } finally {
      setDeletingBackgroundId(null);
      setBackgroundPendingDeletion(null);
    }
  }, [
    backgroundPendingDeletion,
    handleCloseModal,
    previewBackground,
    selectedBackground,
    setSelectedBackground,
  ]);

  const handleShareNotification = async () => {
    if ((!notificationDescription && !notificationQuote) || sharingQuote) {
      return;
    }
    const viewShot = notificationShareRef.current;
    if (!viewShot || !viewShot.capture) {
      Alert.alert(
        "שגיאה בשיתוף הציטוט",
        "לא הצלחנו להכין את התצוגה לשיתוף. נסו שוב מאוחר יותר."
      );
      return;
    }

    setSharingQuote(true);
    let capturedUri: string | null = null;
    try {
      const uri = await viewShot.capture();
      capturedUri = uri ?? null;
      if (!capturedUri) {
        throw new Error("capture-failed");
      }

      await Share.share({
        url: capturedUri,
        title: "ציטוט מאמונה",
        message: Platform.OS === "android" ? "ציטוט מאמונה" : undefined,
      });
    } catch (error) {
      console.warn("Error sharing notification quote", error);
      Alert.alert(
        "שגיאה בשיתוף הציטוט",
        "לא הצלחנו לשתף את הציטוט. נסו שוב מאוחר יותר."
      );
    } finally {
      if (capturedUri) {
        try {
          await FileSystem.deleteAsync(capturedUri, { idempotent: true });
        } catch (cleanupError) {
          console.warn("Failed to clean up captured quote image", cleanupError);
        }
      }
      setSharingQuote(false);
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

  const handleDismissNewBackgroundModal = useCallback(() => {
    setNewBackgroundModalVisible(false);
    setJustCreatedBackgroundId(null);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (wantsQuotes === undefined) {
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    }
  }, [loaded, wantsQuotes, navigation]);

  const renderHeader = () => (
    <GlassCard style={styles.headerCard}>
      <Text style={styles.heading}>ספריית הרקעים</Text>
      <Text style={styles.subtitle}>גללו ובחרו רקע שהתחברתם אליו</Text>
      {wantsQuotes ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>הציטוט היומי</Text>
          <Text style={styles.summaryText}>
            שעה:{" "}
            {notificationTime
              ? formatTime(fromTimeString(notificationTime))
              : "לא נבחרה"}
          </Text>
          {lastNotificationPreview ? (
            <Pressable
              style={({ pressed }) => [
                styles.previewBubble,
                pressed ? styles.previewBubblePressed : null,
              ]}
              onPress={() => {
                setNotificationDescription(lastNotificationPreview.description);
                setNotificationQuote(lastNotificationPreview.quote);
                setPreviewBackground(null);
                setTarget("home");
                setModalVisible(true);
              }}
            >
              {lastNotificationPreview.quote ? (
                <Text style={styles.previewQuote}>
                  {lastNotificationPreview.quote}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
          <PrimaryButton
            label="עריכת זמן ההתראה"
            onPress={handleEditSchedule}
            style={styles.summaryButton}
            size="small"
          />
          <PrimaryButton
            label="כיבוי ההתראות"
            onPress={handleDisableQuotes}
            variant="secondary"
            size="small"
          />
        </View>
      ) : (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>הציטוטים היומיים כבויים כרגע.</Text>
          <PrimaryButton
            label="הפעלת ציטוטים יומיים"
            onPress={handleEnableQuotes}
            style={styles.summaryButton}
            size="small"
          />
        </View>
      )}
    </GlassCard>
  );

  return (
    <>
      {splashVisible && splashDelayDone ? <SplashScreenOverlay /> : null}
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
                  />

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
                  {isPreviewCustom ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleRequestDeleteBackground}
                      disabled={isProcessing || deleteInProgress}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && !deleteInProgress && !isProcessing
                          ? styles.deleteButtonPressed
                          : null,
                        deleteInProgress ? styles.deleteButtonDisabled : null,
                      ]}
                    >
                      {deleteInProgress ? (
                        <ActivityIndicator color={colors.background} />
                      ) : (
                        <Text style={styles.deleteButtonLabel}>מחיקת הרקע</Text>
                      )}
                    </Pressable>
                  ) : null}
                </>
              ) : notificationDescription ? (
                <View style={styles.notificationDescriptionBox}>
                  <ViewShot
                    ref={notificationShareRef}
                    style={styles.notificationSharePreview}
                    options={{ format: "png", quality: 1, result: "tmpfile" }}
                  >
                    {notificationQuote ? (
                      <Text style={styles.notificationQuoteText}>
                        {notificationQuote}
                      </Text>
                    ) : null}
                    <Text style={styles.notificationDescriptionText}>
                      {notificationDescription}
                    </Text>
                  </ViewShot>
                  <PrimaryButton
                    label="שיתוף הציטוט"
                    onPress={handleShareNotification}
                    loading={sharingQuote}
                    disabled={sharingQuote}
                  />
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
        <View style={styles.listWrapper}>
          <FlatList
            data={backgroundItems}
            keyExtractor={(item) =>
              item.type === "create"
                ? "create-background-card"
                : item.type === "spacer"
                ? item.key
                : item.background._id
            }
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) =>
              item.type === "create" ? (
                <CreateBackgroundCard onPress={handleOpenCustomCreator} />
              ) : item.type === "spacer" ? (
                <View pointerEvents="none" style={styles.backgroundSpacer} />
              ) : (
                <BackgroundCard
                  item={item.background}
                  selected={
                    selectedBackground === item.background._id ||
                    justCreatedBackgroundId === item.background._id
                  }
                  onSelect={() => handleSelectBackground(item.background)}
                  loading={
                    loadingAction !== null &&
                    previewBackground?._id === item.background._id
                  }
                />
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void loadBackgrounds({
                    refreshRemote: true,
                    showSpinner: true,
                  });
                }}
                tintColor={colors.accent}
              />
            }
          />
          {initialLoading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : null}
        </View>
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
              {"4. בחרו במסך הבית/מסך הנעילה ואשרו."}
            </Text>
            <PrimaryButton
              label="סגירה"
              variant="secondary"
              onPress={() => setSaveInstructionsVisible(false)}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={newBackgroundModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleDismissNewBackgroundModal}
      >
        <View style={styles.alertOverlay}>
          <Pressable
            style={styles.alertBackdrop}
            onPress={handleDismissNewBackgroundModal}
          >
            <View />
          </Pressable>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>הרקע נשמר</Text>
            <Text style={styles.alertMessage}>
              {"הרקע האישי החדש שלכם מחכה בראש ספריית הרקעים."}
            </Text>
            <PrimaryButton
              label="סגירה"
              variant="secondary"
              onPress={handleDismissNewBackgroundModal}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={backgroundPendingDeletion !== null}
        animationType="fade"
        transparent
        onRequestClose={handleCancelDeleteBackground}
      >
        <View style={styles.alertOverlay}>
          <Pressable
            style={styles.alertBackdrop}
            onPress={handleCancelDeleteBackground}
            disabled={pendingDeleteInProgress}
          >
            <View />
          </Pressable>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>מחיקת רקע</Text>
            <Text style={styles.alertMessage}>
              {"האם למחוק לצמיתות את הרקע האישי הזה?"}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCancelDeleteBackground}
                disabled={pendingDeleteInProgress}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && !pendingDeleteInProgress
                    ? styles.confirmButtonPressed
                    : null,
                  pendingDeleteInProgress ? styles.confirmButtonDisabled : null,
                ]}
              >
                <Text style={styles.confirmButtonLabel}>ביטול</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirmDeleteBackground}
                disabled={pendingDeleteInProgress}
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmButtonDanger,
                  pressed && !pendingDeleteInProgress
                    ? styles.confirmButtonPressed
                    : null,
                  pendingDeleteInProgress ? styles.confirmButtonDisabled : null,
                ]}
              >
                {pendingDeleteInProgress ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    style={[
                      styles.confirmButtonLabel,
                      styles.confirmButtonDangerLabel,
                    ]}
                  >
                    מחיקה
                  </Text>
                )}
              </Pressable>
            </View>
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
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    justifyContent: "space-between",
  },
  backgroundSpacer: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: spacing.sm,
  },
  deleteButton: {
    width: "100%",
    paddingVertical: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonPressed: {
    opacity: 0.85,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.background,
    textAlign: "center",
  },
  confirmActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDanger: {
    backgroundColor: colors.danger,
    borderColor: "transparent",
  },
  confirmButtonPressed: {
    opacity: 0.9,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  confirmButtonDangerLabel: {
    color: colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58, 32, 22, 0.2)",
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
  previewBubble: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.xs,
  },
  previewBubblePressed: {
    opacity: 0.85,
  },
  previewQuote: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  previewDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
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
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  modalImage: {
    height: 400,
    borderRadius: spacing.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  modalImageRadius: {
    borderRadius: spacing.lg,
  },

  instructions: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  notificationDescriptionBox: {
    width: "100%",
    gap: spacing.md,
    alignItems: "center",
  },
  notificationSharePreview: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: "center",
    overflow: "hidden",
  },
  notificationQuoteText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  notificationDescriptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  notificationDescriptionText: {
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 22,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  instructionsItem: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
