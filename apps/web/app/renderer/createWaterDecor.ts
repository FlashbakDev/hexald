import type { MeshStandardMaterial } from "three";

/** Eau touchant au moins une terre. */
export const WATER_COASTAL = { top: 0x4aa3d9, side: 0x1a6a96 };

/** Eau sans aucun voisin terrestre (visuel uniquement). */
export const WATER_DEEP = { top: 0x17608c, side: 0x0c3a5c };

/**
 * Teinte la tuile d’eau : côtière ou profonde.
 * Profonde = aucun voisin de côte (terre).
 */
export function paintWaterMaterials(
  materials: MeshStandardMaterial[],
  deep: boolean
) {
  const palette = deep ? WATER_DEEP : WATER_COASTAL;
  materials[0].color.setHex(palette.side);
  materials[1].color.setHex(palette.top);
  materials[2].color.copy(materials[0].color);

  materials[1].roughness = deep ? 0.2 : 0.28;
  materials[1].metalness = deep ? 0.42 : 0.35;
  materials[0].roughness = deep ? 0.35 : 0.42;
  materials[0].metalness = deep ? 0.2 : 0.15;
  materials[1].needsUpdate = true;
  materials[0].needsUpdate = true;
}
