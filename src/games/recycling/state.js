import { createFrameworkState } from '../../framework/state.js';
import { LEVELS } from './levelsConfig.js';

const initialLevel = LEVELS[0];

export const state = {
  ...createFrameworkState(),

  // recycling-specific runtime data
  components: [],      // active PixiJS draggable components on screen
  bins: [],            // drop target definitions with screen positions
  correctDrops: {},    // { binId: count } — tracks progress toward goal
};

// hydrate session from initial level
const s = state.session;
s.topic        = initialLevel.topic;
s.title        = initialLevel.title;
s.prompt       = initialLevel.prompt;
s.goal         = { ...initialLevel.goal, completed: false, completedAtMs: null };
s.quiz.questions = initialLevel.quizQuestions;