import { ATOM_TYPES } from "./atomsConfig.js";
import { canBond, getPairMolecule, shouldLockAfterBond } from "./chemistry.js";
import { createBondConstraint } from "./physics.js";
import { LEVELS } from "./levelsConfig.js";

// const ATOM_TYPE_IDS = ["H", "O", "Cl"];

// function randomAtomTypeId() {
//   const i = Math.floor(Math.random() * ATOM_TYPE_IDS.length);
//   return ATOM_TYPE_IDS[i];
// }

function alreadyBonded(state, a, b) {
  return state.bonds.some(
    (x) =>
      (x.aId === a.id && x.bId === b.id) || (x.aId === b.id && x.bId === a.id)
  );
}

function createAtom(state, typeId, x, y) {
  const def = ATOM_TYPES[typeId];

  const atom = {
    id: state.nextAtomId++,
    typeId: def.id,
    currentBonds: 0,
    state: "toPhysical",
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: def.radius,
    color: def.color,
    body: null,
  };

  state.atoms.push(atom);
  state.atomById.set(atom.id, atom);
  return atom;
}

export function initAtoms(state, canvas) {
  state.nextAtomId = 0;

  const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];
  const startingAtoms = level.startingAtoms ?? [];

  for (const entry of startingAtoms) {
    const count = entry.count ?? 1;

    for (let i = 0; i < count; i++) {
      const x = entry.random
        ? Math.random() * canvas.width
        : entry.x ?? Math.random() * canvas.width;

      const y = entry.random
        ? Math.random() * canvas.height
        : entry.y ?? Math.random() * canvas.height;

      createAtom(state, entry.typeId, x, y);
    }
  }

  for (const atom of state.atoms) {
    atom.state = "toPhysical";
  }
}

export function spawnAtomAt({ x, y, state, onUiChange, telemetry }) {
  if (state.session.phase !== "simulation") return;

  const typeId = state.session.selectedSpawnType;
  if ((state.session.inventory[typeId] || 0) <= 0) return;

  const def = ATOM_TYPES[typeId];

  state.session.inventory[typeId]--;
  state.session.stats.atomsSpawned++;

  telemetry.event("atom_spawned", {
    type: def.id,
    x: Math.round(x),
    y: Math.round(y),
    phase: state.session.phase,
  });

  createAtom(state, typeId, x, y);
  onUiChange?.();
}

export function decayIntermediateBonds({ now, state, physics }) {
  const { Matter, world } = physics;
  const HO_TTL = 3000;

  for (let i = state.bonds.length - 1; i >= 0; i--) {
    const bond = state.bonds[i];
    if (bond.molecule !== "OH") continue;
    if (now - (bond.createdAt ?? now) < HO_TTL) continue;

    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);

    if (bond.constraint) {
      Matter.World.remove(world, bond.constraint);
    }

    if (a) a.currentBonds = Math.max(0, a.currentBonds - 1);
    if (b) b.currentBonds = Math.max(0, b.currentBonds - 1);

    state.bonds.splice(i, 1);
  }
}

export function finalizeWaterMolecules({ state, onUiChange }) {
  const neighbors = new Map();

  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;

    if (!neighbors.has(a.id)) neighbors.set(a.id, []);
    if (!neighbors.has(b.id)) neighbors.set(b.id, []);

    neighbors.get(a.id).push(b);
    neighbors.get(b.id).push(a);
  }

  let changed = false;

  for (const o of state.atoms) {
    if (o.typeId !== "O") continue;
    if (o.locked) continue;

    const ns = neighbors.get(o.id) ?? [];
    const hNeighbors = ns.filter((n) => n.typeId === "H" && !n.locked);

    if (hNeighbors.length >= 2) {
      const h1 = hNeighbors[0];
      const h2 = hNeighbors[1];

      for (const bond of state.bonds) {
        const isOH1 =
          (bond.aId === o.id && bond.bId === h1.id) ||
          (bond.aId === h1.id && bond.bId === o.id);
        const isOH2 =
          (bond.aId === o.id && bond.bId === h2.id) ||
          (bond.aId === h2.id && bond.bId === o.id);

        if (isOH1 || isOH2) bond.molecule = "H2O";
      }

      o.locked = true;
      h1.locked = true;
      h2.locked = true;

      state.moleculeCounts.H2O = (state.moleculeCounts.H2O || 0) + 1;
      if (state.session.isTrackingProgress) {
        state.session.createdMoleculeCounts.H2O =
          (state.session.createdMoleculeCounts.H2O || 0) + 1;
      }
      changed = true;
    }
  }

  if (changed) onUiChange?.();
}

export function onBond({ a, b, state, physics, telemetry, onUiChange }) {
  if (!a.body || !b.body) return;
  if (alreadyBonded(state, a, b)) return;
  if (!canBond(a, b)) return;

  const molecule = getPairMolecule(a, b);
  if (!molecule) return;

  state.session.stats.validBonds++;

  a.currentBonds++;
  b.currentBonds++;

  state.moleculeCounts[molecule] = (state.moleculeCounts[molecule] || 0) + 1;

  if (state.session.isTrackingProgress) {
    state.session.createdMoleculeCounts[molecule] =
      (state.session.createdMoleculeCounts[molecule] || 0) + 1;
  }

  const bond = {
    aId: a.id,
    bId: b.id,
    molecule,
    constraint: null,
    createdAt: performance.now(),
  };

  if (shouldLockAfterBond(molecule)) {
    a.locked = true;
    b.locked = true;
  }

  state.bonds.push(bond);
  bond.constraint = createBondConstraint(physics, a, b);

  finalizeWaterMolecules({ state, onUiChange });

  const goal = state.session.goal;
  const targets = goal.targets || [];
  
  const completedTargetCount = targets.filter((t) => {
    const current = state.session.createdMoleculeCounts[t.molecule] || 0;
    return current >= t.targetCount;
  }).length;
  
  state.session.stats.targetMoleculesFormed = completedTargetCount;
  
  const allTargetsCompleted =
    targets.length > 0 &&
    targets.every((t) => {
      const current = state.session.createdMoleculeCounts[t.molecule] || 0;
      return current >= t.targetCount;
    });
  
  if (
    state.session.phase === "simulation" &&
    !goal.completed &&
    allTargetsCompleted
  ) {
    goal.completed = true;
    goal.completedAtMs = performance.now();
  
    telemetry.event("goal_completed", {
      targets: targets.map((t) => ({
        molecule: t.molecule,
        targetCount: t.targetCount,
        actualCount: state.session.createdMoleculeCounts[t.molecule] || 0,
      })),
    });
  }

  telemetry.event("bond_formed", {
    molecule,
    aType: a.typeId,
    bType: b.typeId,
    aId: a.id,
    bId: b.id,
  });

  onUiChange?.();
}

export function applyMouseForce({ state, physics }) {
  if (state.session.phase !== "simulation") return;
  if (!state.input.isRightMouseDown) return;

  const radius = 140;
  const strength = 0.0009;

  for (const atom of state.atoms) {
    if (!atom.body || atom.locked) continue;

    const dx = state.input.mouseX - atom.x;
    const dy = state.input.mouseY - atom.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 8 || dist > radius) continue;

    const falloff = 1 - dist / radius;
    const fx = (dx / dist) * strength * falloff;
    const fy = (dy / dist) * strength * falloff;

    physics.Matter.Body.applyForce(atom.body, atom.body.position, {
      x: fx,
      y: fy,
    });
  }
}
