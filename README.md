# Chemistry Particle Sandbox (prototype)

A small Vite + Canvas + Matter.js prototype where particles (H, O, Cl) move around and form simple bonds/molecules on collision.

## Features

- Atoms: Hydrogen (H), Oxygen (O), Chlorine (Cl)
- Bonds/molecules: H2, O2, Cl2, HCl, OH (intermediate), H2O (final)
- OH is displayed with a small red “−” badge on the oxygen
- HUD shows FPS, atom count, selected type, and molecule counters

## Controls

- 1 = H, 2 = O, 3 = Cl (select spawn type)
- LMB = spawn one atom
- Hold RMB = continuous spawn

## Run

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (usually http://localhost:5173).

Code overview
src/main.js — loop, input/spawning, bonding, OH decay, H2O finalization

src/chemistry.js — bond rules + molecule mapping

src/physics.js — Matter.js world, walls, constraints, stepping

src/render.js — drawing atoms/bonds/HUD + ion badge

src/state.js — shared state container

Notes

This is “toy chemistry” intended for rapid prototyping/gameplay exploration (not chemically accurate simulation).
