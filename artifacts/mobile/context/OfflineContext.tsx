import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus, Platform } from "react-native";

const QUEUE_KEY = "offline_mutation_queue";

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  createdAt: number;
}

interface OfflineContextValue {
  isOnline: boolean;
  queuedCount: number;
  enqueue: (mutation: Omit<QueuedMutation, "id" | "createdAt">) => Promise<void>;
  flushQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  queuedCount: 0,
  enqueue: async () => {},
  flushQueue: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "https://mobile-pos-nexus.replit.app";
}

async function checkConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `${getApiBase()}/api/healthz`;
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function loadQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFlushingRef = useRef(false);
  const isOnlineRef = useRef(true);

  useEffect(() => {
    loadQueue().then(setQueue);
  }, []);

  const flushQueueInternal = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;
    try {
      const q = await loadQueue();
      if (q.length === 0) return;
      const base = getApiBase();
      const remaining: QueuedMutation[] = [];
      for (const item of q) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${base}${item.endpoint}`, {
            method: item.method,
            headers: { "Content-Type": "application/json" },
            body: item.body ? JSON.stringify(item.body) : undefined,
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }
      await saveQueue(remaining);
      setQueue(remaining);
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  const checkAndUpdate = useCallback(async () => {
    const online = await checkConnectivity();
    const wasOffline = !isOnlineRef.current;
    isOnlineRef.current = online;
    setIsOnline(online);
    if (wasOffline && online) {
      flushQueueInternal();
    }
  }, [flushQueueInternal]);

  useEffect(() => {
    checkAndUpdate();
    const interval = Platform.OS === "web" ? 15_000 : 20_000;
    intervalRef.current = setInterval(checkAndUpdate, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAndUpdate]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") checkAndUpdate();
    });
    return () => sub.remove();
  }, [checkAndUpdate]);

  const enqueue = useCallback(async (mutation: Omit<QueuedMutation, "id" | "createdAt">) => {
    const item: QueuedMutation = {
      ...mutation,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now(),
    };
    const current = await loadQueue();
    const updated = [...current, item];
    await saveQueue(updated);
    setQueue(updated);
  }, []);

  const flushQueue = useCallback(async () => {
    await flushQueueInternal();
  }, [flushQueueInternal]);

  return (
    <OfflineContext.Provider value={{ isOnline, queuedCount: queue.length, enqueue, flushQueue }}>
      {children}
    </OfflineContext.Provider>
  );
}
