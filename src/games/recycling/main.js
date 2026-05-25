import * as PIXI from 'pixi.js';
import { state } from './state.js';
import { LEVELS } from './levelsConfig.js';
import { resetWorld } from './gameplay.js';
import { createTelemetry } from '../../framework/telemetry.js';
import {
  createSessionUi,
  renderOverlay,
  startSimulation,
  goToQuiz,
  answerQuestion,
  restartSession,
  goToNextLevel,
  resetSessionData,
} from '../../framework/sessionUi.js';
import '../../style.css';



// ─── PixiJS app ───────────────────────────────────────────────────────────────

// ─── PixiJS app ───────────────────────────────────────────────────────────────

window.addEventListener('unhandledrejection', (e) => {
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:1rem;font-size:12px">UNHANDLED: ${e.reason?.stack ?? e.reason}</pre>`
  );
});

await new Promise(r => {
  if (document.readyState !== 'loading') r();
  else document.addEventListener('DOMContentLoaded', r, { once: true });
});

const gameRoot = document.getElementById('game-root');
if (!gameRoot) {
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:1rem">game-root is NULL</pre>`
  );
  throw new Error('game-root is null');
}

const app = new PIXI.Application();
try {
  await app.init({
    resizeTo: gameRoot,
    background: 0x1a1a2e,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;top:0;left:0;background:green;color:white;z-index:9999;padding:1rem">PIXI OK</pre>`
  );
} catch (e) {
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:1rem">PIXI FAILED: ${e.stack}</pre>`
  );
  throw e;
}
// ─── Framework modules ────────────────────────────────────────────────────────

const telemetry = createTelemetry({ getState: () => state });

const sidebar = document.getElementById('sidebar');
const { overlay } = createSessionUi(
    document.getElementById('overlay-root'),
    sidebar,
    LEVELS  
  );

// ─── Overlay key (same dirty-check pattern as chemistry) ─────────────────────

let lastOverlayKey = '';

function getOverlayKey() {
  const s = state.session;
  return [s.phase, s.quiz?.currentIndex ?? 0, s.quiz?.score ?? 0].join('|');
}

function renderOverlayIfNeeded(force = false) {
  const key = getOverlayKey();
  if (!force && key === lastOverlayKey) return;
  lastOverlayKey = key;

  renderOverlay(overlay, sidebar, state, {
    onStart: () => {
      startSimulation(state, telemetry);
      resetWorld(app, state, telemetry);
      renderOverlayIfNeeded(true);
    },
    onFinishSimulation: () => {
      goToQuiz(state, telemetry);
      renderOverlayIfNeeded(true);
    },
    onAnswer: (selectedIndex) => {
      answerQuestion(state, telemetry, selectedIndex);
      if (state.session.phase === 'feedback') {
        telemetry.flushToSupabase();
      }
      renderOverlayIfNeeded(true);
    },
    onRestart: () => {
      restartSession(state, telemetry);
      telemetry.flushToSupabase();
      resetWorld(app, state, telemetry);
      renderOverlayIfNeeded(true);
    },
    onNextLevel: () => {
      goToNextLevel(state, telemetry);
      loadLevelIntoState(state.session.currentLevelIndex);
      resetWorld(app, state, telemetry);
      renderOverlayIfNeeded(true);
    },
  });
}

// ─── Level hydration ──────────────────────────────────────────────────────────

function loadLevelIntoState(index) {
  const level = LEVELS[index] ?? LEVELS[0];
  const s = state.session;
  s.topic  = level.topic;
  s.title  = level.title;
  s.prompt = level.prompt;
  s.goal   = { ...level.goal, completed: false, completedAtMs: null };
  s.quiz.questions  = level.quizQuestions;
  s.quiz.currentIndex = 0;
  s.quiz.score = 0;
  s.quiz.answers = [];
  state.correctDrops = {};
}

// ─── Goal watcher — triggers quiz transition automatically ───────────────────

function watchGoal() {
  if (
    state.session.phase === 'simulation' &&
    state.session.goal.completed
  ) {
    goToQuiz(state, telemetry);
    renderOverlayIfNeeded(true);
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────────

app.ticker.add(() => {
  watchGoal();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

function bootSession() {
  resetSessionData(state);
  loadLevelIntoState(0);
  renderOverlayIfNeeded(true);
}

bootSession();