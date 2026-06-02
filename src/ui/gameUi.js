export function createGameUi(container = document.body) {
  const el = document.createElement("div");
  el.id = "gameUi";
  if (!container) {
    console.warn("[gameUi] container not found, appending to body");
    document.body.appendChild(el);
  } else {
    container.appendChild(el);
  }
  return el;
}

export function renderGameUi(gameUi, state, renderGameSpecific) {
  if (!gameUi) return;
  const show = state.session.phase === "simulation";
  gameUi.style.visibility = show ? "visible" : "hidden";
  gameUi.style.pointerEvents = show ? "auto" : "none";
  if (!show) return;
  renderGameSpecific?.(gameUi);
}