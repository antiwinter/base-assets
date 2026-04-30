import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fmtHuman } from "./types";

export type DisplayCurrency = "CNY" | "USD";

interface SettingState {
  displayCurrency: DisplayCurrency;
  currentYear: number;
  lastPath: string;
  /** When false, fixed assets are omitted from portfolio treemap, trend stack, net worth, and table. */
  showFixed: boolean;
  /** When false, debt is omitted from the portfolio treemap only (trend debt line unchanged). */
  showDebt: boolean;

  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setCurrentYear: (year: number) => void;
  setLastPath: (path: string) => void;
  setShowFixed: (show: boolean) => void;
  setShowDebt: (show: boolean) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      displayCurrency: "CNY",
      currentYear: new Date().getFullYear(),
      lastPath: "/",
      showFixed: true,
      showDebt: true,

      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      setCurrentYear: (year) => set({ currentYear: year }),
      setLastPath: (path) => set({ lastPath: path }),
      setShowFixed: (show) => set({ showFixed: show }),
      setShowDebt: (show) => set({ showDebt: show }),
    }),
    {
      name: "base-assets-settings",
      partialize: (state) => ({
        displayCurrency: state.displayCurrency,
        currentYear: state.currentYear,
        lastPath: state.lastPath,
        showFixed: state.showFixed,
        showDebt: state.showDebt,
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
