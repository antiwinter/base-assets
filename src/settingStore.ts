import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fmtHuman } from "./types";

export type DisplayCurrency = "CNY" | "USD";

interface SettingState {
  displayCurrency: DisplayCurrency;
  currentYear: number;
  lastPath: string;
  hideFixed: boolean;

  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setCurrentYear: (year: number) => void;
  setLastPath: (path: string) => void;
  setHideFixed: (hide: boolean) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      displayCurrency: "CNY",
      currentYear: new Date().getFullYear(),
      lastPath: "/",
      hideFixed: false,

      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      setCurrentYear: (year) => set({ currentYear: year }),
      setLastPath: (path) => set({ lastPath: path }),
      setHideFixed: (hide) => set({ hideFixed: hide }),
    }),
    {
      name: "base-assets-settings",
      partialize: (state) => ({
        displayCurrency: state.displayCurrency,
        currentYear: state.currentYear,
        lastPath: state.lastPath,
        hideFixed: state.hideFixed,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Formatting helpers — call these inside components (they read from the store
// snapshot passed in, so calling with `useSettingStore.getState()` is fine too)
// ---------------------------------------------------------------------------

function getSymbol(currency: DisplayCurrency): string {
  return currency === "CNY" ? "¥" : "$";
}

function getFmt(currency: DisplayCurrency): "east" | undefined {
  return currency === "CNY" ? "east" : undefined;
}

/** Format a number as currency with current display symbol. */
export function fmtCurrency({ v }: { v: number; unit?: string }): string {
  const { displayCurrency } = useSettingStore.getState();
  return `${getSymbol(displayCurrency)}${fmtHuman(v, getFmt(displayCurrency))}`;
}

/** Format just the number part (no symbol), honoring current display locale. */
export function fmtNum(v: number): string {
  const { displayCurrency } = useSettingStore.getState();
  return fmtHuman(v, getFmt(displayCurrency));
}

/** Return the current display symbol (¥ or $). */
export function getDisplaySymbol(): string {
  return getSymbol(useSettingStore.getState().displayCurrency);
}
