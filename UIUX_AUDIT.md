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

### 2.1 Page transitions (`src/components/PageStack.tsx`)
Every route change is **direction-aware**, like a native navigation stack — with exactly **one page in the DOM at a time**:

- **push** (going deeper, e.g. Campaigns → New campaign): the new page slides in from the right over the shell.
- **pop** (going back up): the page settles forward from underneath (96.5% → 100%, fading in).
- **lateral** (Today ⇄ New Sale ⇄ Customers ⇄ Meraj): the page slides in from the side you came from, tab-style.
- **fade**: unrelated cross-section jumps stay calm (opacity + 6px rise).
- **instant**: a gesture already played the hand-over under your finger, so the page mounts at rest instead of replaying an entrance.

Curves are the native deceleration `cubic-bezier(0.32, 0.72, 0, 1)`, and the container uses sticky-safe `overflow-x: clip` (no scrollbar flash, in-page sticky bars keep working).

> **Why not both pages at once?** The first cut of this system used
> `AnimatePresence mode="popLayout"` so the outgoing and incoming page
> painted simultaneously. That is what produced the **doubled / scrambled
> words** report: two full pages of text cross-fading on top of each
> other, and — after two quick taps — up to **three page nodes left
> permanently mounted** because AnimatePresence never fired the exit
> completion that unmounts them. Both are now impossible by construction:
> the route element is keyed by pathname with no presence wrapper, so
> React *replaces* the subtree instead of stacking it. Pinned by
> `PageStack.test.tsx`.

### 2.2 Gestures (`src/components/PageStack.tsx` + `src/lib/gestures.ts`)
On touch:

- **Lateral tab drag** — dragging a primary tab moves the page **1:1 under your finger** and reveals a branded preview of the neighbour (icon, name, position dots, quiet skeleton). Release past 30% of the width **or** fling (>520 px/s) and it commits seamlessly into the live route; release early and it springs home on the butter curve.
- **Edge swipe-back** — on any page deeper than the primary tabs, dragging in from the left 36px edge follows the thumb, dims the shell, shows a "Back" chip, and pops the stack on release. This is the item that was listed as a "next step" in the first cut; it ships now.
- **Rubber band** — dragging past the end of the tab ring resists (28% damping, 64px cap) and springs back instead of doing nothing.
- **Drawer ownership** — the left edge opens the sidebar drawer on primary tabs and means "back" on deeper pages; `useEdgeDrawer({ enabled })` and `classifyDrag()` read the same rule, so the two can never fight.
- **Drag-to-dismiss drawer** — the sidebar follows the thumb and dismisses on a decisive leftward drag, gliding home on the existing CSS transition otherwise.
- **Guard rails** (shared, unit-tested): a gesture never starts over a dialog, an overlay, an input, a horizontally-scrollable row, the nav, the drawer, or `data-no-swipe-nav`. Vertical intent always wins, so the page scrolls natively. Ghost clicks after a drag are swallowed.
- Pointer capture is taken **only after** the gesture is unambiguously horizontal, so a plain tap always reaches the button underneath.

> The peek layer deliberately does **not** copy the live page. The first
> cut froze `innerHTML` on leave and re-injected it: the copy lost its
> React bindings and kept mid-flight inline transforms, so charts, inputs
> and sticky bars painted scrambled — and the page's words existed twice
> in the DOM. A branded preview can neither duplicate nor scramble.

### 2.3 Direction model (`src/lib/butterNav.ts`)
A tiny, tested navigation graph: primary ring (bottom-nav order), section depth (primary = 0, section = 1, editor/detail = 2 incl. dynamic `/app/campaigns/:id`), `navDirection(from, to)` → `push | pop | lateral | fade | instant`, plus `canSwipeBack()` / `fallbackBackTarget()` for edge-gesture ownership.

### 2.4 App-wide motion contract
- **`<MotionConfig reducedMotion="user">`** at the root: the OS "reduce motion" setting turns every transform/layout animation into a fade, app-wide — no component can forget it.
- One default transition and one spring for the whole app; `src/components/motion.tsx` exports the shared variants (dialog, sheet, panel, backdrop) plus a fail-safe `Reveal` primitive.
- Entrances end on `transform: none`, so an animated ancestor never becomes a containing block for `fixed` children (modals, toasts, the bottom nav).
- `touch-action: manipulation` removes the ~300ms double-tap-zoom wait (pinch-zoom stays available), and every control answers the finger with a 3% give on the butter curve.

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
- **Performance:** drags write straight to the DOM (no React render per finger move, no motion-value frame loop); transitions are GPU transform/opacity only; the frozen-page snapshot store is gone, so leaving a page no longer serialises its DOM.
- **Testing:** the flow model, every gesture threshold and the transition invariants are unit-tested — including four gesture tests that drive real pointer events through a real router. Full suite: **569/569 passing**.

---

## 5. Recommended next steps (not in this PR)

1. **Art-direct the ex-dark pages** (AIBrain, Support, Subscription, ActivityLogs…) — the remap makes them correct; bespoke light-mode composition would make them *beautiful*.
2. ~~**Predictive back for sub-pages**~~ — ✅ shipped as edge swipe-back (§2.2).
3. **Card-group stagger on the remaining pages** — Dashboard now staggers its four blocks in at 60ms steps; the same `animate-rise-in` + `animationDelay` pattern can be applied page by page (verify the page has no `fixed` children first).
4. **Sound + haptics opt-in** — a tiny tick on swipe commit (`navigator.vibrate(8)`) would push the butter further; must be a setting.
5. **CaseStudy** — re-art-direct as an intentional dark story page.
6. **Empty states inventory** — migrate pages to the new action-capable `EmptyState` (API is backward compatible).
