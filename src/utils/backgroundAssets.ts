import { Background } from '../api/types';
import * as FileSystem from 'expo-file-system';

const DEFAULT_EXTENSION = 'jpg';

const PERMISSION_ERROR = 'MEDIA_LIBRARY_PERMISSION_DENIED';
const MODULE_UNAVAILABLE = 'MEDIA_LIBRARY_MODULE_UNAVAILABLE';

function extractExtensionFromMime(mime?: string) {
  if (!mime) return DEFAULT_EXTENSION;
  const [, subtype] = mime.split('/');
  return subtype ? subtype.toLowerCase() : DEFAULT_EXTENSION;
}

function createTempFileName(extension: string) {
  const timestamp = Date.now();
  return `${FileSystem.cacheDirectory}wallpaper-${timestamp}.${extension}`;
}

async function saveDataUri(image: string): Promise<string> {
  const match = image.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    throw new Error('INVALID_DATA_URI');
  }

  const [, mime, base64] = match;
  const extension = extractExtensionFromMime(mime);
  const targetPath = createTempFileName(extension);

  await FileSystem.writeAsStringAsync(targetPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return targetPath;
}

function isModuleUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('ExpoMediaLibrary') || message.includes('native module');
}

async function loadMediaLibrary() {
  try {
    const module = await import('expo-media-library');
    if (typeof module.getPermissionsAsync !== 'function') {
      throw new Error(MODULE_UNAVAILABLE);
    }
    return module;
  } catch (error) {
    if (isModuleUnavailable(error)) {
      throw new Error(MODULE_UNAVAILABLE);
    }
    throw error;
  }
}

async function downloadRemoteImage(imageUrl: string): Promise<string> {
  const sanitizedUrl = imageUrl.split('?')[0] ?? imageUrl;
  const extensionGuess = sanitizedUrl.split('.').pop();
  const extension =
    extensionGuess && extensionGuess.length <= 5 ? extensionGuess : DEFAULT_EXTENSION;
  const targetPath = createTempFileName(extension);

  const download = await FileSystem.downloadAsync(imageUrl, targetPath);
  return download.uri;
}

export async function ensureBackgroundLocalUri(background: Background): Promise<string> {
  if (!background.imageUrl) {
    throw new Error('BACKGROUND_IMAGE_MISSING');
  }

  const { imageUrl } = background;

  if (imageUrl.startsWith('file://')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('data:')) {
    return saveDataUri(imageUrl);
  }

  return downloadRemoteImage(imageUrl);
}

export async function saveBackgroundToCameraRoll(background: Background): Promise<string> {
  const mediaLibrary = await loadMediaLibrary();

  let permissions;
  try {
    permissions = await mediaLibrary.getPermissionsAsync();
  } catch (error) {
    if (isModuleUnavailable(error)) {
      throw new Error(MODULE_UNAVAILABLE);
    }
    throw error;
  }

  let status = permissions.status;

  if (status !== 'granted') {
    try {
      const request = await mediaLibrary.requestPermissionsAsync();
      status = request.status;
    } catch (error) {
      if (isModuleUnavailable(error)) {
        throw new Error(MODULE_UNAVAILABLE);
      }
      throw error;
    }
  }

  if (status !== 'granted') {
    throw new Error(PERMISSION_ERROR);
  }

  const localUri = await ensureBackgroundLocalUri(background);
  try {
    const asset = await mediaLibrary.createAssetAsync(localUri);
    return asset.uri;
  } catch (error) {
    if (isModuleUnavailable(error)) {
      throw new Error(MODULE_UNAVAILABLE);
    }
    throw error;
  }
}

export const BACKGROUND_ASSET_ERRORS = {
  permissionDenied: PERMISSION_ERROR,
  moduleUnavailable: MODULE_UNAVAILABLE,
};
