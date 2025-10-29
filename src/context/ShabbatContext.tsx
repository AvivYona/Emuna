import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RestrictionInfo,
  fetchCurrentRestriction,
} from "../utils/shabbat";

type ShabbatContextValue = {
  loading: boolean;
  restriction: RestrictionInfo | null;
  refresh(): void;
};

const ShabbatRestrictionContext = createContext<ShabbatContextValue | null>(
  null
);

const INITIAL_STATE: ShabbatContextValue = {
  loading: true,
  restriction: null,
  refresh: () => {
    /* noop */
  },
};

export const ShabbatRestrictionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [restriction, setRestriction] =
    useState<RestrictionInfo | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearScheduledRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const refresh = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      }

      const result = await fetchCurrentRestriction();

      if (!isMountedRef.current) {
        return;
      }

      setRestriction(result.restriction);
      setLoading(false);
      clearScheduledRefresh();
      timeoutRef.current = setTimeout(() => {
        refresh(false);
      }, Math.max(result.nextCheckAfterMs, 60 * 1000));
    },
    [clearScheduledRefresh]
  );

  useEffect(() => {
    isMountedRef.current = true;
    refresh(true);

    return () => {
      isMountedRef.current = false;
      clearScheduledRefresh();
    };
  }, [clearScheduledRefresh, refresh]);

  const handleManualRefresh = useCallback(() => {
    refresh(true);
  }, [refresh]);

  const value = useMemo<ShabbatContextValue>(
    () => ({
      loading,
      restriction,
      refresh: handleManualRefresh,
    }),
    [handleManualRefresh, loading, restriction]
  );

  return (
    <ShabbatRestrictionContext.Provider value={value}>
      {children}
    </ShabbatRestrictionContext.Provider>
  );
};

export const useShabbatRestriction = () => {
  const context = useContext(ShabbatRestrictionContext);
  if (!context) {
    console.warn(
      "useShabbatRestriction was accessed outside of ShabbatRestrictionProvider"
    );
    return INITIAL_STATE;
  }
  return context;
};
