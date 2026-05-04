/**
 * @typedef {Object} Level
 * @property {string} id
 * @property {string} title
 * @property {string} prompt
 * @property {string} topic
 * @property {Object} goal
 * @property {Object} inventory
 * @property {string[]} allowedAtomTypes
 * @property {Object[]} startingAtoms
 * @property {Object[]} quizQuestions
 */

export function validateLevel(level) {
    const required = ["id", "title", "prompt", "goal", "quizQuestions"];
    for (const key of required) {
      if (!(key in level)) throw new Error(`Level missing required field: "${key}"`);
    }
    return level;
  }