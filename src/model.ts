// ── Fiber Journey: domain model ────────────────────────────────────────────
// The simulated component tree:  App → Test → main → [h1, p, p, button]
// p3 is a phantom node that only exists in the "add a <p>" scenario.

export type NodeId = 'app' | 'test' | 'main' | 'h1' | 'p1' | 'p2' | 'p3' | 'button'
export type Stage = 'idle' | 'trigger' | 'render' | 'reconcile' | 'commit' | 'paint' | 'done'
export type DiffStatus = 'unchanged' | 'updated' | 'added' | 'deleted' | 'bailed'
export type Vec3 = [number, number, number]

export interface CommitOp {
  node: NodeId
  op: 'update' | 'insert' | 'delete'
  desc: string
}

export interface Scenario {
  id: string
  label: string
  trigger: NodeId
  blurb: string
  /** components/hosts whose render functions ran / elements were rebuilt */
  rerenders: NodeId[]
  /** nodes present in the NEW virtual DOM (incl. reused/bailed-out ones) */
  vdomNodes: NodeId[]
  diff: Partial<Record<NodeId, DiffStatus>>
  commitOps: CommitOp[]
  notes: Partial<Record<Stage, string>>
}

export const STAGE_SEQ: Stage[] = ['idle', 'trigger', 'render', 'reconcile', 'commit', 'paint', 'done']
export const stageIndex = (s: Stage) => STAGE_SEQ.indexOf(s)

export const NODE_META: Record<NodeId, { label: string; kind: 'component' | 'host'; parent: NodeId | null }> = {
  app: { label: '<App/>', kind: 'component', parent: null },
  test: { label: '<Test/>', kind: 'component', parent: 'app' },
  main: { label: '<main>', kind: 'host', parent: 'test' },
  h1: { label: '<h1>', kind: 'host', parent: 'main' },
  p1: { label: '<p>', kind: 'host', parent: 'main' },
  p2: { label: '<p>', kind: 'host', parent: 'main' },
  p3: { label: '<p>+', kind: 'host', parent: 'main' },
  button: { label: '<button>', kind: 'host', parent: 'main' },
}

export const FIBER_BASE: NodeId[] = ['app', 'test', 'main', 'h1', 'p1', 'p2', 'button']
const LEAF_ORDER: NodeId[] = ['h1', 'p1', 'p2', 'p3', 'button']

export const COLORS = {
  fiberBase: '#34d399',
  vdomBase: '#22d3ee',
  domBase: '#0d9488',
  pulse: '#fde047',
}

export const DIFF_COLOR: Record<DiffStatus, string> = {
  unchanged: '#15803d',
  updated: '#22d3ee',
  added: '#eab308',
  deleted: '#ef4444',
  bailed: '#64748b',
}

