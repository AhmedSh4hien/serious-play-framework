import { ATOM_TYPES } from "./atomsConfig.js";
import { state } from "./state.js";
import { canBond, getPairMolecule, shouldLockAfterBond } from "./chemistry.js";
import {
  createPhysics,
  handleResizePhysics,
  convertToPhysical,
  ensureBondConstraints,
  updatePhysical,
  createBondConstraint,
  installCollisionBonding,
} from "./physics.js";
import { draw } from "./render.js";
import { createTelemetry } from "./telemetry.js";



const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const telemetry = createTelemetry({ getState: () => state });

// ----- Canvas resize -----
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", () => {
  resizeCanvas();
  handleResizePhysics(physics, canvas);
});
resizeCanvas();

function alreadyBonded(a, b) {
  return state.bonds.some(
    (x) =>
      (x.aId === a.id && x.bId === b.id) || (x.aId === b.id && x.bId === a.id)
  );
}



function decayIntermediateBonds(now) {
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


function finalizeWaterMolecules() {
  // Build adjacency from current bonds
  const neighbors = new Map(); // atomId -> array of neighbor atom objects
  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;

    if (!neighbors.has(a.id)) neighbors.set(a.id, []);
    if (!neighbors.has(b.id)) neighbors.set(b.id, []);
    neighbors.get(a.id).push(b);
    neighbors.get(b.id).push(a);
  }

  // Find O with >= 2 H neighbors that are not locked into H2O yet
  for (const o of state.atoms) {
    if (o.typeId !== "O") continue;
    if (o.locked) continue;

    const ns = neighbors.get(o.id) ?? [];
    const hNeighbors = ns.filter((n) => n.typeId === "H" && !n.locked);

    if (hNeighbors.length >= 2) {
      const h1 = hNeighbors[0];
      const h2 = hNeighbors[1];

      // Mark the two O-H bonds as H2O (final)
      for (const bond of state.bonds) {
        const isOH1 =
          (bond.aId === o.id && bond.bId === h1.id) ||
          (bond.aId === h1.id && bond.bId === o.id);
        const isOH2 =
          (bond.aId === o.id && bond.bId === h2.id) ||
          (bond.aId === h2.id && bond.bId === o.id);
        if (isOH1 || isOH2) bond.molecule = "H2O";
      }

      // Lock atoms so they don't keep bonding into garbage
      o.locked = true;
      h1.locked = true;
      h2.locked = true;

      state.moleculeCounts.H2O = (state.moleculeCounts.H2O || 0) + 1;
    }
  }
}

function onBond(a, b) {

  
  // only bond physical bodies
  if (!a.body || !b.body) return;

  // prevent spam / duplicates
  if (alreadyBonded(a, b)) return;

  // chemistry gate
  if (!canBond(a, b)) return;

  const molecule = getPairMolecule(a, b);
  if (!molecule) return;

  // apply bond
  a.currentBonds++;
  b.currentBonds++;

  state.moleculeCounts[molecule] = (state.moleculeCounts[molecule] || 0) + 1;

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

  // create constraint immediately (both have bodies)
  bond.constraint = createBondConstraint(physics, a, b);

  finalizeWaterMolecules();

  telemetry.event("bond_formed", {
    molecule,
    aType: a.typeId,
    bType: b.typeId,
    aId: a.id,
    bId: b.id,
  });

  console.log("Molecule formed:", molecule, "from", a.id, b.id);
}

// ----- Random atom spawn at start -----
const ATOM_TYPE_IDS = ["H", "O", "Cl"];
function randomAtomTypeId() {
  const i = Math.floor(Math.random() * ATOM_TYPE_IDS.length);
  return ATOM_TYPE_IDS[i];
}

// ----- Init atoms -----
const atomCount = 500;
state.nextAtomId = 0;

