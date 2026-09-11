# Cashiea Automation — Build Plan v2

**Goal:** every automation page controls something that RUNS by itself — no fake promises.
Each page gets: a real toggle/rule, a visible run history, and delivery via WhatsApp/notification.
The owner approves anything that touches money or customers.

## Foundation (build first)

**`automation_rules` table (schema v32):**
```sql
create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,            -- reorder | reminders | recurring_expense | duplicate_scan | goal_pace | scorecard | social_post | snapshot | pricing
  config jsonb not null default '{}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz default now()
);
```
- **Executor:** `meraj-autopilot` already runs 3×/day per user (briefing 08:00, reminders 09:30, recap 21:00 IST). It becomes the rule engine: reads enabled rules each run, executes, writes `last_run_at`/`last_result`.
- **UI:** every page shows rule state with `StatusPill`, next run time, last result, and a run log — same Cashiea Signature components (StatStrip, DataToolbar, cards).

## Page-by-page (in build order)

1. **AutoReorder** — EXISTS: velocity-sized suggestions + manual draft PO.
   ADD: "Auto-draft at 8am" toggle (stores lead/cover from the page into the rule);
   page shows next run, last auto-draft, items auto-saved; one-tap **Send PO on WhatsApp**
   to the supplier (whatsapp-send edge function).

2. **Reminders** — EXISTS: policy-gated payment reminders in autopilot.
   ADD: per-invoice / per-customer reminder schedules (create, pause, preview message),
   send log with delivery status, executed by the 09:30 run.

3. **CashFlow** — ADD: recurring outflows (rent, salary, EMI — amount + day of month);
   autopilot records them automatically; page shows the next 30 days of scheduled
   outflows + "recorded automatically" history so cash reports stay accurate.

4. **Goals** — ADD: pace tracking — if a goal falls behind weekly pace, the morning
   briefing flags it + optional WhatsApp nudge; editable targets from the page.

5. **Snapshot** — EXISTS: daily-reports generation.
   ADD: auto-WhatsApp delivery of the evening snapshot (toggle), 7-day strip on page.

6. **Scorecard** — ADD: weekly score generated every Sunday 20:00 IST, stored with
   trend, shareable as a WhatsApp card.

7. **Social** — EXISTS: post drafting (Pexels + image gen + captions).
   ADD: content calendar + scheduled publishing (day/time per post) via autopilot.

8. **Pricing** — EXISTS: apply_price_changes tool + suggestions.
   ADD: review-once-apply-later (schedule date), margin guardrails before applying.

9. **Duplicates** — EXISTS: detection + one-tap merge.
   ADD: nightly auto-scan with exact-match auto-merge policy + audit log entry;
   fuzzy matches always wait for owner approval.

## Rules of engagement
- Money/customer-facing actions: autopilot DRAFTS, owner approves (exception: policy-gated
  reminders, which the owner already configured).
- Every rule shows its full run history — trust comes from receipts.
- Same design system everywhere; mobile-first (owner uses a phone).

---

# The Employee Build — detailed specs (locked 2026-09-10)

## 1. Vasooli Round (chase-all-pending) — the one that carries the rest
- Name: test "Vasooli Round" vs 2-3 alternatives on the first 50 users (their Bihar ear wins).
- Tone tiers: 0-7d soft convenience nudge + UPI link · 8-20d neutral factual (amount + UPI) ·
  20+ direct but respectful, SIGNED with the owner's name. Never collections-agency energy.
- Language per-customer, set once (Hinglish default; Hindi, Bhojpuri register, English).
- Never sends blind: prepare → show exact message per customer → owner confirms → send → summarize.
- Manual override: "don't chase Sharma ji yet" skip list.
- BRAIN SHIPPED: src/lib/vasooli.ts + 14 tests (tiers, languages, UPI deep-links,
  owner signature, no-exclamation copy rule, skip list, never-blind filters).
- WhatsApp economics (engineering constraint): outside the 24h window, sends must use
  APPROVED templates — file as UTILITY (≈₹0.115/msg India), NEVER marketing (≈₹0.86,
  7-8x cost gap). Templates = fixed {{name}}/{{amount}}/{{days}}/{{shop}}/{{owner}}/
  {{upi_link}} slots — the strings in vasooli.ts are written to be fileable as-is.
  Meraj picks tier + fills variables; never free-generates outbound copy.
  Meta revises rates ~6-monthly — verify with the BSP (Interakt/AiSensy, ₹999-1500/mo).
- NEXT: Reminders-page UI (draft list + per-customer confirm), customers.language column,
  template registration with chosen BSP, automation_events receipt per round.

## 2. Snap & Stock — beat "reads the invoice"
- Photo → line items → fuzzy SKU match by name similarity (distributors abbreviate).
- New SKUs flagged for one-tap confirm, never silently created.
- Price suggestion AS A RANGE WITH REASONING: "cost ₹42, similar items sell ₹58-65, suggest ₹60".
- Low-confidence reads (blur/handwriting) flagged for manual check — one wrong stock number
  poisons trust in every Meraj feature.

## 3. The 9pm Money Report (Meraj's end-of-day report — no exclamation marks)
Exact shape: "Aaj: ₹4,200 sales, ₹1,150 profit, ₹800 collected.
Kal call karna hai: Ramesh ji (₹600, 12 din se baaki), Sunita ji (₹350, 3 din se baaki).
Aaj maine 3 reminder bheje, 1 restock draft banaya."
Last line = trust + audit trail. Wire into meraj-recap (21:00 IST cron, already live).

## 4. Khata Guard (smart credit limits) — the defensible one
- Track per customer: avg days-to-clear, longest overdue stretch, highest balance carried.
- On extending udhaar past the computed safe cap, interrupt with number + reason:
  "Ramesh ji ne pichhli 3 baar 15+ din liye hain, is baar ₹2,000 se zyada mat dena."
  Never a bare red flag.

## 5. Restock draft — the switching-cost moat
- Low stock → draft WhatsApp order to the SKU's distributor on file, in that distributor's
  usual language/format → owner taps send. Six months in, the distributor relationships
  live inside Cashiea.

## Perceived value layer
- Hero counter on Today screen (corner, don't disturb layout): "Meraj recovered ₹12,400
  this month" — computed from automation_events money_impact. FREE tier.
- In-app daily digest line on dashboard: "I sent 6 reminders, flagged 1 risky credit,
  drafted your restock." (Command Center log already records everything.)
- Branded everything: shop name + logo on bills, reminders, storefront QR.
- UX fixes: legend for green status dots (product cards + Pending Dues card);
  labels/tooltips for the 4 mystery POS icons.
