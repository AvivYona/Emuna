import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePreferences } from '../context/PreferencesContext';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { AuthorsScreen } from '../screens/AuthorsScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { BackgroundsScreen } from '../screens/BackgroundsScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { LoadingState } from '../components/LoadingState';
import { colors } from '../theme';

export type RootStackParamList = {
  Welcome: { startAtSchedule?: boolean; showPicker?: boolean } | undefined;
  Authors: undefined;
  Schedule: undefined;
  Backgrounds: undefined;
  AdminLogin: undefined;
  Admin: { adminSecret: string };
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

  if (!loaded) {
    return <LoadingState label="טוען העדפות..." />;
  }

  const showOnboarding = wantsQuotes === undefined;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={showOnboarding ? 'Welcome' : 'Backgrounds'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="Authors" component={AuthorsScreen} />
        <Stack.Screen name="Backgrounds" component={BackgroundsScreen} />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