export const DIFF_LABEL: Record<DiffStatus, string> = {
  unchanged: 'unchanged',
  updated: 'updated',
  added: 'added',
  deleted: 'deleted',
  bailed: 'bailed out',
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'app-theme',
    label: 'toggle theme',
    trigger: 'app',
    blurb: 'State at the root: every component below re-renders, yet only ONE DOM write happens.',
    rerenders: ['app', 'test', 'main', 'h1', 'p1', 'p2', 'button'],
    vdomNodes: ['app', 'test', 'main', 'h1', 'p1', 'p2', 'button'],
    diff: { main: 'updated' },
    commitOps: [{ node: 'main', op: 'update', desc: 'main.className = "dark"' }],
    notes: {
      trigger: 'setTheme() ran inside <App/>. Because the state lives at the ROOT, this will be the most render-heavy run of the four.',
      render: 'All 7 nodes get rebuilt: <App/> re-rendered, so <Test/>, <main> and every child re-render by default — no memo, no bailouts anywhere.',
      reconcile: '6 of 7 verdicts come back UNCHANGED. All that re-render work produced identical output; only <main> differs (a new className).',
      commit: 'A single DOM mutation: main.className = "dark". Seven renders, one write — that asymmetry is the whole point of the architecture.',
      paint: 'The browser restyles <main> and repaints. One property, one element.',
    },
  },
  {
    id: 'test-count',
    label: 'count + 1',
    trigger: 'test',
    blurb: '<App/> is skipped — renders go DOWN, never up. Only <h1> ends up different.',
    rerenders: ['test', 'main', 'h1', 'p1', 'p2', 'button'],
    vdomNodes: ['app', 'test', 'main', 'h1', 'p1', 'p2', 'button'],
    diff: { app: 'bailed', h1: 'updated' },
    commitOps: [{ node: 'h1', op: 'update', desc: 'h1.textContent = "Count: 1"' }],
    notes: {
      trigger: 'setCount() ran inside <Test/>. <App/> above is untouched — a state change never re-renders parents.',
      render: '<App/> did NOT re-render (gray = its element is reused as-is). <Test/> and everything below re-ran, because children re-render with their parent by default.',
      reconcile: 'Only <h1> differs — it displays the count. Both <p>s and the <button> re-rendered but returned identical elements: UNCHANGED, zero DOM work.',
      commit: 'One DOM mutation: the <h1> text node is updated in place. The element itself is not recreated.',
      paint: 'The browser repaints the <h1> text. That is the entire visible cost.',
    },
  },
  {
    id: 'test-add',
    label: 'show an extra <p>',
    trigger: 'test',
    blurb: 'The new tree has a node the Fiber tree has never seen → an ADDED verdict.',
    rerenders: ['test', 'main', 'h1', 'p1', 'p2', 'p3', 'button'],
    vdomNodes: ['app', 'test', 'main', 'h1', 'p1', 'p2', 'p3', 'button'],
    diff: { app: 'bailed', p3: 'added' },
    commitOps: [{ node: 'p3', op: 'insert', desc: 'main.insertBefore(p, button)' }],
    notes: {
      trigger: 'setShowDetails(true) ran inside <Test/>.',
      render: 'The new Virtual DOM contains an extra <p> (marked +) that has no counterpart in the Fiber tree yet.',
      reconcile: 'Walking the children in order, the diff finds a <p> with no matching fiber → ADDED. A placement is scheduled; the wireframe on the right marks where the new fiber will attach.',
      commit: 'React creates the real <p> element and inserts it into <main> before the <button>. Watch it materialize in the DOM row.',
      paint: 'Inserting a node changes layout — the browser reflows the children of <main>, then paints.',
    },
  },
  {
    id: 'test-remove',
    label: 'hide the second <p>',
    trigger: 'test',
    blurb: 'The new tree is MISSING a node the Fiber tree still holds → a DELETED verdict.',
    rerenders: ['test', 'main', 'h1', 'p1', 'button'],
    vdomNodes: ['app', 'test', 'main', 'h1', 'p1', 'button'],
    diff: { app: 'bailed', p2: 'deleted' },
    commitOps: [{ node: 'p2', op: 'delete', desc: 'main.removeChild(p)' }],
    notes: {
      trigger: 'setShowNote(false) ran inside <Test/>.',
      render: 'The new Virtual DOM simply does not include the second <p>. Nothing is "deleted" yet — the new tree just lacks it (red marker).',
      reconcile: 'The diff finds a fiber child with no match in the new tree → DELETED. The removal is queued in the effect list, not executed.',
      commit: 'React calls removeChild on the real <p>. Only now does it actually leave the document.',
      paint: 'Removing a node changes layout — the browser reflows and repaints <main>.',
    },
  },
]

/** Which nodes get visited during the reconciliation scan (union of both trees). */
export function reconcileOrder(s: Scenario): NodeId[] {
  const all: NodeId[] = ['app', 'test', 'main', 'h1', 'p1', 'p2', 'p3', 'button']
  return all.filter((id) => s.vdomNodes.includes(id) || FIBER_BASE.includes(id))
}

export function hasP3(s: Scenario) {
  return s.vdomNodes.includes('p3')
}

/** 3D positions for one tree (vdom left / fiber right via xOff). */
export function treeLayout(s: Scenario, xOff: number): Partial<Record<NodeId, Vec3>> {
  const leaves = LEAF_ORDER.filter((id) => (id === 'p3' ? hasP3(s) : true))
  const pos: Partial<Record<NodeId, Vec3>> = {
    app: [xOff, 3.4, 0],
    test: [xOff, 2.1, 0],
    main: [xOff, 0.8, 0],
  }
  const n = leaves.length
  leaves.forEach((id, i) => {
    pos[id] = [xOff + (i - (n - 1) / 2) * 1.35, -0.7, 0]
  })
  return pos
}

