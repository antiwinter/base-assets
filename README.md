# Todos
- [x] remember tabs & settings in local storage
- [ ] treemap for cashflow of current month (maybe in drawer?)
- [ ] enhance snapshot lvl2 treemap: grind to account; different colors for w//w/o interest, $BTC/$ETH/$U interest/$U/others, debt with different APR; net worth of current cat;

## Snapshot account categories

Rows in the `data` table are classified for portfolio totals (`fiat` / `digital` / `stock` / `fixed` / `debt`) using [`categorizeAccount`](src/hooks/portfolioUtils.ts) with the **accounts** table’s `platform` → `type`. **First matching rule wins** (order matters):

1. **`debt`** — account name is `debt` or `loan` (case-insensitive).
2. **`stock`** — account name is `stock` or **`fund`**, or the unit contains `/` (e.g. `NASDAQ/ICG`).
3. **`digital`** — unit starts with `$` (e.g. `$BTC`), or platform type is `ex`.
4. **`fixed`** — platform type is `fixed`.
5. **`fiat`** — everything else.
