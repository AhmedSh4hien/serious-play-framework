// ─── Renderer ────────────────────────────────────────────────────────────────
// Set USE_PIXI to true to use PixiJS (WebGL), false for Canvas 2D
const USE_PIXI = false;

import * as CanvasRenderer from "../../renderers/render.js";
import * as PixiRenderer from "../../renderers/renderPixi.js";

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
import { createTelemetry } from "../../framework/telemetry.js";
import {
  createSessionUi,
  renderOverlay,
  startSimulation,
  goToQuiz,
  answerQuestion,
  restartSession,
  goToNextLevel,
  resetSessionData,
} from "../../framework/sessionUi.js";
import { createGameUi, renderGameUi } from "../../ui/gameUi.js";
import {
  initAtoms,
  decayIntermediateBonds,
  finalizeWaterMolecules,
  onBond,
  applyMouseForce,
  spawnAtomAt,
} from "./gameplay.js";
import { installInput } from "../../ui/input.js";
import "../../style.css";

const renderer = USE_PIXI ? PixiRenderer : CanvasRenderer;

// ─── Canvas setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
let ctx = USE_PIXI ? null : canvas.getContext("2d");

if (USE_PIXI) await renderer.initPixi(canvas);

const telemetry = createTelemetry({ getState: () => state });
const debugEl = document.getElementById("debug-hud");

const gameUi = createGameUi(document.getElementById("hud-root"));
let physics;
const sidebar = document.getElementById("sidebar");
const { overlay } = createSessionUi(
  document.getElementById("overlay-root"),
  sidebar
);

let lastOverlayKey = "";
let lastHudKey = "";

// ─── Key helpers ─────────────────────────────────────────────────────────────

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

// ─── Render helpers ──────────────────────────────────────────────────────────

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
      renderOverlayIfNeeded(true);
      renderHudIfNeeded(true);
    },
    onAnswer: (selectedIndex) => {
      answerQuestion(state, telemetry, selectedIndex);
      if (state.session.phase === "feedback") {
        telemetry.flushToSupabase();
      }
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

// ─── Canvas / world helpers ──────────────────────────────────────────────────

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();

  if (USE_PIXI) {
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  } else {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  // Guard: physics doesn't exist yet on the first resizeCanvas() call
  if (physics) {
    handleResizePhysics(physics, { width: rect.width, height: rect.height });
  }
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
  resetSessionData(state);
  resetWorldFromState();
  renderOverlayIfNeeded(true);
  renderHudIfNeeded(true);
}

// ─── Loop ────────────────────────────────────────────────────────────────────

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
  renderer.draw(canvas, ctx, state);

  requestAnimationFrame(loop);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener("resize", resizeCanvas);

// 1. Size the canvas correctly first
resizeCanvas();
physics = createPhysics(canvas);
// 2. Sync physics walls to match the actual canvas size
//    (createPhysics runs before resizeCanvas so walls would be at the wrong Y without this)
// handleResizePhysics(physics, {
//   width: canvas.clientWidth,
//   height: canvas.clientHeight,
// });

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

// 4. Wire up input
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

// 5. Boot
bootSession();
requestAnimationFrame(loop);