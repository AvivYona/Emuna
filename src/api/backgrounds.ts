import { fetchJson } from "./client";
import { Background } from "./types";
import { fallbackBackgrounds } from "../utils/fallbackData";

type BackgroundApiRecordBase = {
  filename?: string;
  thumbnailUrl?: string;
  dominantColor?: string;
  contentType?: string;
};

type BinaryBackgroundApiRecord = BackgroundApiRecordBase & {
  id: string;
  data: string;
  contentType?: string;
};

type HostedBackgroundApiRecord = BackgroundApiRecordBase & {
  _id: string;
  imageUrl: string;
};

type BackgroundApiRecord =
  | BinaryBackgroundApiRecord
  | HostedBackgroundApiRecord;

const DEFAULT_CONTENT_TYPE = "image/jpeg";

function buildDisplayName(record: BackgroundApiRecord): string | undefined {
  if (!record.filename) {
    return undefined;
  }

  const withoutExtension = record.filename.replace(/\.[^/.]+$/, "");
  const normalized = withoutExtension.replace(/[-_]+/g, " ").trim();

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

function toDataUri(base64: string, contentType?: string): string {
  const mime = contentType || DEFAULT_CONTENT_TYPE;
  return `data:${mime};base64,${base64}`;
}

function mapBackground(record: BackgroundApiRecord): Background | null {
  if ("imageUrl" in record) {
    const { _id, imageUrl } = record;

    if (!_id || !imageUrl) {
      return null;
    }

    const thumbnailUrl = record.thumbnailUrl ?? imageUrl;

    return {
      _id,
      imageUrl,
      filename: record.filename,
      contentType: record.contentType,
      thumbnailUrl,
      dominantColor: record.dominantColor,
      displayName: buildDisplayName(record),
    };
  }

  if ("data" in record) {
    const { id, data } = record;

    if (!id || !data) {
      return null;
    }

    const imageUrl = toDataUri(data, record.contentType);
    const thumbnailUrl = record.thumbnailUrl ?? imageUrl;

    return {
      _id: id,
      imageUrl,
      filename: record.filename ?? record.id,
      contentType: record.contentType,
      thumbnailUrl,
      dominantColor: record.dominantColor,
      displayName: buildDisplayName(record),
    };
  }

  return null;
}

function isBackground(
  value: Background | null
): value is Background {
  return value !== null;
}

export async function getBackgrounds(): Promise<Background[]> {
  try {
    const data = await fetchJson<BackgroundApiRecord[]>("/backgrounds");

    if (!Array.isArray(data)) {
      return fallbackBackgrounds;
    }

    const backgrounds = data.map(mapBackground).filter(isBackground);

    if (backgrounds.length === 0) {
      return fallbackBackgrounds;
    }

    return backgrounds;
  } catch (error) {
    console.warn('Error fetching backgrounds, using fallback data', error);
    return fallbackBackgrounds;
  }
}

export function getBackgroundDisplayName(background: Background): string {
  if (background.displayName && background.displayName.trim().length > 0) {
    return background.displayName;
  }

  if (background.filename) {
    const withoutExtension = background.filename.replace(/\.[^/.]+$/, "");
    const normalized = withoutExtension.replace(/[-_]+/g, " ").trim();
    if (normalized.length > 0) {
      return normalized;
    }
    return background.filename;
  }

  return "רקע מותאם";
}
