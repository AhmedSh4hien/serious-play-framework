export function createGameUi() {
  const gameUi = document.createElement("div");
  gameUi.id = "gameUi";
  document.body.appendChild(gameUi);
  return gameUi;
}

export function renderGameUi(gameUi, state, actions) {
  const s = state.session;
  const show = s.phase === "simulation";

  gameUi.style.display = show ? "flex" : "none";
  if (!show) return;

  const types = s.allowedAtomTypes ?? ["H", "O", "Cl"];
  const targets = s.goal.targets || [];

  const goalText = targets
    .map((t) => `${t.targetCount} ${t.molecule}`)
    .join(", ");

  const progressText = targets
    .map(
      (t) =>
        `${t.molecule}: ${s.createdMoleculeCounts[t.molecule] || 0}/${t.targetCount}`
    )
    .join(" | ");

  gameUi.innerHTML = `
    <div class="game-toolbar">
      <div class="toolbar-group">
        ${types
          .map(
            (type) => `
          <button
            class="atom-btn ${s.selectedSpawnType === type ? "is-selected" : ""}"
            data-type="${type}"
            ${s.inventory[type] <= 0 ? "disabled" : ""}
          >
            <span class="atom-btn__label">${type}</span>
            <span class="atom-btn__count">${s.inventory[type]}</span>
          </button>
        `
          )
          .join("")}
      </div>

      <div class="toolbar-meta">
        <div class="toolbar-goal">Goal: ${goalText}</div>
        <div class="toolbar-progress">Current: ${progressText}</div>
      </div>
    </div>
  `;

  gameUi.querySelectorAll(".atom-btn").forEach((btn) => {
    btn.onclick = () => actions.onSelectAtom(btn.dataset.type);
  });
}