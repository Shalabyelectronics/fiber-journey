# Fiber Journey

An interactive 3D visualization of React's **trigger → render → reconciliation → commit → paint** cycle — built for people learning how React actually updates the screen, not just how to write components.

**Try it live: https://fiber-journey.vercel.app** (no install needed)

## Why this exists

Most React tutorials show you *how* to call `useState` and `useEffect`. Few show you what React does *after* you call them. This app makes that invisible process visible: three synced views (Virtual DOM, Fiber tree, real DOM) that update step-by-step as you trigger a change, so you can watch renders happen, see the diff get computed, and see exactly which DOM nodes get touched.

## What you'll learn

Walking through a full cycle, stage by stage, teaches these ideas:

- **Trigger ≠ render.** Calling a state setter doesn't immediately re-render anything — it just schedules work. Nothing visible happens yet.
- **Render phase just calls your functions.** "Rendering" means React calling your component functions to get new JSX — plain JS objects, no DOM touched. A child re-renders with its parent by default, even if its own props didn't change, unless something bails it out.
- **State never flows upward.** A state change in a child component only re-renders that child and its descendants. Parents above it are untouched (you'll see this marked "bailed out" in the scene).
- **Reconciliation compares, it doesn't rebuild.** React diffs the new Virtual DOM against the *existing* Fiber tree (built once at mount, updated in place ever since) and assigns each node a verdict: `unchanged`, `updated`, `added`, or `deleted`.
- **Commit is the only phase that touches the real DOM.** Everything before it is bookkeeping in memory. Commit applies only the nodes with non-`unchanged` verdicts — often one DOM write for many re-rendered components.
- **Paint is what the user actually sees**, and it's the browser's job, not React's — layout/reflow happens here, after commit.

## How to use it

1. Pick one of four state-change scenarios (each exercises a different verdict):
   - **toggle theme** — state at the root; everything re-renders, but only one DOM write happens.
   - **count + 1** — state in a middle component; the parent above it is skipped entirely.
   - **show an extra `<p>`** — the new tree has a node the Fiber tree has never seen → `added`.
   - **hide the second `<p>`** — the Fiber tree holds a node the new tree no longer has → `deleted`.
2. Hit the pinned button at the bottom of the screen to step through each stage (trigger → render → reconcile → commit → paint). The explanation panel on the right updates with what's happening and why, specific to the scenario you picked.
3. Drag to orbit the 3D scene, scroll to zoom — watch the scan beam during reconciliation and the commit packets during commit.
4. Run through a couple of scenarios, then take the 6-question exam (unlocked after your first full cycle) to check what stuck.

## Run it locally

**Zero-setup:** open `dist/index.html` in any browser — the whole app (React, three.js, styles) is inlined into that one file by `vite-plugin-singlefile`. No server, no network.

**Dev mode:**
```bash
npm install
npm run dev        # vite dev server
npm run typecheck  # tsc --noEmit
npm run build      # rebuilds dist/index.html (single file)
```

## Stack

React 18 + TypeScript + Vite · Tailwind CSS 3 · react-three-fiber + drei (OrbitControls, Html, Line)

## Structure

- `src/model.ts` — the tree, the four state-change scenarios, diff verdicts, commit ops, layouts, all stage copy
- `src/Scene.tsx` — the 3D scene: Virtual DOM tree (left), Fiber tree (right), real DOM row (bottom), scan beam, commit packets
- `src/App.tsx` — stage machine, explanation panel, scenario picker, pinned bottom run-control bar
- `src/Quiz.tsx` — 6-question exam + JSON report download (`fiber-journey-report-<date>.json`)

All state lives in React state/props. No localStorage, no external API calls — nothing you do here leaves the page.

---

## For contributors

**Deployment:** auto-deployed by Vercel on every push to `main` (git-linked project at https://github.com/Shalabyelectronics/fiber-journey, public, no manual deploy step).

**`.npmrc` (`legacy-peer-deps=true`):** required for CI/Vercel builds. `vite@8.1.4` conflicts with `@vitejs/plugin-react`'s and `vite-plugin-singlefile`'s peer ranges under npm's default strict resolution. This only surfaces on a clean install, not against an existing local `node_modules`/lockfile — don't remove it without re-testing a clean install.

**Layout decision — pinned run button:** the RUN/NEXT button is a `fixed inset-x-0 bottom-0` bar (bottom of `App.tsx`), not inline after the scenario picker. It used to sit at the bottom of a tall control panel, so reaching it scrolled the 3D viewport out of view — clicking it then meant scrolling back up to see anything happen. `<main>` and the footer carry extra bottom padding (`pb-24`/`pb-28`) so content doesn't sit under the fixed bar. Keep the button reachable without scrolling the viewport out of frame if you touch this.
