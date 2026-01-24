export function draw(canvas, ctx, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bonds first
  ctx.lineWidth = 3;
  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;

    if (bond.molecule === "H2") ctx.strokeStyle = "#4f8fff";
    else if (bond.molecule === "Cl2") ctx.strokeStyle = "#33aa33";
    else if (bond.molecule === "HCl") ctx.strokeStyle = "#aa33aa";
    else if (bond.molecule === "O2") ctx.strokeStyle = "#ff8800";
    else if (bond.molecule === "OH") ctx.strokeStyle = "#00bbbb";
    else if (bond.molecule === "H2O") ctx.strokeStyle = "#0055ff";
    else ctx.strokeStyle = "#888888";

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Atoms
  for (const a of state.atoms) {
    // circle
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // label on top
    const label = a.typeId;
    if (label) {
      ctx.save();

      const fontPx = Math.max(10, Math.floor(a.radius * 1.1));
      ctx.font = `bold ${fontPx}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.strokeText(label, a.x, a.y);

      ctx.fillStyle = "#111";
      ctx.fillText(label, a.x, a.y);

      ctx.restore();
    }

    // OH ion badge (ONLY while it's in an OH bond)
    const isInOH = state.bonds.some(
      (b) => b.molecule === "OH" && (b.aId === a.id || b.bId === a.id)
    );

    if (isInOH && a.typeId === "O") {
      ctx.save();

      const r = Math.max(5, a.radius * 0.45);
      const bx = a.x + a.radius * 0.65;
      const by = a.y - a.radius * 0.65;

      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = "#cc0000";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `bold ${Math.max(10, r * 1.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText("−", bx, by + 0.5); // U+2212

      ctx.restore();
    }
  }

  // HUD background
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(6, 6, 220, 150);

  // HUD
  const fpsText = `FPS: ${state.fps}`;
  ctx.font = "14px monospace";

  let fill = "#0a7a0a";
  if (state.fps < 30) fill = "#cc0000";
  else if (state.fps < 50) fill = "#b58900";

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.strokeText(fpsText, 10, 20);

  ctx.fillStyle = fill;
  ctx.fillText(fpsText, 10, 20);

  ctx.lineWidth = 1;
  ctx.fillStyle = "#000000";
  ctx.fillText(`Atoms: ${state.atoms.length}`, 10, 40);
  ctx.fillText(`Current: ${state.currentAtomType}`, 10, 60);
  ctx.fillText(`H2: ${state.moleculeCounts.H2}`, 10, 80);
  ctx.fillText(`Cl2: ${state.moleculeCounts.Cl2}`, 10, 100);
  ctx.fillText(`HCl: ${state.moleculeCounts.HCl}`, 10, 120);
  ctx.fillText(`O2: ${state.moleculeCounts.O2}`, 10, 140);
  ctx.fillText(`H2O: ${state.moleculeCounts.H2O}`, 10, 160);
  ctx.fillText(`OH: ${state.moleculeCounts.H2O}`, 10, 180);
  ctx.fillText(`Controls: 1=H  2=O  3=Cl  (RMB&LMB=spawn)`, 100, 20);
}
