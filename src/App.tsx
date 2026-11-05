import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { FiberScene } from './Scene'
import { Quiz } from './Quiz'
import {
  DIFF_COLOR, DIFF_LABEL, NODE_META, SCENARIOS, STAGE_INFO, STAGE_SEQ,
  reconcileOrder, stageIndex,
} from './model'
import type { DiffStatus, Stage } from './model'

const RUN_STAGES: Stage[] = ['trigger', 'render', 'reconcile', 'commit', 'paint']

const NEXT_LABEL: Record<Stage, string> = {
  idle: '▶ RUN — fire the state change',
  trigger: 'NEXT → 2 · render phase',
  render: 'NEXT → 3 · reconciliation',
  reconcile: 'NEXT → 4 · commit',
  commit: 'NEXT → 5 · browser paint',
  paint: '■ finish cycle',
  done: '↺ REPLAY',
}

export default function App() {
  const [scenarioId, setScenarioId] = useState('test-count')
  const [stage, setStage] = useState<Stage>('idle')
  const [tick, setTick] = useState(0)
  const [unlocked, setUnlocked] = useState(false)

  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId)!, [scenarioId])

  // deterministic per-stage animation clock (drives node reveals, diff scan, commit steps)
  useEffect(() => {
    setTick(0)
    const conf: Partial<Record<Stage, [number, number]>> = {
      render: [400, 4],
      reconcile: [850, reconcileOrder(scenario).length],
      commit: [1100, scenario.commitOps.length],
    }
    const c = conf[stage]
    if (!c) return
    const [ms, max] = c
    const ivl = window.setInterval(() => setTick((t) => Math.min(t + 1, max)), ms)
    return () => window.clearInterval(ivl)
  }, [stage, scenario])

  useEffect(() => {
    if (stage === 'done') setUnlocked(true)
  }, [stage])

  const running = stage !== 'idle' && stage !== 'done'
  const advance = () => setStage(stage === 'done' ? 'idle' : STAGE_SEQ[stageIndex(stage) + 1])

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-emerald-900/50 px-6 py-4">
        <h1 className="text-xl tracking-[0.25em] text-emerald-300 glow-text">▓ FIBER JOURNEY</h1>
        <span className="text-xs text-emerald-600">
          trigger → render → reconcile → commit → paint · React's update cycle, made visible
        </span>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── 3D viewport ── */}
        <div className="relative h-[62vh] min-h-[500px] overflow-hidden rounded-lg border border-emerald-900/60 bg-black/70">
          <Canvas camera={{ position: [0, 0.4, 11.8], fov: 50 }} dpr={[1, 2]}>
            <color attach="background" args={['#030706']} />
            <FiberScene stage={stage} scenario={scenario} tick={tick} />
            <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
          </Canvas>

          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-3 rounded bg-black/70 px-3 py-2 text-[10px] uppercase tracking-widest">
            {(['unchanged', 'updated', 'added', 'deleted', 'bailed'] as DiffStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5" style={{ color: DIFF_COLOR[s] }}>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: DIFF_COLOR[s], boxShadow: `0 0 6px ${DIFF_COLOR[s]}` }}
                />
                {DIFF_LABEL[s]}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] text-emerald-700">
            drag to orbit · scroll to zoom
          </div>
        </div>

        {/* ── control / explanation panel ── */}
        <aside className="flex flex-col gap-4">
          <div className="flex items-center gap-1 text-[10px] tracking-widest">
            {RUN_STAGES.map((s, i) => {
              const active = stage === s
              const passed = stageIndex(stage) > stageIndex(s)
              return (
                <div
                  key={s}
                  className={`flex-1 rounded border px-1 py-1.5 text-center uppercase transition-colors duration-300 ${
                    active
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 glow-text'
                      : passed
                        ? 'border-emerald-700 bg-emerald-950/40 text-emerald-500'
                        : 'border-emerald-900/60 text-emerald-800'
                  }`}
                >
                  {i + 1}·{s === 'reconcile' ? 'diff' : s}
                </div>
              )
            })}
          </div>

          <div className="min-h-[280px] rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4">
            <h2 className="mb-2 text-sm tracking-[0.2em] text-cyan-300 glow-text">{STAGE_INFO[stage].title}</h2>
            {STAGE_INFO[stage].body.split('\n\n').map((p, i) => (
              <p key={i} className="mb-2 text-[13px] leading-relaxed text-emerald-100/90">
                {p}
              </p>
            ))}
            {scenario.notes[stage] && (
              <p className="mt-3 border-l-2 border-cyan-500/60 pl-2 text-[13px] leading-relaxed text-cyan-200/90">
                » this run: {scenario.notes[stage]}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-emerald-900/60 p-4">
            <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-500">
              choose the state change{running && ' — locked while running'}
            </h3>
            <div className="grid gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  disabled={running}
                  onClick={() => {
                    setScenarioId(s.id)
                    setStage('idle')
                  }}
                  className={`rounded border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    s.id === scenarioId
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-emerald-900/70 text-emerald-400 hover:border-emerald-600'
                  }`}
                >
                  <span className="text-emerald-300">{NODE_META[s.trigger].label}</span> — {s.label}
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-emerald-600">{s.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={advance}
              className="flex-1 rounded border border-cyan-500/70 bg-cyan-950/50 px-4 py-3 text-sm tracking-widest text-cyan-200 glow-text transition-colors hover:bg-cyan-900/50"
            >
              {NEXT_LABEL[stage]}
            </button>
            {running && (
              <button
                onClick={() => setStage('idle')}
                className="rounded border border-emerald-900 px-3 text-xs text-emerald-600 hover:border-emerald-600"
              >
                RESET
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* ── the exam ── */}
      <section className="border-t border-emerald-900/50 p-6">
        <Quiz unlocked={unlocked} />
      </section>

      <footer className="border-t border-emerald-900/50 px-6 py-3 text-[10px] text-emerald-800">
        fiber journey · render → reconcile → commit, one honest mental model · everything runs locally, nothing leaves this page
      </footer>
    </div>
  )
}
