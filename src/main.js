import { ATOM_TYPES } from "./atomsConfig.js";
import { state } from "./state.js";
import { canBond, getPairMolecule } from "./chemistry.js";
import {
  createPhysics,
  handleResizePhysics,
  convertToPhysical,
  ensureBondConstraints,
  updatePhysical,
  createBondConstraint,
  installCollisionBonding 
} from "./physics.js";
import { draw } from "./render.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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
      (x.aId === a.id && x.bId === b.id) ||
      (x.aId === b.id && x.bId === a.id)
  );
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

  const bond = { aId: a.id, bId: b.id, molecule, constraint: null };
  state.bonds.push(bond);

  // create constraint immediately (both have bodies)
  bond.constraint = createBondConstraint(physics, a, b);

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

        state.moleculeCounts[molecule] = (state.moleculeCounts[molecule] || 0) + 1;

        a.currentBonds++;
        b.currentBonds++;

        const bond = { aId: a.id, bId: b.id, molecule, constraint: null };
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

  updateFloating(dt);
  // handleFloatingCollisions();

  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);
  updatePhysical(physics, state);

  draw(canvas, ctx, state);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
