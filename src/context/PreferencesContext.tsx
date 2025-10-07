import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, getBoolean, getString, removeItem, setBoolean, setString } from '../storage/preferencesStorage';
import { cancelDailyQuoteNotification, scheduleDailyQuoteNotification } from '../utils/notifications';

type BackgroundTarget = 'home' | 'lock';

type PreferencesState = {
  wantsQuotes?: boolean;
  favoriteAuthors: string[];
  notificationTime?: string;
  selectedBackground?: string;
  selectedBackgroundTarget?: BackgroundTarget;
  loaded: boolean;
};

type PreferencesContextValue = PreferencesState & {
  setWantsQuotes(value: boolean): void;
  setFavoriteAuthors(ids: string[]): void;
  setNotificationTime(time?: string): void;
  setSelectedBackground(id?: string, target?: BackgroundTarget): void;
  reset(): void;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const parseFavoriteAuthors = (value?: string) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as string[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.warn('שגיאה בקריאת מחברים מ-AsyncStorage', error);
    return [];
  }
};

const serializeFavoriteAuthors = (value: string[]) => JSON.stringify(value);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PreferencesState>({
    wantsQuotes: undefined,
    favoriteAuthors: [],
    notificationTime: undefined,
    selectedBackground: undefined,
    selectedBackgroundTarget: undefined,
    loaded: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const [wantsQuotes, favoriteAuthorsRaw, notificationTime, selectedBackground, selectedBackgroundTarget] = await Promise.all([
          getBoolean(STORAGE_KEYS.wantsQuotes),
          getString(STORAGE_KEYS.favoriteAuthors),
          getString(STORAGE_KEYS.notificationTime),
          getString(STORAGE_KEYS.selectedBackground),
          getString(STORAGE_KEYS.selectedBackgroundTarget),
        ]);

        if (!isMounted) return;

        setState({
          wantsQuotes,
          favoriteAuthors: parseFavoriteAuthors(favoriteAuthorsRaw),
          notificationTime: notificationTime ?? undefined,
          selectedBackground: selectedBackground ?? undefined,
          selectedBackgroundTarget: selectedBackgroundTarget === 'home' || selectedBackgroundTarget === 'lock' ? selectedBackgroundTarget : undefined,
          loaded: true,
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn('שגיאה בטעינת ההעדפות מ-AsyncStorage', error);
        setState((prev) => ({ ...prev, loaded: true }));
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const setWantsQuotes = useCallback((value: boolean) => {
    setBoolean(STORAGE_KEYS.wantsQuotes, value).catch((error) => {
      console.warn('שגיאה בשמירת העדפת ציטוטים ל-AsyncStorage', error);
    });
    setState((prev) => ({ ...prev, wantsQuotes: value }));
    if (!value) {
      cancelDailyQuoteNotification();
    }
  }, []);

  const setFavoriteAuthors = useCallback((ids: string[]) => {
    if (!ids.length) {
      removeItem(STORAGE_KEYS.favoriteAuthors).catch((error) => {
        console.warn('שגיאה במחיקת מחברים מ-AsyncStorage', error);
      });
    } else {
      setString(STORAGE_KEYS.favoriteAuthors, serializeFavoriteAuthors(ids)).catch((error) => {
        console.warn('שגיאה בשמירת מחברים מועדפים ל-AsyncStorage', error);
      });
    }
    setState((prev) => ({ ...prev, favoriteAuthors: ids }));
  }, []);

  const setNotificationTime = useCallback((time?: string) => {
    if (!time) {
      removeItem(STORAGE_KEYS.notificationTime).catch((error) => {
        console.warn('שגיאה במחיקת שעת התראה מ-AsyncStorage', error);
      });
    } else {
      setString(STORAGE_KEYS.notificationTime, time).catch((error) => {
        console.warn('שגיאה בשמירת שעת התראה ל-AsyncStorage', error);
      });
    }
    setState((prev) => ({ ...prev, notificationTime: time }));
  }, []);

  const setSelectedBackground = useCallback(
    (id?: string, target?: BackgroundTarget) => {
      if (!id) {
        Promise.all([
          removeItem(STORAGE_KEYS.selectedBackground),
          removeItem(STORAGE_KEYS.selectedBackgroundTarget),
        ]).catch((error) => {
          console.warn('שגיאה במחיקת רקע נבחר מ-AsyncStorage', error);
        });
        setState((prev) => ({ ...prev, selectedBackground: undefined, selectedBackgroundTarget: undefined }));
        return;
      }

      const nextTarget: BackgroundTarget = target ?? state.selectedBackgroundTarget ?? 'home';

      setString(STORAGE_KEYS.selectedBackground, id).catch((error) => {
        console.warn('שגיאה בשמירת רקע נבחר ל-AsyncStorage', error);
      });
      setString(STORAGE_KEYS.selectedBackgroundTarget, nextTarget).catch((error) => {
        console.warn('שגיאה בשמירת יעד רקע ל-AsyncStorage', error);
      });

      setState((prev) => ({ ...prev, selectedBackground: id, selectedBackgroundTarget: nextTarget }));
    },
    [state.selectedBackgroundTarget],
  );

  const reset = useCallback(() => {
    Promise.all([
      removeItem(STORAGE_KEYS.wantsQuotes),
      removeItem(STORAGE_KEYS.favoriteAuthors),
      removeItem(STORAGE_KEYS.notificationTime),
      removeItem(STORAGE_KEYS.selectedBackground),
      removeItem(STORAGE_KEYS.selectedBackgroundTarget),
    ]).catch((error) => {
      console.warn('שגיאה באיפוס ההעדפות ב-AsyncStorage', error);
    });
    setState({ wantsQuotes: undefined, favoriteAuthors: [], notificationTime: undefined, selectedBackground: undefined, selectedBackgroundTarget: undefined, loaded: true });
    cancelDailyQuoteNotification();
  }, []);

  useEffect(() => {
    if (!state.loaded) return;
    if (!state.wantsQuotes) return;
    if (!state.notificationTime) return;
    if (!state.favoriteAuthors.length) return;

    scheduleDailyQuoteNotification(state.notificationTime, state.favoriteAuthors).catch((error) => {
      console.warn('כישלון בתזמון התראה יומית', error);
    });
  }, [state.loaded, state.wantsQuotes, state.notificationTime, state.favoriteAuthors]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...state,
      setWantsQuotes,
      setFavoriteAuthors,
      setNotificationTime,
      setSelectedBackground,
      reset,
    }),
    [state, setFavoriteAuthors, setNotificationTime, setSelectedBackground, setWantsQuotes, reset],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('PreferencesContext לא מאותחל');
  }
  return context;
}
