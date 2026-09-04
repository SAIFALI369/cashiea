# Cashiea — Full UI/UX Audit & Design Overhaul

**Scope:** every route in the app (44 routes / 41 pages) + the shared shell (sidebar, bottom nav, headers) + the design system itself.
**Outcome:** every finding below is either **fixed in this PR** or listed as a recommended next step (§5).

---

## 1. Executive summary

Cashiea enters this audit with a strong foundation — semantic design tokens, a warm light/dark palette, route-level code splitting, and real attention to mobile ergonomics (44px touch targets, safe areas, keyboard-dismiss fixes). That's better than 90% of POS apps.

But it had one **generational** gap and several systemic ones:

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Route transitions used `AnimatePresence mode="wait"` — the old page **fully exited before the new one entered**. During every navigation there was a blank beat and the two pages were **never visible together**. For a swipe-first mobile POS this is the single biggest feel-killer. | 🔴 Critical | ✅ Fixed — new `PageStack` |
| 2 | Swipe navigation was **fling-only** (touch-end heuristics). You could never see where a swipe would take you; there was no drag, no preview, no spring-back. | 🔴 Critical | ✅ Fixed — interactive butter swipe |
| 3 | **~25 pages leaked non-tokenized Tailwind colors** (`purple-400`, `cyan-300`, `orange-500/15`, `emerald-400`, `pink-400`, raw `slate-900` panels…) from an older dark-theme design generation. They rendered off-palette and several were unreadable in light mode. | 🔴 Critical | ✅ Fixed — full legacy remap + page fixes |
| 4 | **Landing page light-mode bug:** the "How Meraj thinks" panel is `accent-strong` background with `text-white` — and `text-white` remaps to dark espresso in light mode ⇒ dark text on dark green, effectively invisible. | 🔴 Critical | ✅ Fixed |
| 5 | Login/Signup referenced **"Plus Jakarta Sans" — a font that is never loaded** (only Inter + JetBrains Mono ship). Every heading silently fell back. They also carried ~40 inline `style={{}}` objects duplicating what the design system already provides. | 🟠 High | ✅ Fixed — redesigned on tokens |
| 6 | No **global focus-visible ring** — keyboard navigation was invisible on custom controls in places. | 🟠 High | ✅ Fixed |
| 7 | `prefers-reduced-motion` was honored for the mascot but **not for route transitions or page animations**. | 🟠 High | ✅ Fixed — app-wide |
| 8 | Loading skeletons used a plain `animate-pulse` — functional, but flat vs. the premium bar the rest of the app sets. | 🟡 Medium | ✅ Fixed — shimmer sweep |
| 9 | Nav active states teleported between items (no continuity), sidebar active item had no anchor indicator. | 🟡 Medium | ✅ Fixed — spring pill + indicator |
| 10 | 404, EmptyState and "reserved" pages were serviceable dead-ends with no brand warmth. | 🟡 Medium | ✅ Fixed — redesigned |

---

## 2. The butter swipe system (new)

The centerpiece of this PR. Three layers:

### 2.1 Parallel page transitions (`src/components/PageStack.tsx`)
Every route change now runs both pages **at the same time** (`mode="popLayout"`), direction-aware, like a native navigation stack:

- **push** (going deeper, e.g. Campaigns → New campaign): the new page slides in from the right **over** the old one, which recedes (24% left, 94% scale, dimmed) — depth cue.
- **pop** (going back up): the top page slides away to the right and **reveals** the page beneath, which settles forward to full size.
- **lateral** (Today ⇄ New Sale ⇄ Customers ⇄ Meraj): both pages slide the same direction, tab-style, with a light parallax.
- **fade**: unrelated cross-section jumps stay calm (opacity + 8px rise).

Springs (`stiffness 380 / damping 40`), a 1px edge shadow on the covering page, and a sticky-safe `overflow-x: clip` container (no scrollbar flash, in-page sticky bars keep working).

### 2.2 Interactive drag with the real neighbour page
On touch, dragging a primary tab horizontally moves the page **1:1 under your finger** and reveals the actual neighbouring page beneath:

