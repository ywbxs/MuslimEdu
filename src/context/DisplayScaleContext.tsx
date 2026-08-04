import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'display_scale';

export interface DisplayScaleOption {
  key: string;
  label: string;
  value: number;
}

// React Native has no supported way to rescale every already-rendered Text
// view app-wide from JS without touching each screen, so instead of
// patching internals we visually zoom the whole rendered app via a single
// transform on the root (see DisplayScaleWrapper) - text, icons, spacing
// all grow/shrink together, applies instantly with zero per-screen changes.
export const DISPLAY_SCALE_OPTIONS: DisplayScaleOption[] = [
  { key: 'small', label: 'Small', value: 0.9 },
  { key: 'default', label: 'Default', value: 1 },
  { key: 'large', label: 'Large', value: 1.15 },
  { key: 'xlarge', label: 'Extra Large', value: 1.3 },
];

const DEFAULT_SCALE = 1;

interface DisplayScaleContextValue {
  scale: number;
  setScale: (value: number) => void;
}

const DisplayScaleContext = createContext<DisplayScaleContextValue>({
  scale: DEFAULT_SCALE,
  setScale: () => {},
});

export function DisplayScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState(DEFAULT_SCALE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        const parsed = saved ? Number(saved) : NaN;
        if (!Number.isNaN(parsed) && parsed > 0) setScaleState(parsed);
      })
      .catch(() => {});
  }, []);

  const setScale = (value: number) => {
    setScaleState(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => {});
  };

  const contextValue = useMemo(() => ({ scale, setScale }), [scale]);

  return <DisplayScaleContext.Provider value={contextValue}>{children}</DisplayScaleContext.Provider>;
}

export const useDisplayScale = () => useContext(DisplayScaleContext);
