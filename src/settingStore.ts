import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fmtHuman } from "./types";

export type DisplayCurrency = "CNY" | "USD";
export type AppTab = "snapshot" | "cashflow";

interface SettingState {
  displayCurrency: DisplayCurrency;
  currentTab: AppTab;
  currentYear: number;

  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setCurrentTab: (tab: AppTab) => void;
  setCurrentYear: (year: number) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      displayCurrency: "CNY",
      currentTab: "snapshot",
      currentYear: new Date().getFullYear(),

      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      setCurrentTab: (tab) => set({ currentTab: tab }),
      setCurrentYear: (year) => set({ currentYear: year }),
    }),
    {
      name: "base-assets-settings",
      partialize: (state) => ({
        displayCurrency: state.displayCurrency,
        currentTab: state.currentTab,
        currentYear: state.currentYear,
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
