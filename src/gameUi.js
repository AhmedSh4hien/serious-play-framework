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

  const types = ["H", "O", "Cl"];

  gameUi.innerHTML = `
    <div class="game-toolbar">
      <div class="toolbar-group">
        ${types
          .map(
            (type) => `
          <button
            class="atom-btn ${
              s.selectedSpawnType === type ? "is-selected" : ""
            }"
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
        <div class="toolbar-goal">Goal: ${s.goal.targetCount} ${s.goal.molecule}</div>
        <div class="toolbar-progress">Current: ${
          state.moleculeCounts[s.goal.molecule] || 0
        }</div>
      </div>
    </div>
  `;

  gameUi.querySelectorAll(".atom-btn").forEach((btn) => {
    btn.onclick = () => actions.onSelectAtom(btn.dataset.type);
  });
}