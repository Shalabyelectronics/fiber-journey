import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  COLORS, DIFF_COLOR, DIFF_LABEL, FIBER_BASE, NODE_META,
  domLayout, hasP3, reconcileOrder, stageIndex, treeLayout,
} from './model'
import type { DiffStatus, NodeId, Scenario, Stage, Vec3 } from './model'

type Pulse = 'slow' | 'fast' | undefined

interface SceneProps {
  stage: Stage
  scenario: Scenario
  /** per-stage animation counter, driven by App (deterministic, state-based) */
  tick: number
}

// ── a glowing sphere node with a monospace HTML label ─────────────────────
function GlowNode(props: {
  pos: Vec3
  label: string
  sub?: string
  subColor?: string
  color: string
  intensity: number
  scale: number
  pulse?: Pulse
  wire?: boolean
}) {
  const { pos, label, sub, subColor, color, intensity, scale, pulse, wire } = props
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const target = useMemo(() => new THREE.Color(color), [color])
  useFrame(({ clock }) => {
    if (!mesh.current || !mat.current) return
    const s = mesh.current.scale.x + (scale - mesh.current.scale.x) * 0.14
    mesh.current.scale.setScalar(s)
    mesh.current.visible = s > 0.03
    mat.current.color.lerp(target, 0.16)
    mat.current.emissive.lerp(target, 0.16)
    let i = intensity
    if (pulse === 'slow') i = intensity * (1 + 0.7 * Math.sin(clock.elapsedTime * 5))
    if (pulse === 'fast') i = intensity * (1 + 0.8 * Math.sin(clock.elapsedTime * 13))
    mat.current.emissiveIntensity += (Math.max(i, 0.05) - mat.current.emissiveIntensity) * 0.2
  })
  return (
    <group position={pos}>
      <mesh ref={mesh} scale={0.01}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.35}
          metalness={0.1}
          wireframe={wire}
          transparent
          opacity={wire ? 0.75 : 1}
        />
      </mesh>
      {scale > 0.05 && (
        <Html center position={[0, -0.72, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className="node-label">
            {label}
            {sub && (
              <div className="node-sub" style={{ color: subColor ?? '#a7f3d0' }}>
                {sub}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ── a real-DOM box in the bottom row ───────────────────────────────────────
function DomBox(props: {
  pos: Vec3
  label: string
  color: string
  intensity: number
  scale: number
  pulse?: Pulse
}) {
  const { pos, label, color, intensity, scale, pulse } = props
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const target = useMemo(() => new THREE.Color(color), [color])
  useFrame(({ clock }) => {
    if (!mesh.current || !mat.current) return
    const s = mesh.current.scale.x + (scale - mesh.current.scale.x) * 0.14
    mesh.current.scale.setScalar(s)
    mesh.current.visible = s > 0.03
    mat.current.color.lerp(target, 0.16)
    mat.current.emissive.lerp(target, 0.16)
    let i = intensity
    if (pulse === 'fast') i = intensity * (1 + 0.9 * Math.sin(clock.elapsedTime * 13))
    if (pulse === 'slow') i = intensity * (1 + 0.5 * Math.sin(clock.elapsedTime * 6))
    mat.current.emissiveIntensity += (Math.max(i, 0.05) - mat.current.emissiveIntensity) * 0.2
  })
  return (
    <group position={pos}>
      <mesh ref={mesh} scale={0.01}>
        <boxGeometry args={[1.45, 0.6, 0.34]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.2} roughness={0.4} />
      </mesh>
      {scale > 0.05 && (
        <Html center position={[0, -0.62, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className="node-label" style={{ fontSize: 11 }}>{label}</div>
        </Html>
      )}
    </group>
  )
}

// ── a commit "packet" flying from a fiber node down to the real DOM ────────
function Packet(props: { from: Vec3; to: Vec3; active: boolean; color: string }) {
  const { from, to, active, color } = props
  const ref = useRef<THREE.Mesh>(null)
  const start = useRef<number | null>(null)
  useFrame(() => {
    if (!ref.current) return
    if (!active) {
      ref.current.visible = false
      start.current = null
      return
    }
    if (start.current === null) start.current = performance.now()
    const p = Math.min((performance.now() - start.current) / 900, 1)
    ref.current.visible = p < 1
    ref.current.position.set(
      from[0] + (to[0] - from[0]) * p,
      from[1] + (to[1] - from[1]) * p + Math.sin(p * Math.PI) * 0.6,
      from[2] + (to[2] - from[2]) * p,
    )
  })
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ── parent→child connector lines for one tree ──────────────────────────────
function TreeEdges(props: { pos: Partial<Record<NodeId, Vec3>>; ids: NodeId[]; color: string }) {
  const { pos, ids, color } = props
  return (
    <>
      {ids.map((id) => {
        const p = NODE_META[id].parent
        if (!p || !ids.includes(p) || !pos[id] || !pos[p]) return null
        return <Line key={id} points={[pos[p]!, pos[id]!]} color={color} lineWidth={1} />
      })}
    </>
  )
}

// ── the full scene ──────────────────────────────────────────────────────────
export function FiberScene({ stage, scenario, tick }: SceneProps) {
  const si = stageIndex(stage)
  const RENDER = stageIndex('render')
  const COMMIT = stageIndex('commit')
  const PAINT = stageIndex('paint')
  const DONE = stageIndex('done')

  const vpos = useMemo(() => treeLayout(scenario, -4.4), [scenario])
  const fpos = useMemo(() => treeLayout(scenario, 4.4), [scenario])
  const dpos = useMemo(() => domLayout(scenario), [scenario])
  const order = useMemo(() => reconcileOrder(scenario), [scenario])
  const p3 = hasP3(scenario)

  const statusOf = (id: NodeId): DiffStatus =>
    scenario.diff[id] ?? (scenario.rerenders.includes(id) ? 'unchanged' : 'bailed')
  const revealed = (id: NodeId) => si >= COMMIT || (stage === 'reconcile' && tick > order.indexOf(id))
  const depth = (id: NodeId) => (id === 'app' ? 0 : id === 'test' ? 1 : id === 'main' ? 2 : 3)
  const opIndex = (id: NodeId) => scenario.commitOps.findIndex((o) => o.node === id)
  const opDone = (id: NodeId) => {
    const i = opIndex(id)
    if (i < 0) return false
    return si > COMMIT || (stage === 'commit' && tick > i)
  }
  const vdomShown = si >= RENDER

  // LEFT — new virtual DOM (appears during render phase)
  const vdomNodes = scenario.vdomNodes.map((id) => {
    const st = statusOf(id)
    const isRe = scenario.rerenders.includes(id)
    const built = vdomShown && (stage !== 'render' || tick >= depth(id))
    const rev = revealed(id)
    const color = rev ? DIFF_COLOR[st] : isRe ? COLORS.vdomBase : DIFF_COLOR.bailed
    const dim = si >= COMMIT
    return (
      <GlowNode
        key={'v' + id}
        pos={vpos[id]!}
        label={NODE_META[id].label}
        sub={
          rev
            ? DIFF_LABEL[st]
            : !isRe
              ? 'reused'
              : stage === 'render' && NODE_META[id].kind === 'component'
                ? 'fn called'
                : undefined
        }
        subColor={rev ? DIFF_COLOR[st] : '#64748b'}
        color={color}
        intensity={dim ? 0.35 : isRe ? 1.1 : 0.3}
        scale={built ? (isRe ? 1 : 0.78) : 0}
      />
    )
  })

  // LEFT — red markers for nodes MISSING from the new vdom (deletions)
  const ghostNodes = order
    .filter((id) => !scenario.vdomNodes.includes(id))
    .map((id) => (
      <GlowNode
        key={'gv' + id}
        pos={vpos[id]!}
        label={NODE_META[id].label}
        sub="deleted"
        subColor={DIFF_COLOR.deleted}
        color={DIFF_COLOR.deleted}
        intensity={0.9}
        scale={vdomShown && revealed(id) ? 0.55 : 0}
        wire
      />
    ))

  // RIGHT — persistent fiber tree
  const fiberNodes = FIBER_BASE.map((id) => {
    const st = statusOf(id)
    const rev = revealed(id)
    const gone = st === 'deleted' && opDone(id)
    let color = COLORS.fiberBase
    let intensity = 0.8
    let pulse: Pulse
    let sub: string | undefined
    if (stage === 'trigger' && id === scenario.trigger) {
      color = COLORS.pulse
      intensity = 1.6
      pulse = 'slow'
      sub = 'setState()'
    } else if ((stage === 'reconcile' || stage === 'commit') && rev) {
      color = DIFF_COLOR[st]
      intensity = st === 'unchanged' ? 0.55 : st === 'bailed' ? 0.35 : 1.25
      sub = DIFF_LABEL[st]
    }
    if (si >= PAINT) {
      color = COLORS.fiberBase
      intensity = 0.8
      sub = undefined
    }
    return (
      <GlowNode
        key={'f' + id}
        pos={fpos[id]!}
        label={NODE_META[id].label}
        sub={sub}
        subColor={stage === 'trigger' && id === scenario.trigger ? COLORS.pulse : DIFF_COLOR[st]}
        color={color}
        intensity={intensity}
        scale={gone ? 0 : 1}
        pulse={pulse}
      />
    )
  })

  // RIGHT — the added node: wireframe placeholder until commit inserts it
  const p3Fiber = p3
    ? (() => {
        const inserted = opDone('p3')
        const rev = revealed('p3')
        const settled = si >= PAINT
        return (
          <GlowNode
            key="fp3"
            pos={fpos['p3']!}
            label={NODE_META['p3'].label}
            sub={settled ? undefined : inserted ? 'inserted' : rev ? 'added' : undefined}
            subColor={DIFF_COLOR.added}
            color={settled ? COLORS.fiberBase : DIFF_COLOR.added}
            intensity={inserted ? (settled ? 0.8 : 1.25) : 0.85}
            scale={inserted ? 1 : rev ? 0.55 : 0}
            wire={!inserted}
          />
        )
      })()
    : null

  // BOTTOM — real DOM (host elements only)
  const domNodes = (Object.keys(dpos) as NodeId[]).map((id) => {
    const i = opIndex(id)
    const op = i >= 0 ? scenario.commitOps[i] : null
    const done = opDone(id)
    let scale = 1
    let color = COLORS.domBase
    let intensity = 0.4
    if (op?.op === 'insert') {
      scale = done ? 1 : 0
      if (done) {
        color = DIFF_COLOR.added
        intensity = 1.2
      }
    }
    if (op?.op === 'delete' && done) scale = 0
    if (op?.op === 'update' && done) {
      color = DIFF_COLOR.updated
      intensity = 1.3
    }
    let pulse: Pulse
    if (stage === 'paint' && scale > 0) {
      if (op) {
        pulse = 'fast'
        intensity = Math.max(intensity, 1.4)
      } else {
        pulse = 'slow'
        intensity = 0.55
      }
    }
    if (si >= DONE) {
      color = COLORS.domBase
      intensity = 0.5
    }
    return (
      <DomBox key={'d' + id} pos={dpos[id]!} label={NODE_META[id].label} color={color} intensity={intensity} scale={scale} pulse={pulse} />
    )
  })

  // commit packets: changed nodes flow from fiber tree down to the real DOM
  const packets =
    stage === 'commit'
      ? scenario.commitOps.map((op, i) => (
          <Packet
            key={'pk' + op.node}
            from={fpos[op.node]!}
            to={dpos[op.node]!}
            active={tick === i}
            color={op.op === 'delete' ? DIFF_COLOR.deleted : op.op === 'insert' ? DIFF_COLOR.added : DIFF_COLOR.updated}
          />
        ))
      : null

  // reconciliation scan beam between the pair currently being compared
  const beam =
    stage === 'reconcile' && tick < order.length
      ? (() => {
          const id = order[Math.min(tick, order.length - 1)]
          return (
            <Line
              points={[vpos[id]!, fpos[id]!]}
              color="#e2e8f0"
              lineWidth={1.5}
              dashed
              dashSize={0.28}
              gapSize={0.18}
            />
          )
        })()
      : null

  // connector lines
  const vIds = scenario.vdomNodes.filter(() => vdomShown).filter((id) => stage !== 'render' || tick >= depth(id))
  const fIds = FIBER_BASE.filter((id) => !(statusOf(id) === 'deleted' && opDone(id)))
  if (p3 && opDone('p3')) fIds.push('p3')

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 6]} intensity={0.6} />
      <gridHelper args={[34, 26, '#0f3d2e', '#062e23']} position={[0, -4.7, 0]} />

      {/* section titles */}
      <Html center position={[-4.4, 4.5, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className="tree-title" style={{ color: '#67e8f9' }}>
          VIRTUAL DOM
          <small>new render output — rebuilt each cycle, then discarded</small>
        </div>
      </Html>
      <Html center position={[4.4, 4.5, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className="tree-title" style={{ color: '#6ee7b7' }}>
          FIBER TREE
          <small>persistent — created at mount, updated in place</small>
        </div>
      </Html>
      <Html center position={[0, -4.15, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className="tree-title" style={{ color: '#5eead4' }}>
          REAL DOM
          <small>host elements only — the thing the browser paints</small>
        </div>
      </Html>
      {!vdomShown && (
        <Html center position={[-4.4, 1.2, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className="tree-title" style={{ color: '#164e63' }}>
            ( empty — built during
            <br />
            the render phase )
          </div>
        </Html>
      )}

      <TreeEdges pos={vpos} ids={vIds} color="#155e75" />
      <TreeEdges pos={fpos} ids={fIds} color="#065f46" />

      {vdomNodes}
      {ghostNodes}
      {fiberNodes}
      {p3Fiber}
      {domNodes}
      {packets}
      {beam}
    </group>
  )
}
