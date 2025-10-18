import { Platform } from "react-native";

type HebcalItem = {
  title?: string;
  hebrew?: string;
  memo?: string;
  category?: string;
  subcat?: string;
  yomtov?: boolean;
  date?: string;
};

type HebcalResponse = {
  items?: HebcalItem[];
};

export type RestrictionReason = "shabbat" | "yomtov";

export type RestrictionInfo = {
  reason: RestrictionReason;
  title: string;
  subtitle?: string;
  start: Date;
  end: Date;
};

type RestrictionResult =
  | { restriction: RestrictionInfo; nextCheckAfterMs: number }
  | { restriction: null; nextCheckAfterMs: number };

const HEB_CAL_BASE_URL = "https://www.hebcal.com/hebcal/";
const GEO_NAME_ID_ISRAEL = "293397"; // Jerusalem – used as reference for Israel times
const DEFAULT_TIMEZONE_OFFSET = "+03:00"; // Asia/Jerusalem handles summer/winter automatically in API

const MS_IN_MINUTE = 60 * 1000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

const isValidDate = (value: Date | null): value is Date =>
  !!value && !Number.isNaN(value.getTime());

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes("T")) {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  // Treat all-day events as occurring midday Israel time to simplify comparisons
  const parsed = new Date(`${value}T12:00:00${DEFAULT_TIMEZONE_OFFSET}`);
  return isValidDate(parsed) ? parsed : null;
};

const formatDateParam = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fetchCalendarWindow = async (
  start: Date,
  end: Date
): Promise<HebcalResponse> => {
  const params = new URLSearchParams({
    v: "1",
    cfg: "json",
    maj: "on",
    min: "on",
    mod: "on",
    nx: "on",
    c: "on",
    i: "on",
    geo: "geoname",
    geonameid: GEO_NAME_ID_ISRAEL,
    start: formatDateParam(start),
    end: formatDateParam(end),
  });

  const url = `${HEB_CAL_BASE_URL}?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Hebcal data (${response.status})`);
    }
    return (await response.json()) as HebcalResponse;
  } catch (error) {
    console.warn("Unable to load holiday calendar", error);
    return {};
  }
};

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const collectDateKeysInRange = (start: Date, end: Date) => {
  const keys = new Set<string>();
  const cursor = new Date(start);

  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    keys.add(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
};

const determineReason = (
  items: HebcalItem[],
  windowStart: Date,
  windowEnd: Date
): { reason: RestrictionReason; title: string; subtitle?: string } => {
  const rangeKeys = collectDateKeysInRange(windowStart, windowEnd);

  const relevantHoliday = items.find((item) => {
    if (!item.yomtov) return false;
    if (!item.date) return false;
    const key = item.date.split("T")[0];
    if (!key) return false;
    return rangeKeys.has(key);
  });

  if (relevantHoliday) {
    return {
      reason: "yomtov",
      title: relevantHoliday.hebrew ?? relevantHoliday.title ?? "חג",
      subtitle: relevantHoliday.title,
    };
  }

  return {
    reason: "shabbat",
    title: "שבת",
    subtitle: Platform.OS === "ios" ? "Shabbat" : undefined,
  };
};

const buildRestrictionWindows = (items: HebcalItem[]): RestrictionInfo[] => {
  const sortedCandles = items
    .filter((item) => item.category === "candles")
    .map((item) => ({ ...item, parsedDate: parseDate(item.date) }))
    .filter((item): item is HebcalItem & { parsedDate: Date } =>
      isValidDate(item.parsedDate)
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const sortedHavdalah = items
    .filter((item) => item.category === "havdalah")
    .map((item) => ({ ...item, parsedDate: parseDate(item.date) }))
    .filter((item): item is HebcalItem & { parsedDate: Date } =>
      isValidDate(item.parsedDate)
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  if (sortedCandles.length === 0 || sortedHavdalah.length === 0) {
    return [];
  }

  const windows: RestrictionInfo[] = [];
  let havdalahCursor = 0;

  for (const candle of sortedCandles) {
    while (
      havdalahCursor < sortedHavdalah.length &&
      sortedHavdalah[havdalahCursor].parsedDate.getTime() <=
        candle.parsedDate.getTime()
    ) {
      havdalahCursor += 1;
    }

    if (havdalahCursor >= sortedHavdalah.length) {
      break;
    }

    const havdalah = sortedHavdalah[havdalahCursor];
    const { reason, title, subtitle } = determineReason(
      items,
      candle.parsedDate,
      havdalah.parsedDate
    );

    windows.push({
      reason,
      title,
      subtitle,
      start: candle.parsedDate,
      end: havdalah.parsedDate,
    });
  }

  return windows;
};

const findNextCheckDelay = (now: Date, windows: RestrictionInfo[]): number => {
  const upcomingStart = windows
    .map((window) => window.start.getTime())
    .filter((timestamp) => timestamp > now.getTime())
    .sort((a, b) => a - b)[0];

  if (!upcomingStart) {
    return 60 * MS_IN_MINUTE; // refresh every hour if no known upcoming window
  }

  const delta = upcomingStart - now.getTime();

  if (delta <= 15 * MS_IN_MINUTE) {
    return 5 * MS_IN_MINUTE; // check more frequently shortly before restriction
  }

  return Math.min(delta, 2 * MS_IN_HOUR);
};

export const fetchCurrentRestriction = async (
  referenceDate = new Date()
): Promise<RestrictionResult> => {
  const windowStart = new Date(referenceDate.getTime() - 3 * MS_IN_DAY);
  const windowEnd = new Date(referenceDate.getTime() + 5 * MS_IN_DAY);

  const mockRestriction = {
    reason: "shabbat" as const,
    title: "שבת",
    subtitle: "Shabbat",
    start: new Date(),
    end: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
  };

  return { restriction: mockRestriction, nextCheckAfterMs: 3600000 };

  const calendar = await fetchCalendarWindow(windowStart, windowEnd);
  const items = calendar.items ?? [];
  const windows = buildRestrictionWindows(items);

  if (windows.length === 0) {
    return { restriction: null, nextCheckAfterMs: 60 * MS_IN_MINUTE };
  }

  const now = referenceDate.getTime();
  const activeWindow = windows.find(
    (window) => now >= window.start.getTime() && now < window.end.getTime()
  );

  if (activeWindow) {
    const untilEnd = activeWindow.end.getTime() - now;
    const nextCheckAfterMs = Math.max(
      Math.min(untilEnd, 10 * MS_IN_MINUTE),
      MS_IN_MINUTE
    );
    return { restriction: activeWindow, nextCheckAfterMs };
  }

  return {
    restriction: null,
    nextCheckAfterMs: findNextCheckDelay(new Date(referenceDate), windows),
  };
};
