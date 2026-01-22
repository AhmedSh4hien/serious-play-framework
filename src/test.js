import Matter from "matter-js";
import { ATOM_TYPES } from "./atomsConfig.js";

const Constraint = Matter.Constraint;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

//randomize at spawn
const ATOM_TYPE_IDS = ["H", "O", "Cl"];

const BOND_LENGTH = 30; // pixels between bonded atoms
const BOND_STIFFNESS = 0.02; // how strongly they pull together

function randomAtomTypeId() {
  const i = Math.floor(Math.random() * ATOM_TYPE_IDS.length);
  return ATOM_TYPE_IDS[i];
}

// Atom
const atoms = [];
const atomCount = 500;
let currentAtomType = "H"; // default selected element

const moleculeCounts = {
  H2: 0,
  Cl2: 0,
  HCl: 0,
  O2: 0
};

const bonds = []; // each item: { aId, bId }

for (let i = 0; i < atomCount; i++) {
  const typeId = randomAtomTypeId();
  const def = ATOM_TYPES[typeId];

  atoms.push({
    id: i,
    typeId: def.id,
    currentBonds: 0,
    state: "floating",
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: def.radius,
    color: def.color,
    body: null,
  });
}

// Matter
const engine = Matter.Engine.create();
engine.gravity.y = 0;
const world = engine.world;

// store a reference to the ground so atoms have something to land on
const ground = Matter.Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight + 40,
  window.innerWidth,
  80,
  { isStatic: true }
);
Matter.World.add(world, ground);

handleResize();

