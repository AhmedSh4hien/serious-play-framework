import { createFrameworkState } from "../../framework/state.js";

export const state = {
  ...createFrameworkState(),

  // chemistry-specific runtime data -- initialised here so the game loop
  // never sees undefined, even before the first resetWorldFromState() runs
  atoms: [],
  bonds: [],
  atomById: new Map(),
  nextAtomId: 0,
  moleculeCounts: { H2: 0, Cl2: 0, HCl: 0, O2: 0, H2O: 0 },
};