/** Bottom row: the real DOM — host elements only, components never appear here. */
export function domLayout(s: Scenario): Partial<Record<NodeId, Vec3>> {
  const hosts = (['main', 'h1', 'p1', 'p2', 'p3', 'button'] as NodeId[]).filter((id) =>
    id === 'p3' ? hasP3(s) : true,
  )
  const pos: Partial<Record<NodeId, Vec3>> = {}
  const n = hosts.length
  hosts.forEach((id, i) => {
    pos[id] = [(i - (n - 1) / 2) * 1.75, -3.1, 0]
  })
  return pos
}

export const STAGE_INFO: Record<Stage, { title: string; body: string }> = {
  idle: {
    title: 'READY // TWO TREES, ONE SCREEN',
    body: `LEFT — the Virtual DOM: the lightweight description of UI your components return. The rendered parts are rebuilt every cycle and thrown away afterwards. It is cheap; it is just JavaScript objects.

RIGHT — the Fiber tree: React's persistent bookkeeping structure. It is created ONCE when your app mounts, then updated in place after every cycle. It is never rebuilt from scratch.

BOTTOM — the real DOM: the only thing the browser can paint. Notice it holds host elements only (<main>, <h1>, <p>, <button>). Your components never exist in the real DOM.

Pick a state change on the right panel, then run the cycle. Drag to orbit the scene.`,
  },
  trigger: {
    title: 'STAGE 1 // TRIGGER',
    body: `A state setter just fired inside the pulsing component on the Fiber tree.

Here is what people get wrong: at this instant, NOTHING has happened. The component function has not re-run. The Virtual DOM has not been rebuilt. The screen is untouched.

All React did was mark this fiber as "dirty" and schedule an update. The actual work starts in the next stage.`,
  },
  render: {
    title: 'STAGE 2 // RENDER PHASE',
    body: `React is now calling your component functions — starting at the component whose state changed and walking DOWN the tree. Each function returns JSX, which is just plain JavaScript objects. Those objects form the new Virtual DOM appearing on the left.

Lock in two facts. One: rendering means CALLING YOUR FUNCTIONS — the real DOM is not touched here, and nothing visible changes. A console.log in your component fires at this moment. Two: when a component re-renders, ALL of its children re-render by default, even with identical props — unless something like React.memo bails them out.`,
  },
  reconcile: {
    title: 'STAGE 3 // RECONCILIATION (DIFF)',
    body: `React now walks both trees together, comparing the new Virtual DOM against the EXISTING Fiber tree — the one created at mount and kept alive ever since. The Fiber tree is not rebuilt; it is compared and updated in place.

Each pair of nodes gets a verdict: UNCHANGED (function re-ran, output identical → no DOM work), UPDATED (same element, different props or text), ADDED (exists only in the new tree), DELETED (missing from the new tree).

The verdicts are collected into an effect list — a to-do list of DOM operations. Nothing has been applied yet.`,
  },
  commit: {
    title: 'STAGE 4 // COMMIT',
    body: `This is the ONLY phase that mutates the real DOM. React runs through the effect list and applies exactly those changes — nothing more.

Watch the bottom row: only the flagged nodes receive any work. Every UNCHANGED verdict costs the DOM literally nothing, no matter how many components re-rendered to produce it.

That is the entire bet of React's architecture: renders are cheap and frequent; DOM mutations are minimal, batched, and applied in one synchronous pass.`,
  },
  paint: {
    title: 'STAGE 5 // BROWSER PAINT',
    body: `React's work is finished. The browser now takes over: it recalculates style and layout for the mutated nodes and paints pixels to the screen.

This is the first moment a user can actually SEE the change. Everything before this — trigger, render, diff, commit — happened in JavaScript and in-memory DOM structures.

This is also why a "wasted" re-render is often harmless: if it diffs to UNCHANGED, it never reaches the browser at all.`,
  },
  done: {
    title: 'CYCLE COMPLETE',
    body: `The Fiber tree has absorbed the changes and is now the "current" tree, waiting for the next trigger. The Virtual DOM from this cycle has served its purpose.

Replay with a DIFFERENT state change — the diff verdicts will come out differently. When you have seen a couple of runs, scroll down: the exam is unlocked.`,
  },
}
