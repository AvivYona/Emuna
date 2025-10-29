import AsyncStorage from "@react-native-async-storage/async-storage";
import { Background } from "../api/types";
import { STORAGE_KEYS } from "./preferencesStorage";

export type CustomBackgroundRecord = Background & {
  createdAt: number;
};

function isValidRecord(value: unknown): value is CustomBackgroundRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<CustomBackgroundRecord>;
  return (
    typeof record._id === "string" &&
    typeof record.imageUrl === "string" &&
    typeof record.createdAt === "number"
  );
}

function normalizeRecord(
  record: Background & { createdAt: number }
): CustomBackgroundRecord {
  return {
    ...record,
    thumbnailUrl: record.thumbnailUrl ?? record.imageUrl,
    createdAt: record.createdAt,
  };
}

export async function getCustomBackgrounds(): Promise<CustomBackgroundRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.customBackgrounds);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(isValidRecord)
      .map((item) => normalizeRecord(item))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.warn("Failed to load custom backgrounds", error);
    return [];
  }
}

export async function saveCustomBackground(
  background: Background,
  createdAt = Date.now()
): Promise<CustomBackgroundRecord> {
  const existing = await getCustomBackgrounds();
  const sanitizedExisting = existing.filter((item) => item._id !== background._id);
  const record = normalizeRecord({
    ...background,
    createdAt,
  });
  const next = [record, ...sanitizedExisting];
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.customBackgrounds,
      JSON.stringify(next)
    );
  } catch (error) {
    console.warn("Failed to persist custom background", error);
  }
  return record;
}

export async function removeCustomBackground(id: string): Promise<void> {
  const existing = await getCustomBackgrounds();
  const next = existing.filter((item) => item._id !== id);
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.customBackgrounds,
      JSON.stringify(next)
    );
  } catch (error) {
    console.warn("Failed to remove custom background", error);
  }
}
