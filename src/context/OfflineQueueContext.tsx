import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  OfflineQueueSnapshot,
  initOfflineQueue,
  subscribeOfflineQueue,
  flushOfflineQueue,
} from '../services/offlineQueue';

interface OfflineQueueContextValue extends OfflineQueueSnapshot {
  flushNow: () => Promise<void>;
}

const defaultValue: OfflineQueueContextValue = {
  isOnline: true,
  isFlushing: false,
  actions: [],
  flushNow: async () => {},
};

const OfflineQueueContext = createContext<OfflineQueueContextValue>(defaultValue);

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<OfflineQueueSnapshot>({
    isOnline: true,
    isFlushing: false,
    actions: [],
  });

  useEffect(() => {
    const unsubscribeSnapshot = subscribeOfflineQueue(setSnapshot);
    let cleanupNetInfo: (() => void) | undefined;
    initOfflineQueue().then((cleanup) => {
      cleanupNetInfo = cleanup;
    });
    return () => {
      unsubscribeSnapshot();
      cleanupNetInfo?.();
    };
  }, []);

  const value: OfflineQueueContextValue = {
    ...snapshot,
    flushNow: flushOfflineQueue,
  };

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export const useOfflineQueue = () => useContext(OfflineQueueContext);
