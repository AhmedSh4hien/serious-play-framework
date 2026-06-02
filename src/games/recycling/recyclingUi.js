export function renderRecyclingHud(el, state) {
    const score = state.score ?? 0;
    const total = state.sortedTotal ?? 0;
  
    el.innerHTML = `
      <div class="hud-panel">
        <span class="hud-score">Score: ${score} / ${total}</span>
      </div>
    `;
  }