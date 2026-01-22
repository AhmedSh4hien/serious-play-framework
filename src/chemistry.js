import { ATOM_TYPES } from "./atomsConfig.js";

export function canBond(a, b) {
  const defA = ATOM_TYPES[a.typeId];
  const defB = ATOM_TYPES[b.typeId];

  if (a.currentBonds >= defA.maxBonds) return false;
  if (b.currentBonds >= defB.maxBonds) return false;

  return true;
}

export function getPairMolecule(a, b) {
  const types = [a.typeId, b.typeId].sort().join("-");

  if (types === "H-H") return "H2";
  if (types === "Cl-Cl") return "Cl2";
  if (types === "Cl-H") return "HCl";
  if (types === "O-O") return "O2";

  return null;
}
