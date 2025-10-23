import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getBoolean(key: string): Promise<boolean | undefined> {
  const value = await AsyncStorage.getItem(key);
  if (value === null) {
    return undefined;
  }
  return value === "true";
}

export function setBoolean(key: string, value: boolean): Promise<void> {
  return AsyncStorage.setItem(key, value ? "true" : "false");
}

export async function getString(key: string): Promise<string | undefined> {
  const value = await AsyncStorage.getItem(key);
  return value ?? undefined;
}

export function setString(key: string, value: string): Promise<void> {
  return AsyncStorage.setItem(key, value);
}

export function removeItem(key: string): Promise<void> {
  return AsyncStorage.removeItem(key);
}

export const STORAGE_KEYS = {
  wantsQuotes: "isUserWantQuotes",
  notificationTime: "notificationTime",
  selectedBackground: "selectedBackground",
  selectedBackgroundTarget: "selectedBackgroundTarget",
  customBackgrounds: "customBackgroundLibrary",
} as const;
