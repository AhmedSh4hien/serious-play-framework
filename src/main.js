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
  goToNextLevel
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

const overlay = createSessionUi();
const gameUi = createGameUi();
const physics = createPhysics(canvas);

let lastOverlayKey = "";
let lastHudKey = "";

function getOverlayKey() {
  const s = state.session;
  return [s.phase, s.quiz?.currentIndex ?? 0, s.quiz?.score ?? 0].join("|");
}

function getHudKey() {
  const s = state.session;
  return [
    s.phase,
    s.selectedSpawnType,
    s.inventory?.H ?? 0,
    s.inventory?.O ?? 0,
    s.inventory?.Cl ?? 0,
    s.createdMoleculeCounts?.[s.goal?.molecule] ?? 0,
    ].join("|");
}

function renderOverlayIfNeeded(force = false) {
  const key = getOverlayKey();
  if (!force && key === lastOverlayKey) return;
  lastOverlayKey = key;

  renderOverlay(overlay, state, {
    onStart: () => {
      startSimulation(state, telemetry);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onFinishSimulation: () => {
      goToQuiz(state, telemetry);
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
      resetWorldFromState();
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onNextLevel: () => {
      goToNextLevel(state, telemetry);
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
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  handleResizePhysics(physics, canvas);
}

function bootSession() {
  restartSession(state, telemetry);
  resetWorldFromState();
  renderOverlayIfNeeded(true);
  renderHudIfNeeded(true);
}

function resetWorldFromState() {
  resetPhysicsWorld(physics);

  if (state._bodyToAtom) {
    state._bodyToAtom.clear();
  }

  state.atoms.length = 0;
  state.bonds.length = 0;
  state.atomById.clear();
  state.nextAtomId = 0;
  state.moleculeCounts = { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 };

  initAtoms(state, canvas);
  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

resetWorldFromState();

installCollisionBonding(
  physics,
  state,
  { canBond, getPairMolecule },
  (a, b) => {
    onBond({
      a,
      b,
      state,
      physics,
      telemetry,
      onUiChange: () => {
        renderHudIfNeeded(true);
        renderOverlayIfNeeded(true);
      },
    });
  }
);

installInput(canvas, state, {
  onPrimaryDown: (x, y) => {
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
});

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

  decayIntermediateBonds({
    now: t,
    state,
    physics,
  });

  finalizeWaterMolecules({
    state,
    onUiChange: () => {
      renderHudIfNeeded(true);
      renderOverlayIfNeeded(true);
    },
  });

  convertToPhysical(physics, state);
  ensureBondConstraints(physics, state);

  applyMouseForce({ state, physics });
  updatePhysical(physics, state, canvas);

  draw(canvas, ctx, state);
  telemetry.tickUi();

  requestAnimationFrame(loop);
}

bootSession();
telemetry.event("session_phase_changed", { phase: state.session.phase });
requestAnimationFrame(loop);
