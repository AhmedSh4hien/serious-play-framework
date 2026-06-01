export function draw(canvas, ctx, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bonds first
  ctx.lineWidth = 3;
  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;

    ctx.strokeStyle = bond.color ?? "#888888";

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Atoms
  for (const a of state.atoms) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (a.typeId) {
      ctx.save();
      const fontPx = Math.max(10, Math.floor(a.radius * 1.1));
      ctx.font = `bold ${fontPx}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.strokeText(a.typeId, a.x, a.y);
      ctx.fillStyle = "#111";
      ctx.fillText(a.typeId, a.x, a.y);
      ctx.restore();
    }

    if (a.showOHBadge) {
      ctx.save();
      const r = Math.max(5, a.radius * 0.45);
      const bx = a.x + a.radius * 0.65;
      const by = a.y - a.radius * 0.65;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = "#cc0000";
      ctx.fill();
      ctx.strokeStyle = "#00bbbb";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `bold ${Math.max(10, r * 1.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("−", bx, by + 0.5);
      ctx.restore();
    }
  }
}