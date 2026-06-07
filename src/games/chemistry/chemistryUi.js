export function renderChemistryHud(el, state, actions) {
  const s = state.session;
  const types = s.allowedAtomTypes ?? ["H", "O", "Cl"];
  const targets = s.goal.targets || [];
  const isMulti = targets.length > 1;

  const progressRows = targets.map((t) => {
    const done = s.createdItemCounts[t.molecule] || 0;
    const total = t.targetCount;
    const pct = Math.min(100, Math.round((done / total) * 100));
    const complete = done >= total;
    return `
      <div class="progress-row ${complete ? "is-complete" : ""}">
        <span class="progress-molecule">${t.molecule}</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="progress-count">${done}/${total}</span>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="hud-panel hud-controls">
      <button class="mode-toggle" type="button" id="modeToggleBtn">
        ${s.inputMode === "drag" ? "⟳ Drag" : "✦ Spawn"}
      </button>
      <div class="toolbar-group">
        ${types.map((type) => `
          <button
            class="atom-btn ${s.selectedSpawnType === type ? "is-selected" : ""}"
            data-type="${type}"
            type="button"
            ${s.inventory[type] <= 0 ? "disabled" : ""}
          >
            <span class="atom-btn__label">${type}</span>
            <span class="atom-btn__count">${s.inventory[type]}</span>
          </button>
        `).join("")}
      </div>
    </div>
    <div class="hud-panel hud-progress ${isMulti ? "is-multi" : "is-single"}">
      <div class="hud-progress__title">Progress</div>
      ${progressRows}
    </div>
  `;

  el.querySelector("#modeToggleBtn").onclick = () => actions.onToggleMode();
  el.querySelectorAll(".atom-btn").forEach((btn) => {
    btn.onclick = () => actions.onSelectAtom(btn.dataset.type);
  });
}