// ════════════════════════════════════════════════════════════════
// Cashiea Design Tokens — the SINGLE source of truth.
// Every value the UI uses lives here (JS) and is mirrored to CSS
// variables / Tailwind in src/index.css + tailwind.config.js.
// After this point: no inline one-off magic numbers in components —
// pull from this scale (via Tailwind utilities or these consts).
// Reference register: Linear / Stripe / Notion — calm, structured, premium.
// ════════════════════════════════════════════════════════════════

// ── Spacing (4px base) ───────────────────────────────────────────
// Tailwind units: p-1=4 · p-2=8 · p-3=12 · p-4=16 · p-6=24 · p-8=32 · p-12=48
export const space = {
  px: 1, xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, '2xl': 48,
} as const

// ── Type scale (6 sizes) ─────────────────────────────────────────
// Display for hero/headlines, then 4 working sizes. Weights fixed per role.
export const type = {
  display: { size: '2.25rem', line: 1.1, weight: 700, tracking: '-0.02em' }, // hero headline
  h1:      { size: '1.5rem',  line: 1.2, weight: 700, tracking: '-0.015em' }, // page titles
  h2:      { size: '1.25rem', line: 1.3, weight: 600, tracking: '-0.01em' },  // section titles
  body:    { size: '0.9375rem', line: 1.55, weight: 400 },                    // default text
  small:   { size: '0.8125rem', line: 1.45, weight: 500 },                    // secondary / labels
  micro:   { size: '0.6875rem', line: 1.4, weight: 600, tracking: '0.06em' }, // overlines/eyebrows
} as const

// ── Radius (exactly 2) ───────────────────────────────────────────
// rounded-card   → cards, panels, sheets (16px — softer, premium)
// rounded-control → buttons, inputs, chips, icon tiles (12px — tighter, precise)
export const radius = { card: '1rem', control: '0.75rem' } as const

// ── Elevation (3 levels) ─────────────────────────────────────────
// shadow-soft (resting) · shadow-lift (hover) · shadow-float (overlays/FAB)
export const elevation = {
  soft: '0 1px 2px rgb(var(--shadow) / 0.04), 0 1px 3px rgb(var(--shadow) / 0.06)',
  lift: '0 4px 12px -2px rgb(var(--shadow) / 0.08), 0 2px 6px -2px rgb(var(--shadow) / 0.06)',
  float: '0 12px 32px -8px rgb(var(--shadow) / 0.16), 0 4px 12px -4px rgb(var(--shadow) / 0.08)',
} as const

// ── Semantic colors (beyond the ink/bronze brand pair) ───────────
// success/error/warning/info map to CSS vars; disabled is its own token.
export const semantic = {
  success: 'rgb(var(--positive) / <alpha-value>)',
  error:   'rgb(var(--negative) / <alpha-value>)',
  warning: 'rgb(var(--warning) / <alpha-value>)',
  info:    'rgb(var(--info) / <alpha-value>)',
  disabled:'rgb(var(--disabled) / <alpha-value>)',
} as const

// ── Touch + rhythm ───────────────────────────────────────────────
export const touch = { target: 44 } as const              // min hit area
export const rhythm = { sectionGap: 32, cardGap: 16 } as const // vertical rhythm

// ── Trust / sync states (cross-cutting) ──────────────────────────
export type SyncState = 'synced' | 'syncing' | 'offline'
export const syncLabel: Record<SyncState, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — queued',
}
