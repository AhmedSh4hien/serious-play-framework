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
import "./style.css";
 

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const telemetry = createTelemetry({ getState: () => state });

const overlay = document.createElement("div");
overlay.id = "sessionOverlay";
document.body.appendChild(overlay);

function renderOverlay() {
  const s = state.session;
  overlay.className = `phase-${s.phase}`;

  if (s.phase === "intro") {
    overlay.innerHTML = `
      <div class="panel">
        <h2>Intro</h2>
        <p>${s.prompt}</p>
        <p><strong>Goal:</strong> Create ${s.goal.targetCount} ${s.goal.molecule} molecules.</p>
        <button id="startSessionBtn">Start</button>
      </div>
    `;
    document.getElementById("startSessionBtn").onclick = startSimulation;
    return;
  }

  if (s.phase === "simulation") {
    overlay.innerHTML = `
      <div class="panel panel--small">
        <h3>Goal</h3>
        <p>Create ${s.goal.targetCount} ${s.goal.molecule} molecules.</p>
        <p>Current: ${state.moleculeCounts[s.goal.molecule] || 0}</p>
        <button id="finishSimBtn">Finish & Continue</button>
      </div>
    `;
    document.getElementById("finishSimBtn").onclick = goToQuiz;
    return;
  }

  if (s.phase === "quiz") {
    const q = s.quiz.questions[s.quiz.currentIndex];
    overlay.innerHTML = `
      <div class="panel">
        <h2>Question ${s.quiz.currentIndex + 1}/${s.quiz.questions.length}</h2>
        <p>${q.text}</p>
        <div class="answers">
          ${q.options.map((opt, i) => `
            <button class="answerBtn" data-index="${i}">${opt}</button>
          `).join("")}
        </div>
      </div>
    `;
    document.querySelectorAll(".answerBtn").forEach((btn) => {
      btn.onclick = () => answerQuestion(Number(btn.dataset.index));
    });
    return;
  }

  if (s.phase === "feedback") {
    overlay.innerHTML = `
      <div class="panel">
        <h2>Feedback</h2>
        <p>Quiz score: ${s.quiz.score}/${s.quiz.questions.length}</p>
        <p>Atoms spawned: ${s.stats.atomsSpawned}</p>
        <p>Valid bonds formed: ${s.stats.validBonds}</p>
        <p>${s.goal.molecule} formed: ${state.moleculeCounts[s.goal.molecule] || 0}</p>
        <button id="restartSessionBtn">Restart session</button>
      </div>
    `;
    document.getElementById("restartSessionBtn").onclick = restartSession;
  }
}


function startSimulation() {
  state.session.phase = "simulation";
  state.session.startedAtMs ??= performance.now();
  state.session.simStartedAtMs = performance.now();
  telemetry.event("session_phase_changed", { phase: "simulation" });
  renderOverlay();
}

function goToQuiz() {
  state.session.phase = "quiz";
  state.session.simEndedAtMs = performance.now();
  telemetry.event("session_phase_changed", { phase: "quiz" });
  renderOverlay();
}

function answerQuestion(selectedIndex) {
  const quiz = state.session.quiz;
  const q = quiz.questions[quiz.currentIndex];
  const correct = selectedIndex === q.correctIndex;

  quiz.answers.push({
    questionId: q.id,
    selectedIndex,
    correct,
  });

  if (correct) quiz.score++;

  telemetry.event("quiz_answered", {
    questionId: q.id,
    selectedIndex,
    correct,
  });

  quiz.currentIndex++;

  if (quiz.currentIndex >= quiz.questions.length) {
    state.session.phase = "feedback";
    telemetry.event("session_phase_changed", { phase: "feedback" });
  }

  renderOverlay();
}

function resetSessionData() {
  state.session.phase = "intro";
  state.session.goal.completed = false;
  state.session.goal.completedAtMs = null;
  state.session.startedAtMs = null;
  state.session.simStartedAtMs = null;
  state.session.simEndedAtMs = null;

  state.session.quiz.currentIndex = 0;
  state.session.quiz.answers = [];
  state.session.quiz.score = 0;

  state.session.stats.atomsSpawned = 0;
  state.session.stats.validBonds = 0;
  state.session.stats.invalidBondAttempts = 0;
  state.session.stats.targetMoleculesFormed = 0;
}

function restartSession() {
  resetSessionData();
  telemetry.event("session_restarted");
  renderOverlay();
}

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
  if (!a.body || !b.body) return;
  if (alreadyBonded(a, b)) return;
  if (!canBond(a, b)) return;

  const molecule = getPairMolecule(a, b);
  if (!molecule) return;

  state.session.stats.validBonds++;

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
  bond.constraint = createBondConstraint(physics, a, b);

  finalizeWaterMolecules();

  const goal = state.session.goal;
  const currentTargetCount = state.moleculeCounts[goal.molecule] || 0;
  state.session.stats.targetMoleculesFormed = currentTargetCount;

  if (
    state.session.phase === "simulation" &&
    !goal.completed &&
    currentTargetCount >= goal.targetCount
  ) {
    goal.completed = true;
    goal.completedAtMs = performance.now();
    telemetry.event("goal_completed", {
      molecule: goal.molecule,
      targetCount: goal.targetCount,
      actualCount: currentTargetCount,
    });
  }

  telemetry.event("bond_formed", {
    molecule,
    aType: a.typeId,
    bType: b.typeId,
    aId: a.id,
    bId: b.id,
  });
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
  if (state.session.phase !== "simulation") return;

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

  state.session.stats.atomsSpawned++;
  telemetry.event("atom_spawned", {
    type: def.id,
    x: Math.round(x),
    y: Math.round(y),
    phase: state.session.phase,
  });

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

  if (state.session.phase === "simulation" && state.input.isRightMouseDown) {

    const r = 50; // spawn radius in px (tweak 10–40)
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * r;

    const x = state.input.mouseX + Math.cos(ang) * rad;
    const y = state.input.mouseY + Math.sin(ang) * rad;

    spawnAtomAt(x, y);
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

renderOverlay();
telemetry.event("session_phase_changed", { phase: state.session.phase });

requestAnimationFrame(loop);
