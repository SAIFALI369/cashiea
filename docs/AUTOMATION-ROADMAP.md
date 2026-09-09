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
