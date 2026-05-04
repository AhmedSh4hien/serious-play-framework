import { createFrameworkState } from "../../framework/state.js";
import { LEVELS } from "./levelsConfig.js";

const initialLevel = LEVELS[0];

export const state = {
  ...createFrameworkState(),

  // chemistry-specific runtime data
  atoms: [],
  bonds: [],
  atomById: new Map(),
  nextAtomId: 0,
  moleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },
};

// hydrate session from initial level
const s = state.session;
s.topic = initialLevel.topic;
s.title = initialLevel.title;
s.prompt = initialLevel.prompt;
s.goal = { ...initialLevel.goal, completed: false, completedAtMs: null };
s.inventory = { ...initialLevel.inventory };
s.allowedAtomTypes = [...initialLevel.allowedAtomTypes];
s.selectedSpawnType = initialLevel.allowedAtomTypes[0];
s.createdMoleculeCounts = { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 };
s.quiz.questions = initialLevel.quizQuestions;