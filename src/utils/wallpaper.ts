import { NativeModules, Platform } from 'react-native';
import { Background } from '../api/types';
import { ensureBackgroundLocalUri } from './backgroundAssets';

type BackgroundTarget = 'home' | 'lock';

type WallpaperNativeModule = {
  setWallpaper(path: string, target: BackgroundTarget): Promise<void>;
};

const { WallpaperModule } = NativeModules;

const wallpaperModule = WallpaperModule as WallpaperNativeModule | undefined;

export async function applyWallpaper(
  background: Background,
  target: BackgroundTarget
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('applyWallpaper is only supported on Android devices');
  }

  if (!wallpaperModule) {
    throw new Error('Native wallpaper module unavailable');
  }

  const localUri = await ensureBackgroundLocalUri(background);
  await wallpaperModule.setWallpaper(localUri, target);
}
