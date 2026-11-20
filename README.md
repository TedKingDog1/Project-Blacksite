# PROJECT: BLACKSITE

A browser-based, single-player first-person game prototype built with TypeScript, Three.js, Vite, and Rapier physics.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run in GitHub Codespaces / Cloud Shell
```bash
npm install
npm run dev -- --host 0.0.0.0
```
Open the forwarded port shown by the terminal (Vite defaults to **5173**).

## Quality checks
```bash
npm run typecheck
npm run build
```

## Controls
- **W A S D** — move
- **Mouse** — look
- **Space** — jump
- **Left mouse** — fire pulse projector
- **R** — recharge
- **Esc** — release mouse

Click the game view to capture the mouse. The first milestone is a playable training-range prototype: navigate the compound and tag autonomous training drones with the fictional pulse projector.

## Project layout
- `src/game/Game.ts` — application lifecycle and render loop
- `src/game/Player.ts` — first-person controller and Rapier body
- `src/game/World.ts` — environment and physics colliders
- `src/game/Drone.ts` — autonomous training-target behavior
- `src/game/Weapon.ts` — fictional pulse projector and hit detection
- `src/game/HUD.ts` — status display
- `src/game/Input.ts` — keyboard state

This is the foundation, not the finished campaign. Systems are deliberately separated so later milestones can add mission flow, more environments, animation, audio, accessibility, and additional fictional equipment.
