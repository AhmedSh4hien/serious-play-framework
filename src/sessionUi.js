import { LEVELS } from "./levelsConfig.js";

export function createSessionUi() {
  const overlay = document.createElement("div");
  overlay.id = "sessionOverlay";
  document.body.appendChild(overlay);
  return overlay;
}

export function renderOverlay(overlay, state, actions) {
  const s = state.session;
  overlay.className = `phase-${s.phase}`;

  const goalText = (s.goal.targets || [])
    .map((t) => `${t.targetCount} ${t.molecule}`)
    .join(", ");

  if (s.phase === "intro") {
    overlay.innerHTML = `
      <div class="panel">
      <h2>${s.title}</h2>
        <p>${s.prompt}</p>
        <p><strong>Goal:</strong> Create ${goalText}.</p>
        <button id="startSessionBtn" type="button">Start</button>
      </div>
    `;
    overlay.querySelector("#startSessionBtn").onclick = actions.onStart;
    return;
  }

  if (s.phase === "simulation") {
    overlay.innerHTML = `
      <div class="panel panel--small">
        <h3>Goal</h3>
        <p>Create ${goalText}.</p>
        <div class="goal-progress">
  ${(s.goal.targets || [])
    .map(
      (t) => `
        <p>${t.molecule}: ${s.createdMoleculeCounts[t.molecule] || 0}/${
        t.targetCount
      }</p>
      `
    )
    .join("")}
    </div>
        <div class="sim-actions">
          <button id="restartSimBtn" type="button" title="Restart level">↻</button>
          <button id="finishSimBtn" type="button">Finish & Continue</button>
        </div>
      </div>
    `;
    overlay.querySelector("#finishSimBtn").onclick = actions.onFinishSimulation;
    overlay.querySelector("#restartSimBtn").onclick = actions.onRestart;
    return;
  }

  if (s.phase === "quiz") {
    const q = s.quiz.questions[s.quiz.currentIndex];
    overlay.innerHTML = `
      <div class="panel">
        <h2>Question ${s.quiz.currentIndex + 1}/${s.quiz.questions.length}</h2>
        <p>${q.text}</p>
        <div class="answers">
          ${q.options
            .map(
              (opt, i) => `
                <button class="answerBtn" type="button" data-index="${i}">${opt}</button>
              `
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

  if (s.phase === "feedback") {
    const hasNextLevel = s.currentLevelIndex < LEVELS.length - 1;
  
    overlay.innerHTML = `
      <div class="panel">
        <h2>Feedback</h2>
        <p>Quiz score: ${s.quiz.score}/${s.quiz.questions.length}</p>
        <p>Atoms spawned: ${s.stats.atomsSpawned}</p>
        <p>Valid bonds formed: ${s.stats.validBonds}</p>
        <div class="goal-progress">
          ${(s.goal.targets || [])
            .map(
              (t) => `
                <p>${t.molecule} formed: ${s.createdMoleculeCounts[t.molecule] || 0}/${t.targetCount}</p>
              `
            )
            .join("")}
        </div>
        <div class="feedback-actions">
          <button id="restartSessionBtn" type="button">Restart session</button>
          ${
            hasNextLevel
              ? `<button id="nextLevelBtn" type="button">Next level</button>`
              : ""
          }
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
  state.session.phase = "simulation";
  state.session.startedAtMs ??= performance.now();
  state.session.simStartedAtMs = performance.now();
  state.session.isTrackingProgress = true;
  telemetry.event("session_phase_changed", { phase: "simulation" });
}

export function goToQuiz(state, telemetry) {
  state.session.phase = "quiz";
  state.session.simEndedAtMs = performance.now();
  telemetry.event("session_phase_changed", { phase: "quiz" });
}

export function answerQuestion(state, telemetry, selectedIndex) {
  const quiz = state.session.quiz;
  const q = quiz.questions[quiz.currentIndex];
  const correct = selectedIndex === q.correctIndex;

  quiz.answers.push({
    questionId: q.id,
    selectedIndex,
    correct,
  });

  if (correct) quiz.score++;

  telemetry.event("quiz_answered", {
    questionId: q.id,
    selectedIndex,
    correct,
  });

  quiz.currentIndex++;

  if (quiz.currentIndex >= quiz.questions.length) {
    state.session.phase = "feedback";
    telemetry.event("session_phase_changed", { phase: "feedback" });
  }
}

export function resetSessionData(state) {
  const level = LEVELS[state.session.currentLevelIndex] ?? LEVELS[0];

  state.session.phase = "intro";
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

  state.session.createdMoleculeCounts = {
    H2: 0,
    Cl2: 0,
    HCl: 0,
    O2: 0,
    H2O: 0,
  };

  state.session.inventory = {
    H: 0,
    O: 0,
    Cl: 0,
    ...level.inventory,
  };

  state.session.allowedAtomTypes = [...level.allowedAtomTypes];
  state.session.selectedSpawnType = level.allowedAtomTypes[0];

  state.session.quiz.currentIndex = 0;
  state.session.quiz.answers = [];
  state.session.quiz.score = 0;
  state.session.quiz.questions = level.quizQuestions;

  state.session.stats.atomsSpawned = 0;
  state.session.stats.validBonds = 0;
  state.session.stats.invalidBondAttempts = 0;
  state.session.stats.targetMoleculesFormed = 0;
}

export function restartSession(state, telemetry) {
  resetSessionData(state);
  telemetry.event("session_restarted");
}

export function goToNextLevel(state, telemetry) {
  if (state.session.currentLevelIndex < LEVELS.length - 1) {
    state.session.currentLevelIndex++;
    resetSessionData(state);
    telemetry.event("level_advanced", {
      levelIndex: state.session.currentLevelIndex,
      levelId: LEVELS[state.session.currentLevelIndex].id,
    });
  }
}