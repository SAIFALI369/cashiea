import { useState } from 'react'
import clsx from 'clsx'
import { MerajCharacter } from '../components/MerajCharacter'
import { MerajStateIcon } from '../components/MerajStateIcon'
import type {
  MerajCharState, MerajExpression, MerajPose, MerajAction, MerajView,
} from '../components/MerajCharacter'
import type { MerajState } from '../components/MerajStateIcon'

/**
 * MerajStudio — interactive showcase of Meraj's full-body mascot system.
 * Live states · expressions · poses · motion (walk/turn) · turnaround.
 */
function Chip<T extends string>({ value, options, onChange }: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            'px-3 py-1.5 rounded-control text-xs font-semibold transition-all',
            value === o.id
              ? 'bg-accent text-accent-fg shadow-sm'
              : 'bg-surface-2 text-fg-muted hover:text-fg'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stage({ children, label, hint }: { children: React.ReactNode; label?: string; hint?: string }) {
  return (
    <div className="card rounded-card p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-center min-h-[200px] py-2">{children}</div>
      {label && <p className="text-sm font-semibold text-fg mt-1">{label}</p>}
      {hint && <p className="text-xs text-fg-subtle text-center mt-0.5">{hint}</p>}
    </div>
  )
}

export default function MerajStudio() {
  const [state, setState] = useState<MerajCharState>('idle')
  const [expression, setExpression] = useState<MerajExpression>('neutral')
  const [pose, setPose] = useState<MerajPose>('idle')
  const [action, setAction] = useState<MerajAction>('idle')
  const [view, setView] = useState<MerajView>('front')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-accent mb-1">Character Studio</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight">Meraj Mascot</h1>
        <p className="text-sm text-fg-subtle mt-1.5 max-w-xl">
          The full-body chibi fox. Rust-orange fur, ice-blue eyes, tech goggles, glowing-cyan hoodie.
          Pick a state, expression, pose or motion — Meraj reacts in real time.
        </p>
      </header>

      {/* LIVE STAGE */}
      <div className="card rounded-card p-5 mb-6 overflow-hidden relative">
        <div className="absolute inset-x-0 -top-10 h-40 bg-accent-soft/40 blur-3xl pointer-events-none" />
        <div className="grid lg:grid-cols-2 gap-6 items-center relative">
          <div className="flex justify-center">
            <div className="w-44 sm:w-52 flex items-end justify-center">
              <MerajCharacter
                state={state}
                expression={expression}
                pose={pose}
                action={action}
                view={view}
                width={190}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Live state</p>
              <Chip<MerajCharState>
                value={state}
                onChange={setState}
                options={[
                  { id: 'idle', label: 'Idle' },
                  { id: 'listening', label: 'Listening' },
                  { id: 'userTyping', label: 'Thinking' },
                  { id: 'replying', label: 'Replying' },
                  { id: 'speaking', label: 'Speaking' },
                ]}
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Expression</p>
              <Chip<MerajExpression>
                value={expression}
                onChange={setExpression}
                options={[
                  { id: 'neutral', label: 'Neutral' },
                  { id: 'happy', label: 'Happy' },
                  { id: 'wink', label: 'Wink' },
                  { id: 'thinking', label: 'Thinking' },
                  { id: 'surprised', label: 'Surprised' },
                  { id: 'confident', label: 'Confident' },
                ]}
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Pose</p>
              <Chip<MerajPose>
                value={pose}
                onChange={setPose}
                options={[
                  { id: 'idle', label: 'Idle' },
                  { id: 'wave', label: 'Wave' },
                  { id: 'peace', label: 'Peace' },
                  { id: 'arms-crossed', label: 'Crossed' },
                  { id: 'presenting', label: 'Presenting' },
                ]}
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Motion</p>
              <Chip<MerajAction>
                value={action}
                onChange={setAction}
                options={[
                  { id: 'idle', label: 'Idle' },
                  { id: 'walk', label: 'Walk' },
                  { id: 'turn', label: 'Turn around' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* UI STATE ICONS */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-fg mb-3">UI state icons</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['idle', 'listening', 'thinking', 'speaking'] as MerajState[]).map((s) => (
            <Stage key={s} label={s[0].toUpperCase() + s.slice(1)}>
              <MerajStateIcon state={s} size={64} />
            </Stage>
          ))}
        </div>
      </section>

      {/* MOTION */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-fg mb-3">Motion</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stage label="Walking" hint="legs + arms swing · bob">
            <MerajCharacter action="walk" expression="happy" width={130} />
          </Stage>
          <Stage label="Turning around" hint="front → back → front">
            <MerajCharacter action="turn" width={130} />
          </Stage>
        </div>
      </section>

      {/* EXPRESSIONS */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-fg mb-3">Expression library</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(['neutral', 'happy', 'wink', 'thinking', 'surprised', 'confident'] as MerajExpression[]).map((e) => (
            <Stage key={e} label={e[0].toUpperCase() + e.slice(1)}>
              <MerajCharacter expression={e} bust width={104} />
            </Stage>
          ))}
        </div>
      </section>

      {/* POSES */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-fg mb-3">Gesture / pose library</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stage label="Wave" hint="one-arm raised">
            <MerajCharacter pose="wave" expression="happy" width={120} />
          </Stage>
          <Stage label="Peace" hint="finger-point + peace">
            <MerajCharacter pose="peace" expression="wink" width={120} />
          </Stage>
          <Stage label="Arms crossed" hint="confident">
            <MerajCharacter pose="arms-crossed" expression="confident" width={120} />
          </Stage>
          <Stage label="Presenting" hint="tablet / data card">
            <MerajCharacter pose="presenting" expression="happy" width={120} />
          </Stage>
        </div>
      </section>

      {/* TURNAROUND */}
      <section>
        <h2 className="text-sm font-bold text-fg mb-3">Turnaround</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stage label="Front"><MerajCharacter view="front" width={120} /></Stage>
          <Stage label="Side"><MerajCharacter view="side-right" width={120} /></Stage>
          <Stage label="Back"><MerajCharacter view="back" width={120} /></Stage>
        </div>
      </section>
    </div>
  )
}