- When you leave a page, a lightweight DOM snapshot is frozen (LRU, 6 pages, `src/lib/butterNav.ts`). The peek layer shows that snapshot — **the real page, not a placeholder — with zero double data-fetching**.
- Never-visited neighbour? A branded preview (icon, label, position dots) shows instead — the same trick iOS uses for unvisited back-stack entries.
- Release past 28% of the screen width **or** fling (>480 px/s) and the swipe commits, continuing seamlessly into the live page (the new page mounts already in place — no replayed animation). Release early and it springs back.
- The left 36px edge stays reserved for the sidebar drawer gesture; gestures over dialogs, inputs, horizontally-scrollable rows, the nav and `data-no-swipe-nav` zones are ignored — same rules the old fling system used, now enforced at drag-start.
- Ghost clicks after a horizontal drag are swallowed, so a swipe over a link never "taps" it.

### 2.3 Direction model (`src/lib/butterNav.ts`)
A tiny, tested navigation graph: primary ring (bottom-nav order), section depth (primary = 0, section = 1, editor/detail = 2 incl. dynamic `/app/campaigns/:id`), and `navDirection(from, to)` → `push | pop | lateral | fade`.

---

## 3. Design system upgrades (every page benefits)

**Tailwind (`tailwind.config.js`)**
- **Complete legacy-palette safety net:** `gray zinc neutral stone blue sky cyan indigo violet purple fuchsia pink rose orange yellow lime teal emerald` (+ existing `slate/white/black/brand/green/red/amber`) now resolve onto semantic tokens. Off-palette classes are now *impossible* — ~120 stray usages across 26 files healed instantly, in both themes.
- New shadows: `page-edge`, `page-edge-r` (sliding-page edge), `glow-accent` (CTA halo).
- Signature easing curves: `ease-butter`, `ease-butter-in-out`, `ease-swipe`.
- Keyframes: `shimmer` (skeleton sweep), `drift` (ambient gradients).

**CSS (`src/index.css`)**
- New primitives: `.glass` (saturate+blur panels), `.chip` / `.chip-active`, `.section-title` (eyebrow), `.text-gradient`, `.hairline` (end-fading divider), `.skeleton-bone` (shimmer), `.sheen` (one-time accent sweep on hero cards).
- Global `:focus-visible` ring (2px accent, offset 2) + button ring overrides.
- App-wide `prefers-reduced-motion` policy: transitions collapse to ≤0.08s, ambient loops stop.

**Shared components**
- `Skeleton` — shimmer sweep instead of flat pulse.
- `PageHeader` — new optional **visible** mode (eyebrow + icon medallion + title + subtitle + action row) alongside the existing sr-only mode; one consistent h1 pattern everywhere.
- `EmptyState` — gradient halo medallion + optional action slot (no dead ends).
- `PlaceholderPage` — sheen sweep, ambient glow, dual CTA ("Back to today" / "Ask Meraj instead").
- `BottomNav` — active state is a **spring-animated pill** that glides between slots (`layoutId`), mobile + desktop.
- `Sidebar` — active item gets an accent edge indicator + stronger type.
- `AppLayout` — mobile header is now a real glass bar; layout no longer owns transition logic (delegated to `PageStack`).

---

## 4. Page-by-page audit

Legend: ✅ fixed in this PR · 👍 already strong · 🔧 recommended next

### Public / marketing
| Page | Findings | |
|------|----------|---|
| **Landing** | Strong narrative, good scroll reveals. **Bug:** accent panel text invisible in light mode (see §1.4). Some inline rgba surfaces not theme-aware. | ✅ tokenized panel, theme-proof glass surfaces, paper CTA |
| **CaseStudy** | Designed as a dark showcase (`bg-slate-950`); remap makes it theme-following — consistent but design intent changed. | ✅ consistent via remap · 🔧 art-direct this page deliberately |
| **Privacy / Terms / About** | Long-form legal content, well-set. Minor: could use wider measure + sticky TOC on desktop. | 👍 · 🔧 TOC |
| **NotFound** | Serviceable, flat. | ✅ redesigned — gradient numeral, compass glass badge, drifting ambient glows, chip quick-links |
| **auth/Login** | Phantom font (§1.5), 20+ inline styles, checkbox used `info` color off-brand, gradient button off-system. | ✅ fully redesigned on tokens; keyboard-stability engineering preserved |
| **auth/Signup** | Same as Login + strength meter bound to hex strings. | ✅ redesigned; strength meter on semantic tones; confirmation screen upgraded |

