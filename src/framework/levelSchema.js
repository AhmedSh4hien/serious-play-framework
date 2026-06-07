/**
 * Framework-level level schema.
 * Game-specific fields (e.g. inventory, allowedAtomTypes) are defined
 * in the game's own levelsConfig.js and are not validated here.
 *
 * @typedef {Object} Level
 * @property {string} id
 * @property {string} title
 * @property {string} prompt
 * @property {string} topic
 * @property {Object} goal
 * @property {Object[]} goal.targets
 * @property {Object[]} quizQuestions
 * @property {string} [funFact]
 */

export function validateLevel(level) {
  const required = ["id", "title", "prompt", "goal", "quizQuestions"];
  for (const key of required) {
    if (!(key in level)) throw new Error(`Level missing required field: "${key}"`);
  }
  if (!Array.isArray(level.goal?.targets)) throw new Error(`Level "${level.id}" goal.targets must be an array`);
  if (!Array.isArray(level.quizQuestions)) throw new Error(`Level "${level.id}" quizQuestions must be an array`);
  return level;
}