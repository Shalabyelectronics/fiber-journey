# Fiber Journey

Interactive 3D teaching app for React's **trigger → render → reconciliation → commit → paint** cycle.

## Run it

**Zero-setup:** open `dist/fiber-journey.html` in any browser — the whole app (React, three.js, styles) is inlined into that one file. No server, no network.

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
- `src/App.tsx` — stage machine, explanation panel, scenario picker
- `src/Quiz.tsx` — 6-question exam + JSON report download (`fiber-journey-report-<date>.json`)

All state lives in React state/props. No localStorage, no external API calls.
