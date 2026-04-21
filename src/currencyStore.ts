import { fmtHuman } from './types';

let _symbol = '¥';
let _fmt: 'east' | undefined = 'east';

export function setCurrencyLocale(symbol: string, fmt: 'east' | undefined) {
  _symbol = symbol;
  _fmt = fmt;
}

export function getCurrencySymbol(): string {
  return _symbol;
}

/** Format a number as a full currency string, e.g. ¥1.5w or $1.5k */
export function fmtCurrency(v: number): string {
  return `${_symbol}${fmtHuman(v, _fmt)}`;
}

/** Format just the number part (no symbol), honouring the current locale format */
export function fmtNum(v: number): string {
  return fmtHuman(v, _fmt);
}
