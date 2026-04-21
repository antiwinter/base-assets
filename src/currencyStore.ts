import { fmtHuman } from './types';

let _displaySymbol = '¥';

const SYMBOL_TO_FMT: Record<string, 'east' | undefined> = {
  '¥': 'east',
  '$': undefined,
};

export function setDisplayCurrency(symbol: string) {
  _displaySymbol = symbol;
}

export function getDisplaySymbol(): string {
  return _displaySymbol;
}

function getDisplayFmt(): 'east' | undefined {
  return SYMBOL_TO_FMT[_displaySymbol];
}

/** Format a number as currency with current display symbol; optional unit is reserved for conversion. */
export function fmtCurrency({ v }: { v: number; unit?: string }): string {
  return `${_displaySymbol}${fmtHuman(v, getDisplayFmt())}`;
}

/** Format just the number part (no symbol), honoring current display locale. */
export function fmtNum(v: number): string {
  return fmtHuman(v, getDisplayFmt());
}
