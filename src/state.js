import { QUIZ_QUESTIONS } from "./quizConfig.js";
import { LEVELS } from "./levelsConfig.js";

const initialLevel = LEVELS[0];

export const state = {
  atoms: [],
  bonds: [],
  moleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },
  // createdMoleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },

  fps: 0,
  framesThisSecond: 0,
  lastFpsUpdate: performance.now(),
  lastTime: performance.now(),

  atomById: new Map(),
  nextAtomId: 0,

  input: {
    mouseX: 0,
    mouseY: 0,
    isPointerDown: false,
    isRightMouseDown: false,
  },

  session: {
    currentLevelIndex: 0,
    phase: "intro",
    topic: initialLevel.topic,
    title: initialLevel.title,
    prompt: initialLevel.prompt,
    goal: {
      ...initialLevel.goal,
      completed: false,
      completedAtMs: null,
    },
  
    inventory: {
      ...initialLevel.inventory,
    },
  
    allowedAtomTypes: [...initialLevel.allowedAtomTypes],
    selectedSpawnType: initialLevel.allowedAtomTypes[0],
  
    startedAtMs: null,
    simStartedAtMs: null,
    simEndedAtMs: null,
    isTrackingProgress: false,
    createdMoleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },

    quiz: {
      currentIndex: 0,
      answers: [],
      score: 0,
      questions: initialLevel.quizQuestions,
    },
  
    stats: {
      atomsSpawned: 0,
      validBonds: 0,
      invalidBondAttempts: 0,
      targetMoleculesFormed: 0,
    },
  },
};