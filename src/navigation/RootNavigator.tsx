import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { usePreferences } from "../context/PreferencesContext";
import { useShabbatRestriction } from "../context/ShabbatContext";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { ScheduleScreen } from "../screens/ScheduleScreen";
import { BackgroundsScreen } from "../screens/BackgroundsScreen";
import { LoadingState } from "../components/LoadingState";
import { ShabbatRestrictionScreen } from "../screens/ShabbatRestrictionScreen";
import { colors } from "../theme";

export type RootStackParamList = {
  Welcome:
    | {
        startAtSchedule?: boolean;
        showPicker?: boolean;
        returnTo?: "Backgrounds";
      }
    | undefined;
  Schedule: undefined;
  Backgrounds: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    text: colors.textPrimary,
  },
};

export const RootNavigator = () => {
  const { loaded, wantsQuotes } = usePreferences();
  const { loading: restrictionLoading, restriction } = useShabbatRestriction();

  if (!loaded) {
    return <LoadingState label="טוען העדפות..." />;
  }

  if (!restriction && restrictionLoading) {
    return <LoadingState label="בודק זמינות..." />;
  }

  if (restriction) {
    return <ShabbatRestrictionScreen loading={restrictionLoading} />;
  }

  const showOnboarding = wantsQuotes === undefined;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={showOnboarding ? "Welcome" : "Backgrounds"}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="Backgrounds" component={BackgroundsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
