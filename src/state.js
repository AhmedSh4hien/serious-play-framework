import { QUIZ_QUESTIONS } from "./quizConfig.js";

export const state = {
  atoms: [],
  bonds: [],
  moleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },

  currentAtomType: "H",

  fps: 0,
  framesThisSecond: 0,
  lastFpsUpdate: performance.now(),
  lastTime: performance.now(),

  atomById: new Map(),
  nextAtomId: 0,

  input: {
    isRightMouseDown: false,
    mouseX: 0,
    mouseY: 0,
  },

  session: {
    phase: "intro", // intro | simulation | quiz | feedback
    topic: "valency",
    prompt:
      "In this session, learn how bonding capacity affects which molecules can form. Hydrogen forms 1 bond, oxygen 2, and chlorine 1 in this prototype.",
    goal: {
      type: "create_molecule",
      molecule: "H2O",
      targetCount: 2,
      completed: false,
      completedAtMs: null,
    },
    startedAtMs: null,
    simStartedAtMs: null,
    simEndedAtMs: null,

    quiz: {
      currentIndex: 0,
      answers: [],
      score: 0,
      questions: QUIZ_QUESTIONS,
    },

    stats: {
      atomsSpawned: 0,
      validBonds: 0,
      invalidBondAttempts: 0,
      targetMoleculesFormed: 0,
    },
  },
};