function updateFloating(dt) {
  // 1) normal movement
  for (const a of atoms) {
    if (a.state !== "floating") continue;
    if (a.body) continue;

    a.x += a.vx * dt;
    a.y += a.vy * dt;

    if (a.x < a.radius || a.x > canvas.width - a.radius) a.vx *= -1;
    if (a.y < a.radius || a.y > canvas.height - a.radius) a.vy *= -1;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw bonds first
  ctx.lineWidth = 3;
  for (const bond of bonds) {
    const a = atoms[bond.aId];
    const b = atoms[bond.bId];
    if (!a || !b) continue;

    // pick color by molecule
    if (bond.molecule === "H2") ctx.strokeStyle = "#4f8fff"; // blue
    else if (bond.molecule === "Cl2") ctx.strokeStyle = "#33aa33"; // green
    else if (bond.molecule === "HCl") ctx.strokeStyle = "#aa33aa"; // purple
    else ctx.strokeStyle = "#888888";

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 4;
  // draw bonds...
  ctx.globalAlpha = 1;

  for (const a of atoms) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (fps >= 50) ctx.fillStyle = "#00ff00";
  else if (fps >= 30) ctx.fillStyle = "#ffff00";
  else ctx.fillStyle = "#ff0000";

  ctx.font = "14px monospace";
  ctx.fillText(`FPS: ${fps}`, 10, 20);

  ctx.fillStyle = "#000000";
  ctx.fillText(`Atoms: ${atoms.length}`, 10, 40);

  ctx.fillText(`Current: ${currentAtomType}`, 10, 60);
  ctx.fillText(`Current: ${currentAtomType}`, 10, 60);
  ctx.fillText(`H2: ${moleculeCounts.H2}`, 10, 80);
  ctx.fillText(`Cl2: ${moleculeCounts.Cl2}`, 10, 100);
  ctx.fillText(`HCl: ${moleculeCounts.HCl}`, 10, 120);
}

let lastTime = performance.now();

let fps = 0;
let framesThisSecond = 0;
let lastFpsUpdate = performance.now();

let isRightMouseDown = false;
let mouseX = 0;
let mouseY = 0;

function loop(t) {
  const dt = (t - lastTime) * 0.1;
  lastTime = t;

  if (isRightMouseDown) {
    spawnAtomAt(mouseX, mouseY);
  }

  // FPS calculation
  framesThisSecond++;
  if (t - lastFpsUpdate >= 1000) {
    fps = framesThisSecond;
    framesThisSecond = 0;
    lastFpsUpdate = t;
  }

  updateFloating(dt);
  handleFloatingCollisions();
  convertToPhysical();
  updatePhysical();

  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function handleFloatingCollisions() {
  const threshold = 2; // overlap threshold

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.state !== "floating") continue;

    for (let j = i + 1; j < atoms.length; j++) {
      const b = atoms[j];
      if (b.state !== "floating") continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const r = a.radius + b.radius;

      if (!canBond(a, b)) continue;

      if (dist2 < (r + threshold) * (r + threshold)) {
        // logical bond

        const molecule = getPairMolecule(a, b);
        if (molecule) {
          // for now just log it, later hook into scoring/telemetry
          console.log("Molecule formed:", molecule, "from", a.id, b.id);
        } else continue;
        moleculeCounts[molecule] = (moleculeCounts[molecule] || 0) + 1;

        a.currentBonds++;
        b.currentBonds++;

        // store this bond with its molecule type
        bonds.push({ aId: a.id, bId: b.id, molecule });

        // mark them as 'ready' to become physical
        a.state = "toPhysical";
        b.state = "toPhysical";
        // if they already have bodies, create constraint now
        if (a.body && b.body) {
          createBondConstraint(a, b);
        }

        // // optional: color by type but darker when bonded
        // a.color = "#ffcc4f";
        // b.color = "#ffcc4f";
      }
    }
  }
}

function convertToPhysical() {
  for (const a of atoms) {
    if (a.state !== "toPhysical") continue;
    if (a.body) continue;

    const body = Matter.Bodies.circle(a.x, a.y, a.radius, {
      frictionAir: 0,
      restitution: 0.6,
    });

    // carry over current motion
    Matter.Body.setVelocity(body, { x: a.vx, y: a.vy });

    Matter.World.add(world, body);
    a.body = body;
    a.state = "physical";
  }

  // ensure all bonds have constraints once both endpoints have bodies
  for (const bond of bonds) {
    const a = atoms[bond.aId];
    const b = atoms[bond.bId];
    if (!a || !b) continue;
    if (!a.body || !b.body) continue;
    if (bond.constraint) continue;

    bond.constraint = Constraint.create({
      bodyA: a.body,
      bodyB: b.body,
      length: 30,
      stiffness: 0.9,
      damping: 0.2,
    });
    Matter.World.add(world, bond.constraint);
  }
}

function updatePhysical() {
  // step physics
  Matter.Engine.update(engine, 1000 / 60);

  // sync positions from Matter bodies back into atoms
  for (const a of atoms) {
    if (!a.body) continue;

    // small random nudges to keep things alive
    const jitter = 0.000;
    Matter.Body.applyForce(a.body, a.body.position, {
      x: (Math.random() - 0.5) * jitter,
      y: (Math.random() - 0.5) * jitter,
    });

    a.x = a.body.position.x;
    a.y = a.body.position.y;
  }
}

//mouse hold listeners
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  if (e.button === 0) {
    // left click: single spawn
    spawnAtomAt(mouseX, mouseY);
  } else if (e.button === 2) {
    // right button: hold to spawn
    isRightMouseDown = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2) {
    isRightMouseDown = false;
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

//disable default right button
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", handleResize);

window.addEventListener("keydown", (e) => {
  if (e.key === "1") currentAtomType = "H";
  if (e.key === "2") currentAtomType = "O";
  if (e.key === "3") currentAtomType = "Cl";
});

function spawnAtomAt(x, y) {
  const def = ATOM_TYPES[currentAtomType];

  const atom = {
    id: atoms.length,
    typeId: def.id,
    currentBonds: 0,
    state: "floating",
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: def.radius,
    color: def.color,
    body: null,
  };
  atoms.push(atom);
}

function handleResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // move floor to new bottom and keep it very wide
  Matter.Body.setPosition(ground, {
    x: window.innerWidth / 2,
    y: window.innerHeight + 40,
  });
}

function canBond(a, b) {
  const defA = ATOM_TYPES[a.typeId];
  const defB = ATOM_TYPES[b.typeId];

  if (a.currentBonds >= defA.maxBonds) return false;
  if (b.currentBonds >= defB.maxBonds) return false;
  return true;
}

function getPairMolecule(a, b) {
  const types = [a.typeId, b.typeId].sort().join("-");

  if (types === "H-H") return "H2";
  if (types === "Cl-Cl") return "Cl2";
  if (types === "Cl-H") return "HCl";
  // later: handle H2O when you have 3 atoms bonded
  return null;
}

function createBondConstraint(a, b) {
  const constraint = Constraint.create({
    bodyA: a.body,
    bodyB: b.body,
    length: 30, // target distance
    stiffness: 0.9, // fairly rigid
    damping: 0.2, // reduces oscillation
  });
  Matter.World.add(world, constraint);
}
