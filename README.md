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

