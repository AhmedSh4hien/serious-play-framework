import { state } from "./state.js";
import { canBond, getPairMolecule } from "./chemistry.js";
import {
  createPhysics,
  handleResizePhysics,
  convertToPhysical,
  ensureBondConstraints,
  updatePhysical,
  installCollisionBonding,
  resetPhysicsWorld,
} from "./physics.js";
import { draw } from "./render.js";
import { createTelemetry } from "./telemetry.js";
import {
  createSessionUi,
  renderOverlay,
  startSimulation,
  goToQuiz,
  answerQuestion,
  restartSession,
  goToNextLevel,
} from "./sessionUi.js";
import { createGameUi, renderGameUi } from "./gameUi.js";
import {
  initAtoms,
  decayIntermediateBonds,
  finalizeWaterMolecules,
  onBond,
  applyMouseForce,
  spawnAtomAt,
} from "./gameplay.js";
import { installInput } from "./input.js";
import "./style.css";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const telemetry = createTelemetry({ getState: () => state });
const debugEl = document.getElementById("debug-hud");

const gameUi = createGameUi(document.getElementById("hud-root"));
const physics = createPhysics(canvas);
const sidebar = document.getElementById("sidebar");
const { overlay } = createSessionUi(
  document.getElementById("overlay-root"),
  sidebar
);

let lastOverlayKey = "";
let lastHudKey = "";

function getOverlayKey() {
  const s = state.session;
  return [s.phase, s.quiz?.currentIndex ?? 0, s.quiz?.score ?? 0].join("|");
}

function getHudKey() {
  const s = state.session;
  const targets = s.goal?.targets || [];
  const progressKey = targets
    .map((t) => `${t.molecule}:${s.createdMoleculeCounts?.[t.molecule] ?? 0}`)
    .join("|");
  return [
    s.phase,
    s.inputMode,
    s.selectedSpawnType,
    s.inventory?.H ?? 0,
    s.inventory?.O ?? 0,
    s.inventory?.Cl ?? 0,
    progressKey,
  ].join("|");
}

function renderOverlayIfNeeded(force = false) {
  const key = getOverlayKey();
  if (!force && key === lastOverlayKey) return;
  lastOverlayKey = key;

  renderOverlay(overlay, sidebar, state, {
    onStart: () => {
      startSimulation(state, telemetry);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
      requestAnimationFrame(() => {
        resizeCanvas();
        resetWorldFromState(); 
        renderHudIfNeeded(true);
      });
    },
    onFinishSimulation: () => {
      goToQuiz(state, telemetry);
      telemetry.flushToSupabase();
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onAnswer: (selectedIndex) => {
      answerQuestion(state, telemetry, selectedIndex);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onRestart: () => {
      restartSession(state, telemetry);
      telemetry.flushToSupabase();
      resizeCanvas();
      resetWorldFromState();
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onNextLevel: () => {
      goToNextLevel(state, telemetry);
      resizeCanvas();
      resetWorldFromState();
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
  });
}

function renderHudIfNeeded(force = false) {
  const key = getHudKey();
  if (!force && key === lastHudKey) return;
  lastHudKey = key;

  renderGameUi(gameUi, state, {
    onSelectAtom: (type) => {
      state.session.selectedSpawnType = type;
      renderHudIfNeeded(true);
    },
    onToggleMode: () => {
      state.session.inputMode =
        state.session.inputMode === "drag" ? "spawn" : "drag";
      renderHudIfNeeded(true);
    },
  });
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  handleResizePhysics(physics, {
    width: rect.width,
    height: rect.height,
  });
}

function resetWorldFromState() {
  resetPhysicsWorld(physics);

  if (state._bodyToAtom) state._bodyToAtom.clear();

  state.atoms.length = 0;
  state.bonds.length = 0;
  state.atomById.clear();
  state.nextAtomId = 0;
  state.moleculeCounts = { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 };

  initAtoms(state, canvas);
  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);
}

function bootSession() {
  restartSession(state, telemetry);
  resetWorldFromState();
  renderOverlayIfNeeded(true);
  renderHudIfNeeded(true);
}

function updateFps(t) {
  state.framesThisSecond++;
  if (t - state.lastFpsUpdate >= 1000) {
    state.fps = state.framesThisSecond;
    state.framesThisSecond = 0;
    state.lastFpsUpdate = t;
  }
}

function loop(t) {
  const dt = (t - state.lastTime) * 0.1;
  state.lastTime = t;

  updateFps(t);

  decayIntermediateBonds({ now: t, state, physics });

  finalizeWaterMolecules({
    state,
    onUiChange: () => {
      renderHudIfNeeded(true);
      renderOverlayIfNeeded(true);
    },
  });

  if (debugEl) {
    debugEl.innerHTML =
      `FPS: ${state.fps}<br>` +
      `Atoms: ${state.atoms.length}<br>` +
      `Mode: ${state.session.inputMode}<br>` +
      `H2: ${state.moleculeCounts.H2} | O2: ${state.moleculeCounts.O2} | Cl2: ${state.moleculeCounts.Cl2}`;
  }

  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);
  applyMouseForce({ state, physics });
  updatePhysical(physics, state);
  draw(canvas, ctx, state);

  requestAnimationFrame(loop);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener("resize", resizeCanvas);

// 1. Size the canvas correctly first
resizeCanvas();

// 2. Sync physics walls to match the actual canvas size
//    (createPhysics runs before resizeCanvas so walls would be at the wrong Y without this)
handleResizePhysics(physics, {
  width: canvas.clientWidth,
  height: canvas.clientHeight,
});

// 3. Wire up collision bonding
installCollisionBonding(
  physics,
  state,
  { canBond, getPairMolecule },
  (a, b) => {
    onBond({
      a, b, state, physics, telemetry,
      onUiChange: () => {
        renderHudIfNeeded(true);
        renderOverlayIfNeeded(true);
      },
    });
  }
);

// 4. Wire up input — spawn and drag are mode-aware in input.js
installInput(canvas, state, {
  onSpawn: (x, y) => {
    if (state.session.phase !== "simulation") return;
    spawnAtomAt({
      x,
      y,
      state,
      telemetry,
      onUiChange: () => {
        renderHudIfNeeded(true);
      },
    });
  },
  onPrimaryDown: () => {
    // drag is handled by applyMouseForce reading state.input directly
  },
});

// 5. Start session (calls resetWorldFromState internally — no need to call it separately)
bootSession();
console.log("physics size:", physics.width, physics.height);
console.log("canvas CSS size:", canvas.clientWidth, canvas.clientHeight);
telemetry.event("session_phase_changed", { phase: state.session.phase });
requestAnimationFrame(loop);