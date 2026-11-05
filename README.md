# Fiber Journey

Interactive 3D teaching app for React's **trigger → render → reconciliation → commit → paint** cycle.

## Live

**https://fiber-journey.vercel.app** — auto-deployed by Vercel on every push to `main` (git-linked project, no manual deploy step needed). Source: https://github.com/Shalabyelectronics/fiber-journey (public).

## Run it

**Zero-setup:** open `dist/index.html` in any browser — the whole app (React, three.js, styles) is inlined into that one file by `vite-plugin-singlefile`. No server, no network.

**Dev mode:**
```bash
npm install
npm run dev        # vite dev server
npm run typecheck  # tsc --noEmit
npm run build      # rebuilds dist/index.html (single file)
```

Deploy builds use `npm install` with `.npmrc` (`legacy-peer-deps=true`) — `vite@8.1.4` conflicts with `@vitejs/plugin-react`'s and `vite-plugin-singlefile`'s peer ranges under npm's default strict resolution. That conflict only surfaces on a clean install (CI/Vercel), not against an existing local `node_modules`/lockfile, so don't remove the `.npmrc` without re-testing a clean install.

## Stack

React 18 + TypeScript + Vite · Tailwind CSS 3 · react-three-fiber + drei (OrbitControls, Html, Line)

## Structure

- `src/model.ts` — the tree, the four state-change scenarios, diff verdicts, commit ops, layouts, all stage copy
- `src/Scene.tsx` — the 3D scene: Virtual DOM tree (left), Fiber tree (right), real DOM row (bottom), scan beam, commit packets
- `src/App.tsx` — stage machine, explanation panel, scenario picker, pinned bottom run-control bar
- `src/Quiz.tsx` — 6-question exam + JSON report download (`fiber-journey-report-<date>.json`)

All state lives in React state/props. No localStorage, no external API calls.

## Known layout decision

The RUN/NEXT button is a `fixed inset-x-0 bottom-0` bar (see bottom of `App.tsx`), not inline after the scenario picker. It used to sit at the bottom of a tall control panel — reaching it scrolled the 3D viewport out of view, so clicking it meant scrolling back up to see anything happen. `<main>` and the footer carry extra bottom padding (`pb-24`/`pb-28`) so content doesn't sit under the fixed bar. If you touch this layout, keep the button reachable without scrolling the viewport out of frame.
