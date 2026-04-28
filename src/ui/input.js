export function installInput(canvas, state, actions) {
  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const worldWidth = canvas.clientWidth;
    const worldHeight = canvas.clientHeight;

    return {
      x: ((clientX - rect.left) / rect.width) * worldWidth,
      y: ((clientY - rect.top) / rect.height) * worldHeight,
    };
  }

  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = getCanvasPos(e.clientX, e.clientY);
    state.input.mouseX = x;
    state.input.mouseY = y;
  
    if (e.button !== 0) return;
  
    if (state.session.inputMode === "spawn") {
      actions.onSpawn?.(x, y);
      return;
    }
  
    if (state.session.inputMode === "drag") {
      state.input.isPointerDown = true;
      actions.onPrimaryDown?.(x, y);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      state.input.isPointerDown = false;
      actions.onPrimaryUp?.();
    }

    if (e.button === 2) {
      state.input.isRightMouseDown = false;
      actions.onSecondaryUp?.();
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = getCanvasPos(e.clientX, e.clientY);
    state.input.mouseX = x;
    state.input.mouseY = y;
  });

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const { x, y } = getCanvasPos(touch.clientX, touch.clientY);
    state.input.mouseX = x;
    state.input.mouseY = y;

    if (state.session.inputMode === "spawn") {
      actions.onSpawn?.(x, y);
      return;
    }

    if (state.session.inputMode === "drag") {
      state.input.isPointerDown = true;
      actions.onPrimaryDown?.(x, y);
    }
  },
  { passive: false }
);

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const { x, y } = getCanvasPos(touch.clientX, touch.clientY);
      state.input.mouseX = x;
      state.input.mouseY = y;
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", () => {
    state.input.isPointerDown = false;
    actions.onPrimaryUp?.();
  });

  canvas.addEventListener("mouseleave", () => {
    state.input.isPointerDown = false;
    state.input.isRightMouseDown = false;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}