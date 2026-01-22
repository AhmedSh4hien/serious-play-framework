// Central place for shared mutable state.
// (Keeping it simple now; later you can wrap this in classes.)

export const state = {
    atoms: [],
    bonds: [], // { aId, bId, molecule, constraint? }
    moleculeCounts: { H2: 0, Cl2: 0, HCl: 0 },
  
    currentAtomType: "H",
  
    fps: 0,
    framesThisSecond: 0,
    lastFpsUpdate: performance.now(),
    lastTime: performance.now(),
  
    input: {
      isRightMouseDown: false,
      mouseX: 0,
      mouseY: 0,
    },
  };
  