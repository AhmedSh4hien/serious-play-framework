import { ATOM_TYPES, BOND_COLORS, DEFAULT_BOND_COLOR } from "./atomsConfig.js";
import { canBond, getPairMolecule, shouldLockAfterBond } from "./chemistry.js";
import { createBondConstraint } from "./physics.js";
import { LEVELS } from "./levelsConfig.js";

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
    showOHBadge: false,
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
        ? Math.random() * canvas.clientWidth
        : entry.x ?? Math.random() * canvas.clientWidth;
      const y = entry.random
        ? Math.random() * canvas.clientHeight
        : entry.y ?? Math.random() * canvas.clientHeight;
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
    atomType: def.id,
    x: Math.round(x),
    y: Math.round(y),
    phase: state.session.phase,
    levelIndex: state.session.currentLevelIndex ?? 0,
  });

  createAtom(state, typeId, x, y);
  onUiChange?.();
}

export function refreshAtomBadges(state) {
  for (const atom of state.atoms) {
    atom.showOHBadge =
      atom.typeId === "O" &&
      state.bonds.some(
        (b) => b.molecule === "OH" && (b.aId === atom.id || b.bId === atom.id)
      );
  }
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

  refreshAtomBadges(state);
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

        if (isOH1 || isOH2) {
          bond.molecule = "H2O";
          bond.color = BOND_COLORS["H2O"] ?? DEFAULT_BOND_COLOR;
        }
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

  if (changed) {
    refreshAtomBadges(state);
    onUiChange?.();
  }
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
    color: BOND_COLORS[molecule] ?? DEFAULT_BOND_COLOR,
  };

  if (shouldLockAfterBond(molecule)) {
    a.locked = true;
    b.locked = true;
  }

  state.bonds.push(bond);
  bond.constraint = createBondConstraint(physics, a, b);

  finalizeWaterMolecules({ state, onUiChange });
  refreshAtomBadges(state);

  const goal = state.session.goal;
  const targets = goal.targets || [];

  const allTargetsCompleted =
    targets.length > 0 &&
    targets.every((t) => {
      const current = state.session.createdMoleculeCounts[t.molecule] || 0;
      return current >= t.targetCount;
    });

  state.session.stats.targetMoleculesFormed = targets.filter((t) => {
    const current = state.session.createdMoleculeCounts[t.molecule] || 0;
    return current >= t.targetCount;
  }).length;

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

  if (state.session.phase === "simulation") {
    telemetry.event("bond_formed", {
      molecule,
      aType: a.typeId,
      bType: b.typeId,
      aId: a.id,
      bId: b.id,
    });
  }

  onUiChange?.();
}

export function applyMouseForce({ state, physics }) {
  if (state.session.phase !== "simulation") return;

  const radius = 120;
  const speed = 0.4;

  for (const atom of state.atoms) {
    if (!atom.body) continue;

    if (!state.input.isPointerDown) {
      physics.Matter.Body.set(atom.body, "frictionAir", 0);
      continue;
    }

    const dx = state.input.mouseX - atom.x;
    const dy = state.input.mouseY - atom.y;
    const dist = Math.hypot(dx, dy);

    if (dist > radius) {
      physics.Matter.Body.set(atom.body, "frictionAir", 0);
      continue;
    }

    if (dist < 8) continue;

    physics.Matter.Body.set(atom.body, "frictionAir", 0.08);
    const scale = Math.min(dist, 12) / dist;
    physics.Matter.Body.setVelocity(atom.body, {
      x: dx * scale * speed,
      y: dy * scale * speed,
    });
  }
}