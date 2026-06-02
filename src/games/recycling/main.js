import * as PIXI from 'pixi.js';
import { state } from './state.js';
import { LEVELS } from './levelsConfig.js';
import { resetWorld } from './gameplay.js';
import { startTimer, checkTimedOut, getRemainingSeconds } from './recycling.js';
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
import { createGameUi, renderGameUi } from '../../ui/gameUi.js';
import { renderRecyclingHud } from './recyclingUi.js';
import '../../style.css';

const telemetry = createTelemetry({ getState: () => state });

let app;
let timerText = null;
let lastOverlayKey = '';
let sidebar;
let gameUi;
let overlay;

function getOverlayKey() {
  const s = state.session;
  return [s.phase, s.quiz?.currentIndex ?? 0, s.quiz?.score ?? 0, state.score].join('|');
}

function renderHudIfNeeded() {
  renderGameUi(gameUi, state, (el) => renderRecyclingHud(el, state));
}

function renderOverlayIfNeeded(force = false) {
  const key = getOverlayKey();
  if (!force && key === lastOverlayKey) return;
  lastOverlayKey = key;

  renderOverlay(overlay, sidebar, state, {
    onStart: () => {
      startSimulation(state, telemetry);
      const levelId = LEVELS[state.session.currentLevelIndex]?.id ?? 'recycling-1';
      startTimer(state, levelId);
      resetWorld(app, state, telemetry);
      initTimerText();
      renderOverlayIfNeeded(true);
      renderHudIfNeeded();
    },
    onFinishSimulation: () => {
      goToQuiz(state, telemetry);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded();
    },
    onAnswer: (selectedIndex) => {
      answerQuestion(state, telemetry, selectedIndex);
      if (state.session.phase === 'feedback') {
        telemetry.flushToSupabase();
      }
      renderOverlayIfNeeded(true);
      renderHudIfNeeded();
    },
    onRestart: () => {
      restartSession(state, telemetry);
      telemetry.flushToSupabase();
      resetWorld(app, state, telemetry);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded();
    },
    onNextLevel: () => {
      goToNextLevel(state, telemetry);
      loadLevelIntoState(state.session.currentLevelIndex);
      resetWorld(app, state, telemetry);
      renderOverlayIfNeeded(true);
      renderHudIfNeeded();
    },
  });
}

function initTimerText() {
  if (timerText) app.stage.removeChild(timerText);
  timerText = new PIXI.Text('', {
    fontSize: 20,
    fontWeight: 'bold',
    fill: 0xffffff,
  });
  timerText.x = 16;
  timerText.y = 16;
  app.stage.addChild(timerText);
}

function updateTimerText() {
  if (!timerText || state.session.phase !== 'simulation') return;
  const secs = Math.ceil(getRemainingSeconds(state));
  timerText.text = `⏱ ${secs}s`;
  timerText.style.fill = secs <= 10 ? 0xff4444 : 0xffffff;
}

function watchGoal() {
  if (state.session.phase !== 'simulation') return;
  checkTimedOut(state, telemetry, () => {
    goToQuiz(state, telemetry);
    renderOverlayIfNeeded(true);
  });
}

function loadLevelIntoState(index) {
  const level = LEVELS[index] ?? LEVELS[0];
  const s = state.session;
  s.topic = level.topic;
  s.title = level.title;
  s.prompt = level.prompt;
  s.goal = { ...level.goal, completed: false, completedAtMs: null };
  s.quiz.questions = level.quizQuestions;
  s.quiz.currentIndex = 0;
  s.quiz.score = 0;
  s.quiz.answers = [];
  state.correctDrops = {};
  state.score = 0;
  state.sortedTotal = 0;
  state.session.timerStartedAt = null;
  state.session.timedOut = false;
}

function bootSession() {
  resetSessionData(state);
  loadLevelIntoState(0);
  resetWorld(app, state, telemetry);
  renderOverlayIfNeeded(true);
  renderHudIfNeeded();
}

async function initGame() {
  if (document.readyState === 'loading') {
    await new Promise((resolve) =>
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    );
  }

  const gameRoot = document.getElementById('game-root');
  if (!gameRoot) throw new Error('Missing #game-root');

  // DOM is ready — safe to query elements
  sidebar = document.getElementById('sidebar');
  gameUi = createGameUi(document.getElementById('hud-root'));
  ({ overlay } = createSessionUi(
    document.getElementById('overlay-root'),
    sidebar,
    LEVELS
  ));

  app = new PIXI.Application();
  await app.init({
    resizeTo: gameRoot,
    background: 0x1a1a2e,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });

  gameRoot.appendChild(app.canvas);
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  state._onUiChange = () => {
    renderOverlayIfNeeded(true);
    renderHudIfNeeded();
  };

  app.ticker.add(() => {
    watchGoal();
    updateTimerText();
  });

  app.ticker.addOnce(() => bootSession());
}

initGame().catch((e) => {
  const hud = document.getElementById('debug-hud');
  if (hud) hud.textContent = `${e.name}: ${e.message}`;
  console.error(e);
});