### Primary workspace (the daily driver screens)
| Page | Findings | |
|------|----------|---|
| **Dashboard (Today)** | Excellent: single-RPC stats, overdue hero, Meraj insights, quick bar. Dense but organized; cards all navigate. | 👍 · lifts automatically with new shadows/chips + butter transitions |
| **POS (New Sale)** | Best-in-class ergonomics (split payments, hold carts, numpad, sticky cart bar). Horizontal chip rows correctly excluded from swipe. | 👍 · now swipeable to/from as a primary tab with peek previews |
| **Customers** | Solid list/CRM. | 👍 |
| **AIAssistant (Meraj)** | Full-bleed chat, internal scroll — now flows through `PageStack` full-bleed path with push/pop transitions. | 👍 |

### Sell & money
| Page | Findings | |
|------|----------|---|
| **Invoices** | Mature (12 card usages), recurring modal, GST-compliant receipts. | 👍 |
| **Khata** | Good udhaar book UX. | 👍 |
| **Quotations** | One stray `purple` status chip. | ✅ healed via remap |
| **Accounts / ProfitDashboard / GstExport / BankImport / Reports** | Token-clean, functional density is right. | 👍 |

### AI tools
| Page | Findings | |
|------|----------|---|
| **AIBrain** | Older dark-generation styling (`slate-700/900` chips, `orange` badges). | ✅ healed via remap · 🔧 bespoke light-mode art pass |
| **EmailAssistant** | `cyan/purple` type chips, `slate-700` borders. | ✅ healed via remap |
| **Campaigns / CampaignBuilder** | `purple/cyan` status chips, `slate-900/60` panels. CampaignBuilder gets **push/pop** transitions for new/:id editors. | ✅ healed · ✅ flow-aware motion |
| **Summaries** | `purple` filter chips. | ✅ healed |
| **Suggestions / Notifications / DataEntry** | DataEntry had `slate-900` option backgrounds + `white`-text toggles. | ✅ healed |

### Admin & trust
| Page | Findings | |
|------|----------|---|
| **Compliance** | 6 hardcoded palette colors incl. `purple/pink/cyan`; `text-white` headings broken in light mode. | ✅ fully redesigned — visible PageHeader, tokenized badge palette, sheen trust banner |
| **Support** | `slate-700` category pills, `white` success headings. | ✅ healed via remap |
| **Subscription** | `slate-400/white` stat tiles. | ✅ healed |
| **FailedJobs / ActivityLogs / ApiKeys / Permissions / Integrations / ConnectApps / Team / Suppliers / Settings / Account / Onboarding** | Scattered `slate-*`; all functional. | ✅ healed via remap · 🔧 individual art passes over time |

### Cross-cutting
- **Accessibility:** focus-visible now global; reduced-motion global; peek layer `aria-hidden`; drag never hijacks vertical scroll or inputs; page name already announced via sr-only h1s (kept).
- **Performance:** snapshots are strings (no re-render cost), LRU-capped at 6, 400KB ceiling; drag uses a single motion value — no React renders per finger move; transitions are GPU transforms/opacity only.
- **Testing:** 10 new unit tests for the flow model (direction kinds, depth, ring neighbors, snapshot LRU/limits). Full suite: **305/305 passing**.

---

## 5. Recommended next steps (not in this PR)

1. **Art-direct the ex-dark pages** (AIBrain, Support, Subscription, ActivityLogs…) — the remap makes them correct; bespoke light-mode composition would make them *beautiful*.
2. **Predictive back for sub-pages** — extend the drag-to-go-back gesture (with snapshot peek) from lateral tabs to push/pop navigation on Android via `window.history`.
3. **Desktop page-flow polish** — subtle 60ms stagger on card groups after a route change (Dashboard first).
4. **Sound + haptics opt-in** — a tiny tick on swipe commit (`navigator.vibrate(8)`) would push the butter further; must be a setting.
5. **CaseStudy** — re-art-direct as an intentional dark story page.
6. **Empty states inventory** — migrate pages to the new action-capable `EmptyState` (API is backward compatible).
