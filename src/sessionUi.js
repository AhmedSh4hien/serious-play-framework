export function createSessionUi() {
  const overlay = document.createElement("div");
  overlay.id = "sessionOverlay";
  document.body.appendChild(overlay);
  return overlay;
}

export function renderOverlay(overlay, state, actions) {
  const s = state.session;
  overlay.className = `phase-${s.phase}`;

  if (s.phase === "intro") {
    overlay.innerHTML = `
      <div class="panel">
        <h2>Intro</h2>
        <p>${s.prompt}</p>
        <p><strong>Goal:</strong> Create ${s.goal.targetCount} ${s.goal.molecule} molecules.</p>
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
        <p>Create ${s.goal.targetCount} ${s.goal.molecule} molecules.</p>
        <p>Current: ${state.moleculeCounts[s.goal.molecule] || 0}</p>
        <button id="finishSimBtn" type="button">Finish & Continue</button>
      </div>
    `;
    overlay.querySelector("#finishSimBtn").onclick = actions.onFinishSimulation;
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
    overlay.innerHTML = `
      <div class="panel">
        <h2>Feedback</h2>
        <p>Quiz score: ${s.quiz.score}/${s.quiz.questions.length}</p>
        <p>Atoms spawned: ${s.stats.atomsSpawned}</p>
        <p>Valid bonds formed: ${s.stats.validBonds}</p>
        <p>${s.goal.molecule} formed: ${state.moleculeCounts[s.goal.molecule] || 0}</p>
        <button id="restartSessionBtn" type="button">Restart session</button>
      </div>
    `;
    overlay.querySelector("#restartSessionBtn").onclick = actions.onRestart;
  }
}

export function startSimulation(state, telemetry) {
  state.session.phase = "simulation";
  state.session.startedAtMs ??= performance.now();
  state.session.simStartedAtMs = performance.now();
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
  state.session.phase = "intro";
  state.session.goal.completed = false;
  state.session.goal.completedAtMs = null;
  state.session.startedAtMs = null;
  state.session.simStartedAtMs = null;
  state.session.simEndedAtMs = null;

  state.session.inventory = {
    H: 6,
    O: 3,
    Cl: 2,
  };

  state.session.selectedSpawnType = "H";

  state.session.quiz.currentIndex = 0;
  state.session.quiz.answers = [];
  state.session.quiz.score = 0;

  state.session.stats.atomsSpawned = 0;
  state.session.stats.validBonds = 0;
  state.session.stats.invalidBondAttempts = 0;
  state.session.stats.targetMoleculesFormed = 0;
}

export function restartSession(state, telemetry) {
  resetSessionData(state);
  telemetry.event("session_restarted");
}