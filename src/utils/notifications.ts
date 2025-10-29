import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getRandomQuote } from "../api/quotes";
import { STORAGE_KEYS } from "../storage/preferencesStorage";

const ANDROID_CHANNEL_ID = "daily-quotes";
const DAILY_QUOTE_DATA_TYPE = "daily-quote";
const DAILY_QUOTE_BACKGROUND_TASK = "daily-quote-background-fetch";
const DAILY_QUOTE_NOTIFICATION_ID_STORAGE_KEY =
  "daily-quote-notification-id";

let scheduledNotificationId: string | null = null;
let scheduledNotificationTime: string | null = null;
let notificationReceivedSubscription: Notifications.Subscription | null = null;

const isIosGranted = (status?: Notifications.IosAuthorizationStatus) => {
  return (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
};

export async function ensureNotificationsPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || isIosGranted(settings.ios?.status)) {
    return true;
  }
  const request = await Notifications.requestPermissionsAsync({
    ios: { allowSound: true, allowBadge: true, allowAlert: true },
  });
  return request.granted || isIosGranted(request.ios?.status);
}

async function getStoredNotificationId(): Promise<string | null> {
  const storedId = await AsyncStorage.getItem(
    DAILY_QUOTE_NOTIFICATION_ID_STORAGE_KEY
  );
  return storedId ?? null;
}

async function setStoredNotificationId(id: string | null) {
  if (!id) {
    await AsyncStorage.removeItem(DAILY_QUOTE_NOTIFICATION_ID_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(DAILY_QUOTE_NOTIFICATION_ID_STORAGE_KEY, id);
}

function getNextTriggerDate(time: string): Date | null {
  const [hour, minute] = time.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    console.warn(`Invalid notification time provided: ${time}`);
    return null;
  }

  const now = new Date();
  const trigger = new Date(now);
  trigger.setHours(hour, minute, 0, 0);

  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  return trigger;
}

async function cancelScheduledNotification() {
  const notificationId =
    scheduledNotificationId ?? (await getStoredNotificationId());
  if (!notificationId) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(
      notificationId
    );
  } catch (error) {
    console.warn(
      "Failed to cancel existing scheduled daily quote notification",
      error
    );
  } finally {
    scheduledNotificationId = null;
    await setStoredNotificationId(null);
  }
}

async function scheduleSingleNotification(time: string) {
  const hasPermission = await ensureNotificationsPermission();
  if (!hasPermission) {
    return;
  }

  const nextTriggerDate = getNextTriggerDate(time);
  if (!nextTriggerDate) {
    return;
  }

  await cancelScheduledNotification();

  const quote = await getRandomQuote();
  if (!quote) {
    console.warn("No quotes available to schedule notification");
    return;
  }

  const body = `${quote.quote}\n ${quote.author.name}`;
  const data: Record<string, unknown> = {
    type: DAILY_QUOTE_DATA_TYPE,
  };

  if (quote.description) {
    data.description = quote.description;
  }

  const trigger: Notifications.NotificationTriggerInput =
    Platform.OS === "android"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: ANDROID_CHANNEL_ID,
          date: nextTriggerDate,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextTriggerDate,
        };

  try {
    scheduledNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "אמונה",
        body,
        sound: true,
        data,
      },
      trigger,
    });
    await setStoredNotificationId(scheduledNotificationId);
  } catch (error) {
    console.warn("Failed to schedule daily quote notification", error);
  }
}

function ensureNotificationListener() {
  if (notificationReceivedSubscription) {
    return;
  }

  notificationReceivedSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      const notificationType = notification.request.content.data?.type;
      if (
        notificationType !== DAILY_QUOTE_DATA_TYPE ||
        !scheduledNotificationTime
      ) {
        return;
      }

      scheduleSingleNotification(scheduledNotificationTime).catch((error) => {
        console.warn(
          "Failed to reschedule daily quote notification after delivery",
          error
        );
      });
    });
}

async function registerBackgroundFetchTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    DAILY_QUOTE_BACKGROUND_TASK
  );
  if (isRegistered) {
    return;
  }
  try {
    await BackgroundFetch.registerTaskAsync(DAILY_QUOTE_BACKGROUND_TASK, {
      minimumInterval: 60 * 60, // 1 hour, platform minimum is ~15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    console.warn(
      "Failed to register background fetch task for daily quotes",
      error
    );
  }
}

async function unregisterBackgroundFetchTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    DAILY_QUOTE_BACKGROUND_TASK
  );
  if (!isRegistered) {
    return;
  }
  try {
    await BackgroundFetch.unregisterTaskAsync(DAILY_QUOTE_BACKGROUND_TASK);
  } catch (error) {
    console.warn(
      "Failed to unregister background fetch task for daily quotes",
      error
    );
  }
}

TaskManager.defineTask(DAILY_QUOTE_BACKGROUND_TASK, async () => {
  try {
    const wantsQuotesRaw = await AsyncStorage.getItem(STORAGE_KEYS.wantsQuotes);
    const wantsQuotes = wantsQuotesRaw === "true";
    const notificationTime =
      (await AsyncStorage.getItem(STORAGE_KEYS.notificationTime)) ?? null;

    if (!wantsQuotes || !notificationTime) {
      await cancelScheduledNotification();
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await scheduleSingleNotification(notificationTime);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.warn("Daily quote background fetch task failed", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function scheduleDailyQuoteNotification(time: string) {
  scheduledNotificationTime = time;
  ensureNotificationListener();
  await registerBackgroundFetchTask();
  await scheduleSingleNotification(time);
}

export async function cancelDailyQuoteNotification() {
  await cancelScheduledNotification();
  scheduledNotificationTime = null;
  await unregisterBackgroundFetchTask();
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
