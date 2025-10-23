import React, { useState } from "react";
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
import { formatTime, fromTimeString, toTimeString } from "../utils/time";
import { usePreferences } from "../context/PreferencesContext";
import { ensureNotificationsPermission } from "../utils/notifications";

export type ScheduleScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Schedule"
>;

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  navigation,
}) => {
  const { notificationTime, setNotificationTime, setWantsQuotes } =
    usePreferences();
  const initialDate = fromTimeString(notificationTime);
  const [time, setTime] = useState<Date>(initialDate);
  const [showPicker, setShowPicker] = useState<boolean>(Platform.OS === "ios");

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

  const handleContinue = async () => {
    const timeString = toTimeString(time);
    setNotificationTime(timeString);
    setWantsQuotes(true);
    await ensureNotificationsPermission();
    navigation.reset({ index: 0, routes: [{ name: "Backgrounds" }] });
  };

  return (
    <ScreenContainer>
      <GlassCard>
        <Text style={styles.heading}>מתי תרצה לקבל את הציטוט היומי?</Text>
        <Text style={styles.subtitle}>
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
            />
          </View>
        )}
        <PrimaryButton label="שמור והמשך" onPress={handleContinue} />
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  pickerWrapper: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    alignItems: "flex-end",
    direction: "rtl",
    writingDirection: "rtl",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignSelf: "stretch",
    width: "100%",
  },
  timeButton: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    padding: spacing.lg,
    alignItems: "flex-end",
    direction: "rtl",
    writingDirection: "rtl",
    marginBottom: spacing.lg,
    alignSelf: "stretch",
    width: "100%",
  },
  timeLabel: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    width: "100%",
  },
  timeHelper: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
    width: "100%",
  },
});
