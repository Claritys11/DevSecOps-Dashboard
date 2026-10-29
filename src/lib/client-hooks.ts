"use client";

import { useSyncExternalStore } from "react";

// A shared ticking clock: one interval for every RelativeTime on the page.
let now = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      now = Date.now();
      clockListeners.forEach((notify) => notify());
    }, 1_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** Current time, updated every second on the client; null during server render. */
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => now, () => null);
}

const noopSubscribe = () => () => {};

export function useOrigin() {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

const storageListeners = new Set<() => void>();

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A localStorage value that re-renders subscribers when it changes in this tab or another. */
export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    (listener) => {
      storageListeners.add(listener);
      window.addEventListener("storage", listener);
      return () => {
        storageListeners.delete(listener);
        window.removeEventListener("storage", listener);
      };
    },
    () => readStorage(key),
    () => null
  );
  const set = (next: string) => {
    try {
      localStorage.setItem(key, next);
    } catch {}
    storageListeners.forEach((notify) => notify());
  };
  return [value, set];
}
