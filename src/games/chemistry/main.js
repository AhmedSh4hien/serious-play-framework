// ─── Renderer ────────────────────────────────────────────────────────────────
const USE_PIXI = false;

import * as CanvasRenderer from "../../renderers/render.js";
import * as PixiRenderer from "../../renderers/renderPixi.js";

import { state } from "./state.js";
import { canBond, getPairMolecule } from "./chemistry.js";
import { matterProvider } from "../../physics/matterProvider.js";
import { createFramework } from "../../framework/createFramework.js";
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
import { renderChemistryHud } from "./chemistryUi.js";

const renderer = USE_PIXI ? PixiRenderer : CanvasRenderer;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const debugEl = document.getElementById("debug-hud");
const sidebar = document.getElementById("sidebar");
const container = document.getElementById("overlay-root");
let ctx = USE_PIXI ? null : canvas.getContext("2d");
if (USE_PIXI) await renderer.initPixi(canvas);

// ─── Game UI (chemistry HUD) ──────────────────────────────────────────────────
const gameUi = createGameUi(document.getElementById("hud-root"));

let physics;
let lastHudKey = "";

function getHudKey() {
  const s = state.session;
  const targets = s.goal?.targets || [];
  const progressKey = targets
    .map((t) => `${t.molecule}:${s.createdItemCounts?.[t.molecule] ?? 0}`)
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

function renderHudIfNeeded(force = false) {
  const key = getHudKey();
  if (!force && key === lastHudKey) return;
  lastHudKey = key;

  renderGameUi(gameUi, state, (el) =>
    renderChemistryHud(el, state, {
      onSelectAtom: (type) => {
        state.session.selectedSpawnType = type;
        renderHudIfNeeded(true);
      },
      onToggleMode: () => {
        state.session.inputMode =
          state.session.inputMode === "drag" ? "spawn" : "drag";
        renderHudIfNeeded(true);
      },
    })
  );
}

// ─── Canvas / world helpers ───────────────────────────────────────────────────
function resizeCanvas() {
  const cont = canvas.parentElement;
  const rect = cont.getBoundingClientRect();

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

  if (physics) {
    matterProvider.handleResizePhysics(physics, {
      width: rect.width,
      height: rect.height,
    });
  }
}

function resetWorldFromState() {
  matterProvider.resetPhysicsWorld(physics);

  if (state._bodyToAtom) state._bodyToAtom.clear();

  state.atoms.length = 0;
  state.bonds.length = 0;
  state.atomById.clear();
  state.nextAtomId = 0;
  // physics-level molecule counts (used by debug HUD, separate from session)
  state.moleculeCounts = { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 };

  initAtoms(state, canvas);
  matterProvider.convertToPhysical(physics, state);
  matterProvider.ensureBondConstraints(physics, state);
}

// ─── Chemistry adapter ────────────────────────────────────────────────────────
const adapter = {
  // called once on boot -- set up physics, input, collision wiring
  initGame(state, api) {
    resizeCanvas();
    physics = matterProvider.createPhysics(canvas);

    matterProvider.installCollisionBonding(
      physics,
      state,
      { canBond, getPairMolecule },
      (a, b) => {
        onBond({
          a,
          b,
          state,
          physics,
          telemetry: { event: api.logEvent },
          onUiChange: () => {
            renderHudIfNeeded(true);
          },
        });
      }
    );

    installInput(canvas, state, {
      onSpawn: (x, y) => {
        if (state.session.phase !== "simulation") return;
        spawnAtomAt({
          x,
          y,
          state,
          telemetry: { event: api.logEvent },
          onUiChange: () => renderHudIfNeeded(true),
        });
      },
      onPrimaryDown: () => {},
    });

    window.addEventListener("resize", resizeCanvas);
  },

  // called on every restart and level change
  resetGame(state, level) {
    // chemistry-specific session fields
    state.session.inventory = { H: 0, O: 0, Cl: 0, ...(level.inventory ?? {}) };
    state.session.allowedAtomTypes = [
      ...(level.allowedAtomTypes ?? level.allowed_atom_types ?? ["H"]),
    ];
    state.session.selectedSpawnType = state.session.allowedAtomTypes[0] ?? null;
    state.session.inputMode = "spawn";

    // createdItemCounts keyed by molecule name for this level
    state.session.createdItemCounts = Object.fromEntries(
      (level.goal.targets ?? []).map((t) => [t.molecule, 0])
    );

    // chemistry-specific stats
    state.session.stats = {
      atomsSpawned: 0,
      validBonds: 0,
      invalidBondAttempts: 0,
      targetMoleculesFormed: 0,
    };

    resizeCanvas();
    resetWorldFromState();
    renderHudIfNeeded(true);
  },

  // called every frame during simulation
  updateGame(dt, state, api) {
    const t = performance.now();
    const s = state.session;
    if (s.phase === "simulation") {
      const currentType = s.selectedSpawnType;
      if (currentType && (s.inventory[currentType] ?? 0) <= 0) {
        // find next type with remaining inventory
        const nextType = s.allowedAtomTypes.find(
          (t) => (s.inventory[t] ?? 0) > 0
        );
        if (nextType) {
          s.selectedSpawnType = nextType;
          renderHudIfNeeded(true);
        } else {
          // nothing left — switch to drag mode
          if (s.inputMode !== "drag") {
            s.inputMode = "drag";
            renderHudIfNeeded(true);
          }
        }
      }
    }
    decayIntermediateBonds({ now: t, state, physics });

    finalizeWaterMolecules({
      state,
      onUiChange: () => renderHudIfNeeded(true),
    });

    if (debugEl) {
      debugEl.innerHTML =
        `FPS: ${state.fps}<br>` +
        `Atoms: ${state.atoms.length}<br>` +
        `Mode: ${state.session.inputMode}<br>` +
        `H2: ${state.moleculeCounts.H2} | O2: ${state.moleculeCounts.O2} | Cl2: ${state.moleculeCounts.Cl2}`;
    }

    matterProvider.convertToPhysical(physics, state);
    matterProvider.ensureBondConstraints(physics, state);
    applyMouseForce({ state, physics });
    matterProvider.updatePhysical(physics, state);
    renderer.draw(canvas, ctx, state);
  },

  // sidebar during simulation -- chemistry goal progress
  renderSidebarContent(state) {
    const s = state.session;
    const rows = (s.goal.targets || [])
      .map(
        (t) =>
          `<p>${t.molecule}: ${s.createdItemCounts?.[t.molecule] ?? 0} / ${
            t.targetCount
          }</p>`
      )
      .join("");

    return `
      <h3>Goal</h3>
      ${rows}
      <hr/>
      <p>Atoms spawned: ${s.stats.atomsSpawned ?? 0}</p>
    `;
  },

  // feedback panel stats
  renderFeedbackStats(state) {
    const s = state.session;
    const rows = (s.goal.targets || [])
      .map(
        (t) =>
          `<p>${t.molecule}: ${s.createdItemCounts?.[t.molecule] ?? 0} / ${
            t.targetCount
          }</p>`
      )
      .join("");

    return `
      <div class="goal-progress">${rows}</div>
      <p>Atoms spawned: ${s.stats.atomsSpawned}</p>
      <p>Valid bonds formed: ${s.stats.validBonds}</p>
    `;
  },
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
const fw = await createFramework({
  gameId: "chemistry",
  adapter,
  container,
  sidebar,
  state,
  onTelemetryFlush: ({ success, eventCount }) => {
    if (success)
      console.info(`[chemistry] telemetry flushed: ${eventCount} events`);
  },
});

fw.start();
