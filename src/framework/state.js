export function createFrameworkState() {
  return {
    fps: 0,
    framesThisSecond: 0,
    lastFpsUpdate: performance.now(),
    lastTime: performance.now(),

    input: {
      mouseX: 0,
      mouseY: 0,
      isPointerDown: false,
      isRightMouseDown: false,
    },

    session: {
      currentLevelIndex: 0,
      phase: "intro",
      topic: null,
      title: null,
      prompt: null,
      phaseStartedAtMs: null,

      goal: {
        targets: [],
        completed: false,
        completedAtMs: null,
      },

      startedAtMs: null,
      simStartedAtMs: null,
      simEndedAtMs: null,
      isTrackingProgress: false,

      createdItemCounts: {},

      quiz: {
        currentIndex: 0,
        answers: [],
        score: 0,
        questions: [],
      },

      stats: {},
    },
  };
}