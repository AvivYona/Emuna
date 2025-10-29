import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getRandomQuote } from "../api/quotes";

const ANDROID_CHANNEL_ID = "daily-quotes";

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

export async function scheduleDailyQuoteNotification(time: string) {
  const hasPermission = await ensureNotificationsPermission();
  if (!hasPermission) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hour, minute] = time.split(":").map(Number);

  try {
    const quote = await getRandomQuote();
    if (!quote) {
      console.warn("No quotes available to schedule notification");
      return;
    }

    const body = `${quote.quote}\n ${quote.author.name}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "אמונה",
        body,
        sound: true,
        data: quote.description
          ? { description: quote.description }
          : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === "android" ? ANDROID_CHANNEL_ID : undefined,
      },
    });
  } catch (error) {
    console.warn("Failed to schedule daily quote notification", error);
  }
}

export async function cancelDailyQuoteNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
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
