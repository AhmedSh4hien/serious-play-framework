export const LEVEL_TIME_LIMITS = {
    'recycling-1': 30,
    'recycling-2': 30,
    'recycling-3': 30,
  };
  
  export const DEFAULT_TIME_LIMIT = 30;
  
  export function getTimeLimit(levelId) {
    return LEVEL_TIME_LIMITS[levelId] ?? DEFAULT_TIME_LIMIT;
  }
  
  export function getRemainingSeconds(state) {
    if (!state.session.timerStartedAt) return getTimeLimit(state.session.levelId ?? '');
    const elapsed = (performance.now() - state.session.timerStartedAt) / 1000;
    return Math.max(0, state.session.timeLimit - elapsed);
  }
  
  export function isTimeUp(state) {
    return getRemainingSeconds(state) <= 0;
  }
  
  export function startTimer(state, levelId) {
    state.session.timeLimit = getTimeLimit(levelId);
    state.session.timerStartedAt = performance.now();
    state.session.timedOut = false;
  }
  
  export function checkTimedOut(state, telemetry, onTimeout) {
    if (state.session.timedOut) return;
    if (!isTimeUp(state)) return;
    state.session.timedOut = true;
    telemetry.event('level_timeout', {
      levelIndex: state.session.currentLevelIndex,
      score: state.score,
      total: state.sortedTotal,
    });
    onTimeout?.();
  }
  
  // Shuffle array (Fisher-Yates)
  export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }