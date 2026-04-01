export function installInput(canvas, state, actions) {
  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    state.input.mouseX = x;
    state.input.mouseY = y;

    if (e.button === 0) {
      state.input.isPointerDown = true;
      actions.onPrimaryDown?.(x, y);
    }

    if (e.button === 2) {
      state.input.isRightMouseDown = true;
      actions.onSecondaryDown?.(x, y);
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
    const rect = canvas.getBoundingClientRect();
    state.input.mouseX = e.clientX - rect.left;
    state.input.mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener("mouseleave", () => {
    state.input.isPointerDown = false;
    state.input.isRightMouseDown = false;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}