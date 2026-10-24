# Once Upon a Bug (MVP)

A cute pixel-art programming puzzle game where players fix a broken fairy-tale program.

## Level included

- **Rapunzel: Broken Escape** (first level only)
- Tower window target: **12 meters**
- Buggy default code: **Repeat 5** with `Grow Hair +2m` and `Climb` (stops at 10m)
- Fix: change repeat count to **6** so Rapunzel escapes

## Tech stack

- React + TypeScript + Vite
- Blockly block editor
- Custom interpreter for Run/Step execution
- localStorage for repeat count and solved-state memory
- No backend, no AI services

## Setup

```bash
npm install
npm run dev
```

Open the printed local Vite URL.

## Commands

```bash
npm run dev      # local development
npm run test     # interpreter tests
npm run build    # production build
npm run lint     # linting
```

## Gameplay controls

- **Run**: executes the whole program
- **Step**: executes exactly one instruction
- **Reset**: resets execution state to the beginning

The currently executing block is highlighted, and the game UI shows current hair length, target, repeat count, and status messages.

## Pixel-art assets

- Integrated Rapunzel level art lives in `/src/assets/rapunzel` as SVG files.
- The left page swaps between supplied night/tower scenes based on status (running/failed/success).
- Rapunzel uses the supplied sprite sheet frames (idle, worried, climbing, celebrating).
- Hair growth is rendered from modular sheet segments in 2m steps, so changing Repeat from 5 to 6 visibly extends hair to 12m.
