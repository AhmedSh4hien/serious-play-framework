export function draw(canvas, ctx, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bonds first
  ctx.lineWidth = 3;
  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId); // NEW
    const b = state.atomById.get(bond.bId); // NEW
    if (!a || !b) continue;

    if (bond.molecule === "H2") ctx.strokeStyle = "#4f8fff";
    else if (bond.molecule === "Cl2") ctx.strokeStyle = "#33aa33";
    else if (bond.molecule === "HCl") ctx.strokeStyle = "#aa33aa";
    else if (bond.molecule === "O2") ctx.strokeStyle = "#ff8800";
    else ctx.strokeStyle = "#888888";

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
  }

  // HUD background (add before the HUD text)
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(6, 6, 220, 150);
  // HUD
  const fpsText = `FPS: ${state.fps}`;
  ctx.font = "14px monospace";

  // darker colors (your bright green was hard to read on white)
  let fill = "#0a7a0a";
  if (state.fps < 30) fill = "#cc0000";
  else if (state.fps < 50) fill = "#b58900";

  // outline
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,1)"; // light outline on colored text
  ctx.strokeText(fpsText, 10, 20);

  ctx.fillStyle = fill;
  ctx.fillText(fpsText, 10, 20);

  // reset for rest of HUD
  ctx.lineWidth = 1;
  ctx.fillStyle = "#000000";
  ctx.fillText(`Atoms: ${state.atoms.length}`, 10, 40);
  ctx.fillText(`Current: ${state.currentAtomType}`, 10, 60);
  ctx.fillText(`H2: ${state.moleculeCounts.H2}`, 10, 80);
  ctx.fillText(`Cl2: ${state.moleculeCounts.Cl2}`, 10, 100);
  ctx.fillText(`HCl: ${state.moleculeCounts.HCl}`, 10, 120);
  ctx.fillText(`O2: ${state.moleculeCounts.O2}`, 10, 140);
}
