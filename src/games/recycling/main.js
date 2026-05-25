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

const telemetry = createTelemetry({ getState: () => state });

const sidebar = document.getElementById('sidebar');
const { overlay } = createSessionUi(
  document.getElementById('overlay-root'),
  sidebar,
  LEVELS
);

let app;
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
}

function watchGoal() {
  if (state.session.phase === 'simulation' && state.session.goal.completed) {
    goToQuiz(state, telemetry);
    renderOverlayIfNeeded(true);
  }
}

function bootSession() {
  resetSessionData(state);
  loadLevelIntoState(0);
  resetWorld(app, state, telemetry);
  renderOverlayIfNeeded(true);
}

async function initGame() {
  if (document.readyState === 'loading') {
    await new Promise((resolve) =>
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    );
  }

  const gameRoot = document.getElementById('game-root');
  if (!gameRoot) throw new Error('Missing #game-root');

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

  app.ticker.add(() => {
    watchGoal();
  });

  bootSession();
}

initGame().catch((e) => {
  const hud = document.getElementById('debug-hud');
  if (hud) hud.textContent = `${e.name}: ${e.message}`;
  console.error(e);
});