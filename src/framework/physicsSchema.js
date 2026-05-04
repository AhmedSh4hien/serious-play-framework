/**
 * @typedef {Object} PhysicsProvider
 * @property {Function} createPhysics
 * @property {Function} resetPhysicsWorld
 * @property {Function} updatePhysical
 * @property {Function} handleResizePhysics
 * @property {Function} convertToPhysical
 * @property {Function} ensureBondConstraints
 * @property {Function} installCollisionBonding
 */

export function validatePhysicsProvider(provider) {
    const required = [
      "createPhysics",
      "resetPhysicsWorld",
      "updatePhysical",
      "handleResizePhysics",
      "convertToPhysical",
      "ensureBondConstraints",
      "installCollisionBonding",
    ];
    for (const key of required) {
      if (typeof provider[key] !== "function")
        throw new Error(`Physics provider missing required method: "${key}"`);
    }
    return provider;
  }