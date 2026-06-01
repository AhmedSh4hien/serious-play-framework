
import {
    createPhysics,
    resetPhysicsWorld,
    updatePhysical,
    handleResizePhysics,
    convertToPhysical,
    ensureBondConstraints,
    installCollisionBonding,
  } from "../games/chemistry/physics.js";
  import { validatePhysicsProvider } from "../framework/physicsSchema.js";
  
  export const matterProvider = validatePhysicsProvider({
    createPhysics,
    resetPhysicsWorld,
    updatePhysical,
    handleResizePhysics,
    convertToPhysical,
    ensureBondConstraints,
    installCollisionBonding,
  });