for (let i = 0; i < atomCount; i++) {
  const typeId = randomAtomTypeId();
  const def = ATOM_TYPES[typeId];

  const atom = {
    id: state.nextAtomId++,
    typeId: def.id,
    currentBonds: 0,
    state: "toPhysical",
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: def.radius,
    color: def.color,
    body: null,
  };

  state.atoms.push(atom);
  state.atomById.set(atom.id, atom);
}

for (const a of state.atoms) a.state = "toPhysical";

// ----- Matter -----
const physics = createPhysics(canvas);
handleResizePhysics(physics, canvas);

// create bodies once so the collision map has something to register
convertToPhysical(physics, state);
ensureBondConstraints(physics, state);

// now install collision events
installCollisionBonding(physics, state, { canBond, getPairMolecule }, onBond);

// ----- Input -----
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = e.clientX - rect.left;
  state.input.mouseY = e.clientY - rect.top;

  if (e.button === 0) {
    spawnAtomAt(state.input.mouseX, state.input.mouseY);
  } else if (e.button === 2) {
    state.input.isRightMouseDown = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2) state.input.isRightMouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = e.clientX - rect.left;
  state.input.mouseY = e.clientY - rect.top;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.key === "1") state.currentAtomType = "H";
  if (e.key === "2") state.currentAtomType = "O";
  if (e.key === "3") state.currentAtomType = "Cl";
});

// ----- Spawning -----
function spawnAtomAt(x, y) {
  const def = ATOM_TYPES[state.currentAtomType];

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
}

// ----- Floating update (only for atoms without Matter bodies) -----
function updateFloating(dt) {
  for (const a of state.atoms) {
    if (a.state !== "floating") continue;
    if (a.body) continue;

    a.x += a.vx * dt;
    a.y += a.vy * dt;

    if (a.x < a.radius || a.x > canvas.width - a.radius) a.vx *= -1;
    if (a.y < a.radius || a.y > canvas.height - a.radius) a.vy *= -1;
  }
}

// ----- Collision handling (still manual distance-based for now) -----
function handleFloatingCollisions() {
  const threshold = 2;

  for (let i = 0; i < state.atoms.length; i++) {
    const a = state.atoms[i];
    if (a.state !== "floating") continue;

    for (let j = i + 1; j < state.atoms.length; j++) {
      const b = state.atoms[j];
      if (b.state !== "floating") continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const r = a.radius + b.radius;

      if (!canBond(a, b)) continue;

      if (dist2 < (r + threshold) * (r + threshold)) {
        const molecule = getPairMolecule(a, b);
        if (!molecule) continue;

        state.moleculeCounts[molecule] =
          (state.moleculeCounts[molecule] || 0) + 1;

        a.currentBonds++;
        b.currentBonds++;

        const bond = {
          aId: a.id,
          bId: b.id,
          molecule,
          constraint: null,
          createdAt: performance.now(),
        };
        
        state.bonds.push(bond);

        a.state = "toPhysical";
        b.state = "toPhysical";

        // if they already have bodies, create immediately
        if (a.body && b.body) {
          bond.constraint = createBondConstraint(physics, a, b);
        }
      }
    }
  }
}

// ----- FPS -----
function updateFps(t) {
  state.framesThisSecond++;
  if (t - state.lastFpsUpdate >= 1000) {
    state.fps = state.framesThisSecond;
    state.framesThisSecond = 0;
    state.lastFpsUpdate = t;
  }
}

// ----- Main loop -----
function loop(t) {
  const dt = (t - state.lastTime) * 0.1;
  state.lastTime = t;

  if (state.input.isRightMouseDown) {
    spawnAtomAt(state.input.mouseX, state.input.mouseY);
  }

  updateFps(t);
  decayIntermediateBonds(t);
  finalizeWaterMolecules();

  updateFloating(dt);
  // handleFloatingCollisions();

  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);
  updatePhysical(physics, state);

  draw(canvas, ctx, state);
  telemetry.tickUi();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
