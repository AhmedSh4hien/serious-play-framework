import { Application, Graphics, Text, TextStyle } from "pixi.js";
import {
  BOND_COLORS,
  DEFAULT_BOND_COLOR,
} from "../games/chemistry/atomsConfig.js";

function toHex(str) { return parseInt(str.replace("#", ""), 16); }

let app = null;
let bondLayer = null;
let atomLayer = null;

export async function initPixi(canvas) {
  app = new Application();
  await app.init({
    canvas,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    resizeTo: canvas,
  });

  // Scale stage DOWN to CSS pixels so coordinates match pointer events
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  app.stage.scale.set(1 / dpr);

  bondLayer = new Graphics();
  atomLayer = new Graphics();
  app.stage.addChild(bondLayer);
  app.stage.addChild(atomLayer);
}

export function draw(canvas, _ctx, state) {
  if (!app || !bondLayer || !atomLayer) return;

  bondLayer.clear();
  atomLayer.clear();

  // Bonds
  for (const bond of state.bonds) {
    const a = state.atomById.get(bond.aId);
    const b = state.atomById.get(bond.bId);
    if (!a || !b) continue;

    const color = toHex(BOND_COLORS[bond.molecule] ?? DEFAULT_BOND_COLOR);
    bondLayer.moveTo(a.x, a.y);
    bondLayer.lineTo(b.x, b.y);
    bondLayer.stroke({ width: 3, color });
  }

  // Atoms
  for (const a of state.atoms) {
    // Circle fill
    atomLayer
      .circle(a.x, a.y, a.radius)
      .fill({ color: a.color })
      .stroke({ width: 1, color: 0x000000 });

    // OH badge
    const isInOH = state.bonds.some(
      (b) => b.molecule === "OH" && (b.aId === a.id || b.bId === a.id)
    );
    if (isInOH && a.typeId === "O") {
      const r = Math.max(5, a.radius * 0.45);
      const bx = a.x + a.radius * 0.65;
      const by = a.y - a.radius * 0.65;
      atomLayer
        .circle(bx, by, r)
        .fill({ color: 0xcc0000 })
        .stroke({ width: 1, color: 0x00000080 });
    }
  }

  // Text labels (separate pass — Graphics can't do text)
  // Clear old labels
  app.stage.children
    .filter((c) => c._isAtomLabel)
    .forEach((c) => app.stage.removeChild(c));

  for (const a of state.atoms) {
    const fontPx = Math.max(10, Math.floor(a.radius * 1.1));

    const label = new Text({
      text: a.typeId,
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: fontPx,
        fontWeight: "bold",
        fill: "#111111",
        stroke: { color: "#ffffff", width: 3 },
      }),
    });
    label.anchor.set(0.5);
    label.position.set(a.x, a.y);
    label._isAtomLabel = true;
    app.stage.addChild(label);

    // OH minus badge label
    const isInOH = state.bonds.some(
      (b) => b.molecule === "OH" && (b.aId === a.id || b.bId === a.id)
    );
    if (isInOH && a.typeId === "O") {
      const r = Math.max(5, a.radius * 0.45);
      const bx = a.x + a.radius * 0.65;
      const by = a.y - a.radius * 0.65;

      const badge = new Text({
        text: "−",
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: Math.max(10, r * 1.6),
          fontWeight: "bold",
          fill: "#ffffff",
        }),
      });
      badge.anchor.set(0.5);
      badge.position.set(bx, by + 0.5);
      badge._isAtomLabel = true;
      app.stage.addChild(badge);
    }
  }
}