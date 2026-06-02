import { createFrameworkState } from '../../framework/state.js';
import { LEVELS } from './levelsConfig.js';

const initialLevel = LEVELS[0];

export const state = {
  ...createFrameworkState(),

  bins: [],
  activeComponent: null,
  componentQueue: [],
  score: 0,
  sortedTotal: 0,
  correctDrops: {},
  _onUiChange: null,
};

const s = state.session;
s.topic = initialLevel.topic;
s.title = initialLevel.title;
s.prompt = initialLevel.prompt;
s.goal = { ...initialLevel.goal, completed: false, completedAtMs: null };
s.quiz.questions = initialLevel.quizQuestions;