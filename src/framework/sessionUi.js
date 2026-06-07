let _levels = [];
let _adapter = null;

function transitionPhase(state, telemetry, nextPhase) {
  const now = performance.now();
  const prevPhase = state.session.phase;
  const prevStartedAt = state.session.phaseStartedAtMs ?? now;

  telemetry.event("session_phase_changed", {
    fromPhase: prevPhase,
    toPhase: nextPhase,
    timeInPrevPhaseMs: Math.round(now - prevStartedAt),
    levelIndex: state.session.currentLevelIndex ?? 0,
  });

  state.session.phase = nextPhase;
  state.session.phaseStartedAtMs = now;
}

export function createSessionUi(
  container = document.body,
  sidebar = null,
  levels = [],
  adapter = null
) {
  _levels = levels;
  _adapter = adapter;

  const el = document.createElement("div");
  el.id = "sessionOverlay";
  container.appendChild(el);
  return { overlay: el, sidebar };
}

export function renderOverlay(overlay, sidebar, state, actions) {
  const s = state.session;
  overlay.className = `phase-${s.phase}`;

  // ── intro ──────────────────────────────────────────────────────────
  if (s.phase === "intro") {
    const goalText = (s.goal.targets || [])
      .map((t) => `${t.targetCount} ${t.molecule ?? t.binId}`)
      .join(", ");

    overlay.innerHTML = `
      <div class="panel">
        <h2>${s.title}</h2>
        <p>${s.prompt}</p>
        <p><strong>Goal:</strong> ${goalText}</p>
        <button id="startSessionBtn" type="button">Start</button>
      </div>
    `;
    overlay.querySelector("#startSessionBtn").onclick = actions.onStart;
    return;
  }

  // ── simulation ─────────────────────────────────────────────────────
  if (s.phase === "simulation") {
    overlay.innerHTML = "";
    return;
  }

  if (sidebar) sidebar.innerHTML = "";

  // ── quiz ───────────────────────────────────────────────────────────
  if (s.phase === "quiz") {
    const q = s.quiz.questions[s.quiz.currentIndex];
    overlay.innerHTML = `
      <div class="panel">
        <h2>Question ${s.quiz.currentIndex + 1}/${s.quiz.questions.length}</h2>
        <p>${q.text}</p>
        <div class="answers">
          ${q.options
            .map(
              (opt, i) =>
                `<button class="answerBtn" type="button" data-index="${i}">${opt}</button>`
            )
            .join("")}
        </div>
      </div>
    `;
    overlay.querySelectorAll(".answerBtn").forEach((btn) => {
      btn.onclick = () => actions.onAnswer(Number(btn.dataset.index));
    });
    return;
  }

  // ── feedback ───────────────────────────────────────────────────────
  if (s.phase === "feedback") {
    const hasNextLevel = s.currentLevelIndex < _levels.length - 1;
    const level = _levels[s.currentLevelIndex];
    const gameStats = _adapter?.renderFeedbackStats?.(state) ?? "";

    overlay.innerHTML = `
      <div class="panel">
        <h2>Feedback</h2>
        <p>Quiz score: ${s.quiz.score}/${s.quiz.questions.length}</p>
        ${gameStats}
        ${level?.funFact ? `
          <div class="fun-fact">
            <strong>Did you know?</strong>
            <p>${level.funFact}</p>
          </div>
        ` : ""}
        <div class="feedback-actions">
          <button id="restartSessionBtn" type="button">Restart session</button>
          ${hasNextLevel
            ? `<button id="nextLevelBtn" type="button">Next level</button>`
            : ""}
        </div>
      </div>
    `;
    overlay.querySelector("#restartSessionBtn").onclick = actions.onRestart;
    if (hasNextLevel) {
      overlay.querySelector("#nextLevelBtn").onclick = actions.onNextLevel;
    }
  }
}

export function startSimulation(state, telemetry) {
  state.session.startedAtMs ??= performance.now();
  state.session.simStartedAtMs = performance.now();
  state.session.isTrackingProgress = true;
  transitionPhase(state, telemetry, "simulation");
}

export function goToQuiz(state, telemetry) {
  state.session.simEndedAtMs = performance.now();
  transitionPhase(state, telemetry, "quiz");
}

export function answerQuestion(state, telemetry, selectedIndex) {
  const quiz = state.session.quiz;
  const q = quiz.questions[quiz.currentIndex];
  const correct = selectedIndex === q.correctIndex;

  quiz.answers.push({ questionId: q.id, selectedIndex, correct });
  if (correct) quiz.score++;

  telemetry.event("quiz_answered", {
    questionId: q.id,
    questionText: q.text,
    selectedIndex,
    correct,
    correctIndex: q.correctIndex,
    levelIndex: state.session.currentLevelIndex ?? 0,
  });

  quiz.currentIndex++;
  if (quiz.currentIndex >= quiz.questions.length) {
    transitionPhase(state, telemetry, "feedback");
  }
}

export function resetSessionData(state) {
  const level = _levels[state.session.currentLevelIndex] ?? _levels[0];

  state.session.phase = "intro";
  state.session.phaseStartedAtMs = performance.now();
  state.session.topic = level.topic;
  state.session.title = level.title;
  state.session.prompt = level.prompt;

  state.session.goal = {
    ...level.goal,
    targets: (level.goal.targets || []).map((t) => ({ ...t })),
    completed: false,
    completedAtMs: null,
  };

  state.session.startedAtMs = null;
  state.session.simStartedAtMs = null;
  state.session.simEndedAtMs = null;
  state.session.isTrackingProgress = false;

  // reset to empty -- adapter fills its own keys in resetGame()
  state.session.createdItemCounts = {};
  state.session.stats = {};

  state.session.quiz.currentIndex = 0;
  state.session.quiz.answers = [];
  state.session.quiz.score = 0;
  state.session.quiz.questions = level.quizQuestions;


}

export function restartSession(state, telemetry) {
  telemetry.event("session_restarted", {
    fromPhase: state.session.phase,
    levelIndex: state.session.currentLevelIndex ?? 0,
    timeInPhaseMs: Math.round(
      performance.now() - (state.session.phaseStartedAtMs ?? performance.now())
    ),
  });
  resetSessionData(state);
}

export function goToNextLevel(state, telemetry) {
  if (state.session.currentLevelIndex < _levels.length - 1) {
    state.session.currentLevelIndex++;
    resetSessionData(state);
    telemetry.event("level_advanced", {
      levelIndex: state.session.currentLevelIndex,
      levelId: _levels[state.session.currentLevelIndex].id,
    });
  }
}