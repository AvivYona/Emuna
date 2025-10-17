import React, { useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { RootStackParamList } from "../navigation/RootNavigator";
import { ScreenContainer } from "../components/ScreenContainer";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import { usePreferences } from "../context/PreferencesContext";
import { ensureNotificationsPermission } from "../utils/notifications";
import { formatTime, fromTimeString, toTimeString } from "../utils/time";

export type WelcomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Welcome"
>;

type Step = "intro" | "schedule";

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  navigation,
  route,
}) => {
  const {
    notificationTime,
    setWantsQuotes,
    setFavoriteAuthors,
    setNotificationTime,
    wantsQuotes,
  } = usePreferences();
  const startAtSchedule = route.params?.startAtSchedule ?? false;
  const forceShowPicker = route.params?.showPicker;
  const returnToBackgrounds = route.params?.returnToBackgrounds ?? false;
  const [step, setStep] = useState<Step>(
    startAtSchedule ? "schedule" : "intro"
  );
  const initialDate = useMemo(
    () => fromTimeString(notificationTime),
    [notificationTime]
  );
  const [time, setTime] = useState<Date>(initialDate);
  const [showPicker, setShowPicker] = useState<boolean>(
    forceShowPicker ?? Platform.OS === "ios"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!startAtSchedule && forceShowPicker !== true) {
      return;
    }

    if (startAtSchedule) {
      setStep("schedule");
    }
    if (forceShowPicker === true) {
      setShowPicker(forceShowPicker);
    }

    navigation.setParams({
      startAtSchedule: false,
      showPicker: false,
      returnToBackgrounds: false,
    });
  }, [startAtSchedule, forceShowPicker, navigation]);

  useEffect(() => {
    if (step !== "schedule") return;
    setTime(initialDate);
    setShowPicker((previous) => {
      if (Platform.OS === "ios") {
        return true;
      }
      if (forceShowPicker) {
        return true;
      }
      return previous;
    });
  }, [step, initialDate, forceShowPicker]);

  const handleDecline = () => {
    setWantsQuotes(false);
    setFavoriteAuthors([]);
    setNotificationTime(undefined);
    setStep("intro");
    navigation.reset({ index: 0, routes: [{ name: "Backgrounds" }] });
  };

  const handleAccept = () => {
    setStep("schedule");
  };

  const onChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (selectedDate) {
      setTime(selectedDate);
    }
  };

  const handleOpenPicker = () => {
    if (Platform.OS === "android") {
      setShowPicker(true);
    }
  };

  const handleSaveTime = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const timeString = toTimeString(time);
      setNotificationTime(timeString);
      try {
        await ensureNotificationsPermission();
      } catch (error) {
        console.warn("Notification permission request failed", error);
      }
      setWantsQuotes(true);
      if (returnToBackgrounds && wantsQuotes) {
        navigation.reset({ index: 0, routes: [{ name: "Backgrounds" }] });
      } else {
        navigation.navigate("Authors");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <GlassCard>
        {step === "intro" ? (
          <>
            <Text style={styles.heading}>ברוכים הבאים לאמונה</Text>
            <Text style={styles.body}>
              אנחנו כאן כדי להזכיר לך רגע של השראה בכל יום מחדש. האם תרצה לקבל
              ציטוט יומי מותאם עבורך?
            </Text>
            <PrimaryButton label="כן, שלחו לי ציטוטים" onPress={handleAccept} />
            <PrimaryButton
              label="לא כרגע"
              onPress={handleDecline}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <Text style={styles.scheduleHeading}>
              מתי תרצה לקבל את התזכורת היומית?
            </Text>
            <Text style={styles.scheduleSubtitle}>
              בחר זמן קבוע ביום שבו תופיע התראה עם ציטוט חדש.
            </Text>
            {Platform.OS === "android" ? (
              <Pressable onPress={handleOpenPicker} style={styles.timeButton}>
                <Text style={styles.timeLabel}>{formatTime(time)}</Text>
                <Text style={styles.timeHelper}>הקשה כדי לבחור זמן</Text>
              </Pressable>
            ) : null}
            {(showPicker || Platform.OS === "ios") && (
              <View style={styles.pickerWrapper}>
                <DateTimePicker
                  value={time}
                  mode="time"
                  is24Hour
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onChange}
                  locale="he-IL"
                  themeVariant={Platform.OS === "ios" ? "dark" : undefined}
                  textColor={
                    Platform.OS === "ios" ? colors.textPrimary : undefined
                  }
                />
              </View>
            )}
            <PrimaryButton
              label="שמור והמשך"
              onPress={handleSaveTime}
              loading={saving}
              disabled={saving}
            />
            <PrimaryButton
              label="חזרה"
              onPress={() => setStep("intro")}
              variant="secondary"
              disabled={saving}
            />
          </>
        )}
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "left",
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: "left",
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  scheduleHeading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "left",
    marginBottom: spacing.sm,
  },
  scheduleSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "left",
    marginBottom: spacing.lg,
  },
  pickerWrapper: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  timeButton: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  timeLabel: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  timeHelper: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
