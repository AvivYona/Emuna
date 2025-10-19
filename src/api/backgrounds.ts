import { BASE_URL, fetchJson } from "./client";
import { Background } from "./types";

type BackgroundApiRecordBase = {
  id?: string;
  _id?: string;
  filename?: string;
  size?: number;
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

type LegacyBackgroundApiRecord = BackgroundApiRecordBase & {
  filename: string;
  id?: string;
  _id?: string;
};

type BackgroundApiRecord =
  | BinaryBackgroundApiRecord
  | HostedBackgroundApiRecord
  | LegacyBackgroundApiRecord;

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

function isHostedBackgroundRecord(
  record: BackgroundApiRecord
): record is HostedBackgroundApiRecord {
  return typeof (record as HostedBackgroundApiRecord).imageUrl === "string";
}

function isBinaryBackgroundRecord(
  record: BackgroundApiRecord
): record is BinaryBackgroundApiRecord {
  return typeof (record as BinaryBackgroundApiRecord).data === "string";
}

function mapBackground(record: BackgroundApiRecord): Background | null {
  if (isHostedBackgroundRecord(record)) {
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

  if (isBinaryBackgroundRecord(record)) {
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

  const identifier = record._id ?? record.id ?? record.filename;
  const filename = record.filename;

  if (!identifier || !filename) {
    return null;
  }

  const versionToken = record.size ? `?v=${record.size}` : "";
  const imageUrl = `${BASE_URL}/backgrounds/${encodeURIComponent(
    filename
  )}${versionToken}`;
  const thumbnailUrl = record.thumbnailUrl ?? imageUrl;

  return {
    _id: identifier,
    imageUrl,
    filename,
    contentType: record.contentType,
    thumbnailUrl,
    dominantColor: record.dominantColor,
    displayName: buildDisplayName(record),
  };
}

function isBackground(value: Background | null): value is Background {
  return value !== null;
}

export async function getBackgrounds(): Promise<Background[]> {
  try {
    const data = await fetchJson<BackgroundApiRecord[]>("/backgrounds");
    return data.map(mapBackground).filter(isBackground);
  } catch (error) {
    console.warn("Error fetching backgrounds", error);
    return [];
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
