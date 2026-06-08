import { createFrameworkState } from "./state.js";
import { createTelemetry } from "./telemetry.js";
import {
  createSessionUi,
  renderOverlay,
  startSimulation,
  goToQuiz,
  answerQuestion,
  resetSessionData,
  restartSession,
  goToNextLevel,
} from "./sessionUi.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function loadLevels(gameId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/levels?game_id=eq.${gameId}&order=sort_order.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok)
    throw new Error(`[framework] Failed to load levels for game: "${gameId}"`);
  const levels = await res.json();
  if (!levels.length)
    throw new Error(`[framework] No levels found for game: "${gameId}"`);
  return levels;
}

export async function createFramework({
  gameId,
  adapter,
  container,
  sidebar,
  state: externalState,
  onTelemetryFlush,
}) {
  const levels = await loadLevels(gameId);
  if (!levels?.length) throw new Error("[framework] levels array is required");
  if (!adapter) throw new Error("[framework] adapter is required");
  if (typeof adapter.initGame !== "function")
    throw new Error("[framework] adapter.initGame() is required");
  if (typeof adapter.resetGame !== "function")
    throw new Error("[framework] adapter.resetGame() is required");
  if (typeof adapter.updateGame !== "function")
    throw new Error("[framework] adapter.updateGame() is required");

  const state = externalState ?? createFrameworkState();

  const telemetry = createTelemetry({
    getState: () => state,
    onFlush: onTelemetryFlush,
  });

  const api = {
    getState: () => state,
    logEvent: (name, data) => telemetry.event(name, data),
    flushTelemetry: () => telemetry.flushToSupabase(),
    downloadTelemetry: () => telemetry.downloadJson(),
    finishSimulation: () => {
      goToQuiz(state, telemetry);
      renderOverlay(overlay, sidebar, state, actions);
    },
  };

  const { overlay } = createSessionUi(container, sidebar, levels, adapter);

  // ── sidebar helpers ──────────────────────────────────────────────────
  function writeSidebar() {
    if (!sidebar) return;
    const gameContent = adapter.renderSidebarContent?.(state) ?? "";
    sidebar.innerHTML = `
      <div class="panel panel--sidebar">
        ${gameContent}
        <hr/>
        <div class="sim-actions">
          <button id="restartSimBtn" type="button" title="Restart">↻</button>
          <button id="finishSimBtn" type="button">Finish &amp; Continue</button>
        </div>
      </div>
    `;
    sidebar.querySelector("#finishSimBtn").onclick = actions.onFinishSimulation;
    sidebar.querySelector("#restartSimBtn").onclick = actions.onRestart;
  }

  function refreshSidebar() {
    if (!sidebar) return;
    const gameContent = adapter.renderSidebarContent?.(state) ?? "";
    const panel = sidebar.querySelector(".panel--sidebar");
    if (!panel) {
      writeSidebar();
      return;
    }
    // update only the content area div, not the buttons
    let contentDiv = panel.querySelector(".sidebar-game-content");
    if (!contentDiv) {
      // first time -- inject the content div and buttons properly
      writeSidebar();
      // wrap game content in a stable div for future updates
      const newPanel = sidebar.querySelector(".panel--sidebar");
      if (newPanel) {
        const actionsEl = newPanel.querySelector(".sim-actions");
        const wrapper = document.createElement("div");
        wrapper.className = "sidebar-game-content";
        // move all nodes before actionsEl into the wrapper
        while (newPanel.firstChild !== actionsEl) {
          wrapper.appendChild(newPanel.firstChild);
        }
        newPanel.insertBefore(wrapper, actionsEl);
      }
      return;
    }
    contentDiv.innerHTML = gameContent;
  }

  // ── lifecycle actions ────────────────────────────────────────────────
  const actions = {
    onStart() {
      startSimulation(state, telemetry);
      const level = levels[state.session.currentLevelIndex ?? 0];
      adapter.resetGame(state, level);
      renderOverlay(overlay, sidebar, state, actions);
      writeSidebar();
    },
    onFinishSimulation() {
      goToQuiz(state, telemetry);
      renderOverlay(overlay, sidebar, state, actions);
    },
    onAnswer(selectedIndex) {
      answerQuestion(state, telemetry, selectedIndex);
      renderOverlay(overlay, sidebar, state, actions);
    },
    onRestart() {
      restartSession(state, telemetry);
      const level = levels[state.session.currentLevelIndex ?? 0];
      adapter.resetGame(state, level);
      renderOverlay(overlay, sidebar, state, actions);
      writeSidebar();
    },
    onNextLevel() {
      goToNextLevel(state, telemetry);
      const level = levels[state.session.currentLevelIndex ?? 0];
      adapter.resetGame(state, level);
      renderOverlay(overlay, sidebar, state, actions);
      writeSidebar();
    },
  };

  // ── game loop ────────────────────────────────────────────────────────
  let rafId = null;

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    const dt = Math.min((now - state.lastTime) / 1000, 0.05);
    state.lastTime = now;

    state.framesThisSecond++;
    if (now - state.lastFpsUpdate >= 1000) {
      state.fps = state.framesThisSecond;
      state.framesThisSecond = 0;
      state.lastFpsUpdate = now;
    }

    if (state.session.phase === "simulation") {
      adapter.updateGame(dt, state, api);
      refreshSidebar();
    }
  }

  return {
    start() {
      adapter.initGame(state, api);
      resetSessionData(state);
      const level = levels[state.session.currentLevelIndex ?? 0];
      adapter.resetGame(state, level); // ← add this
      renderOverlay(overlay, sidebar, state, actions);
      rafId = requestAnimationFrame(loop);
      telemetry.event("session_start", {
        levelId: levels[0]?.id,
        totalLevels: levels.length,
      });
    },
    stop() {
      if (rafId) cancelAnimationFrame(rafId);
      telemetry.flushToSupabase();
    },
    api,
  };
}
