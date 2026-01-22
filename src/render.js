export function draw(canvas, ctx, state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // Bonds first
    ctx.lineWidth = 3;
    for (const bond of state.bonds) {
      const a = state.atoms[bond.aId];
      const b = state.atoms[bond.bId];
      if (!a || !b) continue;
  
      if (bond.molecule === "H2") ctx.strokeStyle = "#4f8fff";
      else if (bond.molecule === "Cl2") ctx.strokeStyle = "#33aa33";
      else if (bond.molecule === "HCl") ctx.strokeStyle = "#aa33aa";
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
  
    // HUD
    if (state.fps >= 50) ctx.fillStyle = "#00ff00";
    else if (state.fps >= 30) ctx.fillStyle = "#ffff00";
    else ctx.fillStyle = "#ff0000";
  
    ctx.font = "14px monospace";
    ctx.fillText(`FPS: ${state.fps}`, 10, 20);
  
    ctx.fillStyle = "#000000";
    ctx.fillText(`Atoms: ${state.atoms.length}`, 10, 40);
    ctx.fillText(`Current: ${state.currentAtomType}`, 10, 60);
    ctx.fillText(`H2: ${state.moleculeCounts.H2}`, 10, 80);
    ctx.fillText(`Cl2: ${state.moleculeCounts.Cl2}`, 10, 100);
    ctx.fillText(`HCl: ${state.moleculeCounts.HCl}`, 10, 120);
  }
  