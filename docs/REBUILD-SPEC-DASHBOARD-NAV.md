# Rebuild spec — Dashboard (second half), Sidebar, Bottom Nav — UI layers

**Status: pt.1 LIVE (pure modules + 30 tests, `cbee6cb`):** `src/lib/performanceSeries.ts`,
`src/lib/navSearch.ts` + tests. **Remaining: the UI layers below.**
If branch `arena/01a0910a-cashiea` (commit `8751602`) ever reaches GitHub, prefer merging it —
it is the fully built version (856 tests green on that agent's side).

## Token rule
Never hardcode hex. `#111827→text-fg` `#374151→text-fg-muted` `#6B7280→text-fg-subtle`
`#9CA3AF→text-fg-subtle/80` `#10B981→text-accent/text-positive` `#F3F4F6→border-surface-2`
cards `bg-surface` panels `bg-surface-2`. Reuse `formatINR()`, `.card`, `.btn-primary`,
`animate-rise-in`. Gotchas: no `card-none` utility; `@apply` classes can't be variant-prefixed
(write `lg:bg-transparent lg:shadow-none`); tests outside `src/` are silently skipped.

## Dashboard
1. **PerformanceCard** (bottom of Dashboard.tsx) replaces "Business Pulse" — purely financial:
   segmented Week/Month control (`role="group"`, pill container `rounded-full bg-surface-2 p-0.5`,
   active `bg-surface text-fg shadow-sm`, `aria-pressed`); Profit metric (links
   /app/profit-dashboard, green >0 / red <0 / neutral 0) + Pending Dues (links /app/invoices,
   amber when owed + 8px dot `bg-positive` clear / `bg-warning` owed); paired Sales/Expenses bars
   `h-28`, dashed gridlines 25/50/75%, hover AND tap tooltip, bar min-height 3%, current bucket
   full accent vs 50% others, each bar a `<button>` with aria-label (bucket + both amounts).
   `Loader2` while month loads. NO low-stock line.
2. **Week/Month must refetch**: week = the 7 RPC buckets (no query). Month = its OWN lazy query,
   once, on first switch: `transactions(created_at,total)` status completed ≥ monthStart +
   `expenses(date,amount,type)` type ≠ 'income', both `.limit(2000)`, `Promise.all`, `cancelled`
   flag. Month renders ~5 weekly buckets via `monthBuckets()`; headline from `rangeTotals()`
   on the SAME buckets (already shipped in performanceSeries.ts).
3. **Low stock — relocate, don't delete**: count bubble on the Auto-reorder tile
   (`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-warning`,
   aria-label `<count> items low on stock`). The stats array is never rendered as a grid —
   plain deletion would drop it from the dashboard.
4. **Recent Activity**: max 3 rows, name `text-sm font-semibold text-fg` + `truncate`,
   subtitle `toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})`
   `text-xs text-fg-subtle`, price right `font-bold tabular-nums shrink-0`,
   `border-b border-surface-2` between rows only. "View All" + ChevronRight when ≥1 row.
   Empty: "No sales yet today." + New Sale button.
5. **More Tools**: delete floating text tags → `grid-cols-4` .card tiles (40px icon chip
   `bg-surface-2`, 11px label): /app/cash-flow /app/reminders /app/goals /app/auto-reorder.

## Sidebar
- Headers: `px-3 mt-6 first:mt-0 mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-fg-subtle/80`.
  Items `text-[15px] font-medium text-fg-muted min-h-[42px] gap-3`; icons `w-5 h-5` strokeWidth 1.75.
  Meraj badge → `rounded-full px-2 py-0.5 text-[10px] font-bold bg-accent-soft text-accent-strong`.
  Profile divider `border-t border-surface-2`.
- **Search box below the logo, above nav**: Search icon absolute left `pointer-events-none`;
  input `h-9 pl-9 rounded-lg bg-surface-2 border-0 focus:ring-2 focus:ring-accent/40`
  placeholder "Search features...", Escape clears; hide when rail is collapsed.
  Filter via `filterNav()` (shipped) — synonyms match shopkeeper words (udhaar→Customers,
  maal→Products, bill→POS). While searching force "More Tools" open (`showMore || searching`);
  zero matches → "Nothing matches …" message. `countNav()` for the empty state.

## Bottom nav (root-screen only)
```ts
const showMobileNav = !isSubPage   // reuse AppLayout's flag — never a second route list
<BottomNav showMobile={showMobileNav} />
```
- `BottomNav({ showMobile = true })`; mobile nav className `${showMobile ? 'lg:hidden' : 'hidden'}`.
- Desktop dock stays always-on.
- `<main>` bottom padding conditional: `pb-[calc(env(safe-area-inset-bottom)+72px)]` shown,
  `+24px` hidden. Caveat: `isSubPage` = `pageHeaderName !== 'Cashiea'` — pages with the default
  title keep the bar; leave a comment.

## Tests + harness traps (from the building agent)
jsdom: bar hidden on sub-page AND back-arrow present (assert together); `<main>` padding differs;
Recent Activity capped at 3 + `.truncate`; no "Low Stock" inside PerformanceCard.
Mock `useAuth` with a MODULE-LEVEL constant (fresh objects loop effects → 5s timeouts).
Shim `matchMedia`, `IntersectionObserver`, `ResizeObserver`; Supabase stub needs `channel()`.
Query-builder stub: `then` must be a function resolving ONCE (a Proxy re-returning `then`
recurses). Key fixtures off selected columns, not call order. Green = tsc clean + tests +
build + eslint 0 on touched files.
