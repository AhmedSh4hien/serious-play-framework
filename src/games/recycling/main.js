import * as PIXI from "pixi.js";
import { state } from "./state.js";
import { preloadAssets, resetWorld } from "./gameplay.js";
import { startTimer, checkTimedOut, getRemainingSeconds } from "./recycling.js";
import { createFramework } from "../../framework/createFramework.js";
import { renderRecyclingHud } from "./recyclingUi.js";
import "../../style.css";

let app;
let appReady = false; // ← NEW
let timerText = null;
let fwApi;

const container = document.getElementById("overlay-root");
const sidebar = document.getElementById("sidebar");

// ── Pixi timer overlay ───────────────────────────────────────────────────────

function initTimerText() {
  if (timerText) app.stage.removeChild(timerText);
  timerText = new PIXI.Text("", {
    fontSize: 20,
    fontWeight: "bold",
    fill: 0xffffff,
  });
  timerText.x = 16;
  timerText.y = 16;
  app.stage.addChild(timerText);
}

function updateTimerText() {
  if (!timerText || state.session.phase !== "simulation") return;
  const secs = Math.ceil(getRemainingSeconds(state));
  timerText.text = `⏱ ${secs}s`;
  timerText.style.fill = secs <= 10 ? 0xff4444 : 0xffffff;
}

// ── Recycling adapter ────────────────────────────────────────────────────────

const adapter = {
  async initGame(state, api) {
    fwApi = api;

    if (document.readyState === "loading") {
      await new Promise((resolve) =>
        document.addEventListener("DOMContentLoaded", resolve, { once: true })
      );
    }

    const gameRoot = document.getElementById("game-root");
    if (!gameRoot) throw new Error("Missing #game-root");

    app = new PIXI.Application();
    await app.init({
      resizeTo: gameRoot,
      background: 0x1a1a2e,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    appReady = true; // ← NEW: Pixi is fully initialized now

    gameRoot.appendChild(app.canvas);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    app.ticker.add(() => {
      if (state.session.phase !== "simulation") return;
      updateTimerText();
      checkTimedOut(state, { event: api.logEvent }, () => {
        api.finishSimulation();
      });
    });

    await preloadAssets();

    // Pixi is ready — build the world for the first time
    resetWorld(app, state, { event: (n, d) => fwApi?.logEvent(n, d) });
  },

  resetGame(state, level) {
    state.session._levelData = level;
    state.score = 0;
    state.sortedTotal = 0;
    state.correctDrops = {};
    state.session.timerStartedAt = null;
    state.session.timedOut = false;
    state.session.createdItemCounts = Object.fromEntries(
      (level.goal.targets ?? []).map((t) => [t.binId, 0])
    );
    state.session.stats = {};

    if (!appReady) return; // ← CHANGED: guard on appReady, not app
    resetWorld(app, state, { event: (n, d) => fwApi?.logEvent(n, d) });
    if (state.session.phase === "simulation") {
      startTimer(state, level.id);
      initTimerText();
    }
  },

  updateGame(_dt, _state, _api) {},

  renderSidebarContent(state) {
    const secs = Math.ceil(getRemainingSeconds(state));
    const timeStr =
      state.session.phase === "simulation"
        ? `<p>⏱ Time left: <strong>${secs}s</strong></p>`
        : "";
    return `
      <h3>Score</h3>
      <p>✅ Sorted correctly: <strong>${state.score}</strong></p>
      <p>📦 Total attempts: ${state.sortedTotal}</p>
      ${timeStr}
    `;
  },

  renderFeedbackStats(state) {
    const accuracy =
      state.sortedTotal > 0
        ? Math.round((state.score / state.sortedTotal) * 100)
        : 0;
    return `
      <div class="goal-progress">
        <p>Components sorted correctly: <strong>${state.score}</strong> / ${state.sortedTotal}</p>
        <p>Accuracy: <strong>${accuracy}%</strong></p>
      </div>
    `;
  },
};

// ── Boot ─────────────────────────────────────────────────────────────────────

const fw = await createFramework({
  gameId: "recycling",
  adapter,
  container,
  sidebar,
  state,
  onTelemetryFlush: ({ success, eventCount }) => {
    if (success) console.info(`[recycling] telemetry flushed: ${eventCount} events`);
  },
});
fw.start();