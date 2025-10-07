import { fetchJson } from "./client";
import { Background } from "./types";
import { fallbackBackgrounds } from "../utils/fallbackData";

export async function getBackgrounds(): Promise<Background[]> {
  try {
    const data = await fetchJson<Background[]>("/backgrounds");
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackBackgrounds;
    }
    return data;
  } catch (error) {
    console.warn("שגיאה בשליפת רקעים, שימוש בנתוני ברירת מחדל", error);
    return fallbackBackgrounds;
  }
}
