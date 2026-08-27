import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  RepeatWrapping,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D
} from "three";
import type {
  BiomeId,
  BuildingId,
  FusionBiomeId,
  HexCoord,
  PrimaryBiomeId,
  WorldRegionSnapshot,
  WorldTileSnapshot
} from "@hexald/shared";
import { HEX_DIRECTIONS, hexKey, hexNeighbors, regionCells } from "@hexald/shared";
import {
  adjacentRegionCenters,
  canPlaceRegion,
  createStartingWorld,
  generateRegionTiles,
  regionLatticeNeighbors,
  startingTileBuildingId
} from "@hexald/game-core";
import { createForestDecorKit } from "./createForestDecor";
import { createFusionDecorKit } from "./createFusionDecor";
import { createFogCloudKit, FOG_CLOUD_LIFT } from "./createFogCloudKit";
import { createFarmMesh } from "./createFarmMesh";
import { createFishingHutMesh } from "./createFishingHutMesh";
import { createHouseMesh } from "./createHouseMesh";
import { createLibraryMesh } from "./createLibraryMesh";
import { createBarracksMesh } from "./createBarracksMesh";
import { createMarketMesh } from "./createMarketMesh";
import { createLumberCampMesh } from "./createLumberCampMesh";
import { createSawmillMesh } from "./createSawmillMesh";
import { createMillMesh } from "./createMillMesh";
import { createSmelterMesh } from "./createSmelterMesh";
import { createBrickworksMesh } from "./createBrickworksMesh";
import { createQuarryMesh } from "./createQuarryMesh";
import {
  createMountainDecorKit,
  mountainChainDirs
} from "./createMountainDecor";
import { createMountainCloudDecorKit } from "./createMountainCloudDecor";
import { createPlainsDecorKit } from "./createPlainsDecor";
import {
  createShoreEdgeDecorKit,
  shoreKindForBiome
} from "./createShoreEdgeDecor";
import { createWaterDecorKit, createDeepWaterSurfaceTexture, createWaterHexGeometry, isLandBiome, paintWaterMaterials } from "./createWaterDecor";
import { createFishBankDecorKit } from "./createFishBankDecor";
import { createCowHerdDecorKit } from "./createCowHerdDecor";
import { createIronDepositDecorKit } from "./createIronDepositDecor";
import { createClayDepositDecorKit } from "./createClayDepositDecor";
import { createLakeDecorKit } from "./createLakeDecor";
import { createVillageMesh } from "./createVillageMesh";
import { createClayMineMesh } from "./createClayMineMesh";
import { createMineMesh } from "./createMineMesh";
import { createInfluenceBorderKit } from "./createInfluenceBorderKit";
import type { PoiId } from "@hexald/shared";
import { poiAllowedOnBiome } from "@hexald/content";

const HEX_SIZE = 1;
const HEX_HEIGHT = 0.28;
/** Mer pure : plus basse que la terre / les côtes (lisibilité). */
const WATER_HEIGHT = 0.12;
/** Lac intérieur : légère dépression sous le plateau terrestre. */
const LAKE_HEIGHT = HEX_HEIGHT * 0.78;
const EMPTY_HEIGHT = 0.2;
const HOVER_LIFT = 0.22;
const SELECT_LIFT = 0.14;
const REVEAL_FOOTPRINT_LIFT = 0.02;
/** Profondeur sous le sol au début de l’apparition d’une région. */
const SPAWN_DEPTH = 1.15;
/** Durée de montée + bump d’un hex (ms) — assez longue pour chevaucher la vague. */
const SPAWN_DURATION_MS = 640;
/** Délai entre le centre et la 1ʳᵉ tuile de couronne (ms). */
const SPAWN_RING_START_MS = 70;
/** Écart entre deux tuiles de couronne (ms), ordre tiré au hasard. */
const SPAWN_RING_STEP_MS = 55;
/** Hauteur du bump au passage de la vague. */
const SPAWN_BUMP = 0.48;
const VIEW_MIN = 3.2;
const VIEW_MAX = 11.5;
const VIEW_DEFAULT = 6.8;
const HOVER_CURSOR = "url('/cursors/tile.svg') 16 16, pointer";
const CAMERA_OFFSET = new Vector3(7.5, 10, 8.5);

/** Surface hex : face claire, ombre de surface, flanc (3 nuances). */
type BiomeSurface = { top: number; topShade: number; side: number };

const biomePalette: Record<BiomeId, BiomeSurface> = {
  // Forêt = sauge sombre (canopy)
  forest: { top: 0x4f7d62, topShade: 0x3a614c, side: 0x2a4538 },
  // Plaine = olive clair / herbe ouverte
  plains: { top: 0xa3b87a, topShade: 0x869a62, side: 0xa09060 },
  mountain: { top: 0xe6eaf0, topShade: 0xb0bac8, side: 0x556070 },
  water: { top: 0x6ab0c8, topShade: 0x3f88a0, side: 0x2d6a80 },
  // Lisière = vert moyen clair (entre forêt et plaine)
  forest_plains: { top: 0x7a9a6e, topShade: 0x5e8260, side: 0x526848 },
  plains_mountain: { top: 0xb8c88a, topShade: 0x9aaa70, side: 0x7a8a60 },
  // Haute forêt = gris-mousse (roche + mousse)
  forest_mountain: { top: 0x6e8480, topShade: 0x5a6e72, side: 0x455058 }
};

const emptyPalette: BiomeSurface = {
  top: 0xeef6f0,
  topShade: 0xdce8e0,
  side: 0x9ab0a4
};
const revealFootprintPalette = { top: 0xdcecd4, side: 0x7a9a68 };

type HexSpawnAnim = {
  /** `performance.now()` au début de la génération de région. */
  t0: number;
  /** Délai avant montée (vague depuis le centre). */
  delayMs: number;
};

type HexTile = {
  mesh: Mesh;
  restY: number;
  materials: MeshStandardMaterial[];
  q: number;
  r: number;
  biome: BiomeId;
  /** Quartier / village posé : le décor de biome d’origine est retiré. */
  hasVillage: boolean;
  buildingId: BuildingId | null;
  poiId: PoiId | null;
  isRegionCenter: boolean;
  decor: Group | null;
  buildingMesh: Group | null;
  spawn: HexSpawnAnim | null;
  /** Tuile vierge conservée sous l’anim jusqu’à la fin du spawn. */
  pendingEmpty: Mesh | null;
};

/** État logique permanent — le mesh GPU peut être streamé (chargé / déchargé). */
type TileState = {
  q: number;
  r: number;
  biome: BiomeId;
  buildingId: BuildingId | null;
  poiId: PoiId | null;
  isRegionCenter: boolean;
  hasVillage: boolean;
};

/** Marge de chargement biome (monde) autour du viewport. */
const BIOME_LOAD_PAD = HEX_SIZE * 3.5;
/** Marge de déchargement plus large (hystérésis anti-flicker au pan). */
const BIOME_UNLOAD_PAD = HEX_SIZE * 8;

function easeOutQuint(t: number) {
  return 1 - (1 - t) ** 5;
}

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Montée depuis le sous-sol + bump arrondi ; `t` dans [0, 1]. */
function spawnLift(t: number, restY: number) {
  const rise = easeOutQuint(smoothstep(t));
  // Bump doux qui culmine vers le milieu puis se pose sans secousse.
  const bump = Math.sin(Math.PI * rise) * SPAWN_BUMP * (1 - rise * 0.35);
  return restY - SPAWN_DEPTH * (1 - rise) + bump;
}

/**
 * Centre d’abord, puis couronne dans un ordre aléatoire à pas constant.
 */
function spawnDelaysForRegion(
  cells: readonly { q: number; r: number }[],
  center: HexCoord
): Map<string, number> {
  const delays = new Map<string, number>();
  const ring: { q: number; r: number }[] = [];

  for (const cell of cells) {
    if (cell.q === center.q && cell.r === center.r) {
      delays.set(hexKey(cell.q, cell.r), 0);
    } else {
      ring.push(cell);
    }
  }

  for (let i = ring.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = ring[i]!;
    ring[i] = ring[j]!;
    ring[j] = tmp;
  }

  ring.forEach((cell, index) => {
    delays.set(hexKey(cell.q, cell.r), SPAWN_RING_START_MS + index * SPAWN_RING_STEP_MS);
  });

  return delays;
}

function isForestDecorBiome(biome: BiomeId) {
  return biome === "forest";
}

function isPlainsDecorBiome(biome: BiomeId) {
  return biome === "plains";
}

function isMountainDecorBiome(biome: BiomeId) {
  return biome === "mountain";
}

function isFusionDecorBiome(biome: BiomeId): biome is FusionBiomeId {
  return (
    biome === "forest_plains" ||
    biome === "plains_mountain" ||
    biome === "forest_mountain"
  );
}

function tileMeshHeight(biome: BiomeId, poiId: PoiId | null = null) {
  if (biome === "water") return WATER_HEIGHT;
  // Gisement = sol plat + tas de cailloux (pas le relief montagne).
  if (biome === "mountain" && poiId === "iron_deposit") return HEX_HEIGHT;
  // Lac = cuvette légèrement plus basse que les tuiles voisines.
  if (poiId === "lake" && biome !== "water") return LAKE_HEIGHT;
  if (biome === "mountain") return HEX_HEIGHT * 1.38;
  if (biome === "forest_mountain") return HEX_HEIGHT * 1.18;
  if (biome === "plains" || biome === "forest_plains") return HEX_HEIGHT * 0.94;
  return HEX_HEIGHT;
}

type Aabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type SelectedTile = {
  q: number;
  r: number;
  biome: BiomeId | null;
  hasVillage: boolean;
  buildingId: BuildingId | null;
  canGenerate: boolean;
  isRegionCenter: boolean;
  /** Position du clic (viewport), pour ancrer la roue de biomes / build. */
  clientX?: number;
  clientY?: number;
};

export type HexScreenPoint = {
  /** Position CSS relative au canvas (px). */
  x: number;
  y: number;
  /** Dans le frustum ortho approximatif. */
  visible: boolean;
};

export type HexSceneApi = {
  dispose: () => void;
  recenter: () => void;
  clearSelection: () => void;
  setFraming: (framing: HexSceneFraming) => void;
  generateRegion: (q: number, r: number, biome: PrimaryBiomeId) => boolean;
  /** Applique des tuiles déjà générées (ex. réponse API). */
  applyRegion: (
    center: HexCoord,
    biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => boolean;
  applyBuilding: (q: number, r: number, buildingId: BuildingId) => boolean;
  /** Retire le bâtiment et restaure le décor de biome. */
  removeBuilding: (q: number, r: number) => boolean;
  /** Dev — change le biome et retire le bâtiment affiché. */
  applyTileBiome: (q: number, r: number, biome: BiomeId) => boolean;
  /** Projette le centre d’une tuile (au-dessus du bâtiment) en coords canvas. */
  projectTile: (q: number, r: number) => HexScreenPoint | null;
  /** Surbrillance tutoriel (tuiles cliquables) — emissive pulsante. */
  setTutorialHighlights: (coords: readonly HexCoord[]) => void;
  /** Mode construction — halo vert (valides) / rouge (invalides). */
  setBuildHighlights: (
    valid: readonly HexCoord[],
    invalid?: readonly HexCoord[]
  ) => void;
  /** Emprise de civilisation (DEC-026) — teinte discrète. */
  setInfluenceHighlights: (coords: readonly HexCoord[]) => void;
};

export type HexSceneFraming = {
  /** Orthographic half-extent; larger = more zoomed out. */
  viewSize?: number;
  /**
   * 0 = look target centered.
   * Positive shifts the look target toward the top of the screen (0–0.7).
   */
  frameBiasY?: number;
  /**
   * 0 = look target centered.
   * Positive shifts the look target toward the right of the screen (0–0.7),
   * so the map center sits on the right half (landing desktop).
   */
  frameBiasX?: number;
};

export type HexSceneOptions = {
  onSelect?: (tile: SelectedTile | null) => void;
  /** Monde persisté ; sinon région de départ locale. */
  initialWorld?: {
    tiles: readonly WorldTileSnapshot[];
    regions: readonly WorldRegionSnapshot[];
  };
  /**
   * Centre caméra initial (axial). Utile pour previews admin hors (0,0).
   * Défaut : origine.
   */
  initialLookAt?: { q: number; r: number };
  /**
   * Écarte le brouillard de guerre de N anneaux de régions autour des
   * régions déjà posées (0 = comportement jeu). Preview admin : 1.
   */
  fogClearRegionPadding?: number;
  /**
   * Parallax cosmétique (gyro / souris). x/y ∈ [-1, 1].
   * Appliqué uniquement au render — le picking garde la caméra logique.
   */
  getDeviceTilt?: () => { x: number; y: number };
} & HexSceneFraming;

/** Décalage monde max pour le parallax gyro (unités scène) — subtil. */
const TILT_POS_STRENGTH = 0.28;
const TILT_LOOK_STRENGTH = 0.14;
const TILT_SUN_STRENGTH = 0.45;

function tileVariation(q: number, r: number) {
  return (Math.abs(q * 3 + r * 7) % 5) / 5 - 0.4;
}

/** Deterministic 0..1 noise. Independent of neighbors — no stripes when panning. */
function hexNoise(q: number, r: number, seed: number) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801) ^ seed;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

function paintMaterials(
  materials: MeshStandardMaterial[],
  surface: BiomeSurface,
  variation: number
) {
  const t = Math.min(1, Math.max(0, 0.4 + variation * 0.55));
  // Flanc
  materials[0].color
    .setHex(surface.side)
    .offsetHSL(variation * 0.015, variation * 0.04, variation * 0.06);
  materials[0].roughness = 0.9;
  // Dessus : mélange top ↔ topShade (nuance claire/foncée selon la tuile)
  materials[1].color
    .setHex(surface.top)
    .lerp(new Color(surface.topShade), t);
  materials[1].color.offsetHSL(variation * 0.02, variation * 0.06, variation * 0.03);
  materials[1].roughness = 0.68;
  // Base : flanc assombri (3ᵉ nuance)
  materials[2].color
    .setHex(surface.side)
    .offsetHSL(0, -0.03, -0.14 + variation * 0.04);
  materials[2].roughness = 0.94;
}

function paintEmptyMaterials(
  materials: MeshStandardMaterial[],
  q: number,
  r: number,
  kind: "empty" | "reveal-center" | "reveal-footprint" = "empty"
) {
  const hue = hexNoise(q, r, 1013904223) * 2 - 1;
  const sat = hexNoise(q, r, 314159265) * 2 - 1;
  const light = hexNoise(q, r, 271828182) * 2 - 1;
  const palette = kind === "reveal-footprint" ? revealFootprintPalette : emptyPalette;
  materials[0].color.setHex(palette.side).offsetHSL(hue * 0.03, 0, light * 0.07);
  materials[1].color.setHex(palette.top).offsetHSL(hue * 0.035, sat * 0.07, light * 0.11);
  materials[2].color.copy(materials[0].color).offsetHSL(0, 0, -0.1);
}

function createMaterials(surface: BiomeSurface, variation: number) {
  const materials = [
    new MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
    new MeshStandardMaterial({ roughness: 0.68, metalness: 0.05 }),
    new MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 })
  ];
  paintMaterials(materials, surface, variation);
  return materials;
}

/** Texture d’herbe très légère (multiplie la couleur de plaine). */
function createPlainsGrassTexture() {
  const size = 96;
  const canvasEl = document.createElement("canvas");
  canvasEl.width = size;
  canvasEl.height = size;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#c8d4b4";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 110; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(70, 100, 55, ${0.06 + Math.random() * 0.08})`;
    ctx.lineWidth = 0.7 + Math.random() * 0.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 1.8, y - 1.5 - Math.random() * 3.5);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvasEl);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.15, 1.15);
  texture.needsUpdate = true;
  return texture;
}

function setEmissive(materials: MeshStandardMaterial[], r: number, g: number, b: number) {
  for (const material of materials) material.emissive.setRGB(r, g, b);
}

function meshMaterials(mesh: Mesh) {
  return mesh.material as MeshStandardMaterial[];
}

/** Pointy-top axial → XZ. Matches CylinderGeometry (vertex on +Z). */
function axialToWorld(q: number, r: number) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const z = HEX_SIZE * 1.5 * r;
  return { x, z };
}

function axialFromWorld(x: number, z: number) {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / HEX_SIZE;
  const r = ((2 / 3) * z) / HEX_SIZE;
  return { q, r };
}

function hexesCoveringAabb(bounds: Aabb): HexCoord[] {
  const pad = HEX_SIZE * 1.25;
  const minX = bounds.minX - pad;
  const maxX = bounds.maxX + pad;
  const minZ = bounds.minZ - pad;
  const maxZ = bounds.maxZ + pad;
  const corners = [
    axialFromWorld(minX, minZ),
    axialFromWorld(maxX, minZ),
    axialFromWorld(minX, maxZ),
    axialFromWorld(maxX, maxZ)
  ];
  const qMin = Math.floor(Math.min(...corners.map((cell) => cell.q))) - 2;
  const qMax = Math.ceil(Math.max(...corners.map((cell) => cell.q))) + 2;
  const rMin = Math.floor(Math.min(...corners.map((cell) => cell.r))) - 2;
  const rMax = Math.ceil(Math.max(...corners.map((cell) => cell.r))) + 2;
  const cells: HexCoord[] = [];

  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const { x, z } = axialToWorld(q, r);
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
        cells.push({ q, r });
      }
    }
  }

  return cells;
}

/** Horizon / fog distant — sauge (pas gris neutre). */
const SKY_FOG = 0xb5cfc2;
const SKY_ZENITH = "#eaf6f0";
const SKY_MID = "#d4e8de";
const SKY_HORIZON = "#b5cfc2";
const ORIGIN = new Vector3();

/** Fond dégradé ciel clair → horizon sauge (texture 1D pour scene.background). */
function createSkyGradientTexture() {
  const canvasEl = document.createElement("canvas");
  canvasEl.width = 2;
  canvasEl.height = 256;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, SKY_ZENITH);
  gradient.addColorStop(0.42, SKY_MID);
  gradient.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new CanvasTexture(canvasEl);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createHexScene(canvas: HTMLCanvasElement, options: HexSceneOptions = {}): HexSceneApi {
  const fogClearRegionPadding = Math.max(0, Math.floor(options.fogClearRegionPadding ?? 0));
  const scene = new Scene();
  const skyTexture = createSkyGradientTexture();
  scene.background = skyTexture;
  // Brume lointaine teintée sauge (ortho : distances caméra typiques ~12–40).
  scene.fog = new Fog(SKY_FOG, 16, 48);

  const lookTarget = new Vector3();
  if (options.initialLookAt) {
    const { x, z } = axialToWorld(options.initialLookAt.q, options.initialLookAt.r);
    lookTarget.set(x, 0, z);
  }
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const tiltLookScratch = new Vector3();
  const tiltPosScratch = new Vector3();
  const sunBase = new Vector3(5.5, 12, 3.5);

  const applyCamera = () => {
    camera.position.copy(lookTarget).add(CAMERA_OFFSET);
    camera.lookAt(lookTarget);
    // Requis pour unproject pendant le pan/pinch : sinon matrixWorld reste
    // stale entre deux frames et le grab-pan accélère (surtout Safari iOS).
    camera.updateMatrixWorld();
  };

  /** Caméra visuelle uniquement (gyro) — ne pas laisser après le render. */
  const applyCameraTilted = (tiltX: number, tiltY: number) => {
    const ox = tiltX * TILT_POS_STRENGTH;
    const oz = tiltY * TILT_POS_STRENGTH;
    tiltPosScratch.set(ox, Math.abs(tiltX) * 0.02 + Math.abs(tiltY) * 0.015, oz);
    camera.position.copy(lookTarget).add(CAMERA_OFFSET).add(tiltPosScratch);
    tiltLookScratch.set(
      lookTarget.x - tiltX * TILT_LOOK_STRENGTH,
      lookTarget.y,
      lookTarget.z - tiltY * TILT_LOOK_STRENGTH
    );
    camera.lookAt(tiltLookScratch);
    camera.updateMatrixWorld();
  };

  applyCamera();

  let viewSize = Math.min(
    VIEW_MAX,
    Math.max(VIEW_MIN, options.viewSize ?? VIEW_DEFAULT)
  );
  let frameBiasY = Math.min(0.7, Math.max(0, options.frameBiasY ?? 0));
  let frameBiasX = Math.min(0.7, Math.max(0, options.frameBiasX ?? 0));

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  // Un peu plus haut : les meshes flat (hex / low-poly) gagnent en présence.
  renderer.toneMappingExposure = 1.28;

  // Ciel clair + sol chaud ; soleil directionnel soft.
  scene.add(new HemisphereLight(0xfff8f0, 0xd2b48c, 0.95));
  scene.add(new AmbientLight(0xfff5eb, 0.22));
  const sun = new DirectionalLight(0xffefd0, 0.88);
  sun.position.copy(sunBase);
  sun.castShadow = false;
  scene.add(sun);

  const biomeGeometry = new CylinderGeometry(HEX_SIZE, HEX_SIZE, HEX_HEIGHT, 6);
  const waterGeometry = createWaterHexGeometry(HEX_SIZE, WATER_HEIGHT);
  const emptyGeometry = new CylinderGeometry(HEX_SIZE, HEX_SIZE, EMPTY_HEIGHT, 6);
  const biomeTiles: HexTile[] = [];
  const tilesByMesh = new Map<Mesh, HexTile>();
  const biomesByKey = new Map<string, BiomeId>();
  const regionCenters: HexCoord[] = [];
  const emptyByKey = new Map<string, Mesh>();
  const emptyPool: Mesh[] = [];
  const revealableCenters = new Set<string>();
  const revealableFootprint = new Set<string>();
  /** Positions monde des centres constructibles (frein de pan). */
  const revealableCenterWorld: { x: number; z: number }[] = [];
  const plusByKey = new Map<string, Mesh>();
  const plusPool: Mesh[] = [];
  const fogByKey = new Map<string, Group>();
  const fogPool: Group[] = [];
  const fogKit = createFogCloudKit();
  const plusTexture = (() => {
    const size = 128;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(72, 86, 78, 0.62)";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    const c = size / 2;
    const arm = 26;
    ctx.beginPath();
    ctx.moveTo(c - arm, c);
    ctx.lineTo(c + arm, c);
    ctx.moveTo(c, c - arm);
    ctx.lineTo(c, c + arm);
    ctx.stroke();
    const texture = new CanvasTexture(canvasEl);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  })();
  const plusMaterial = new MeshStandardMaterial({
    map: plusTexture,
    transparent: true,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const plusGeometry = new PlaneGeometry(0.72, 0.72);

  const createPlusInstance = () => {
    const mesh = new Mesh(plusGeometry, plusMaterial);
    mesh.rotation.x = -Math.PI / 2;
    // Aligner le + avec la vue iso (sinon il se lit comme un ×).
    mesh.rotation.z = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
    mesh.userData.isPlus = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  };

  const detachPlus = (key: string) => {
    const plus = plusByKey.get(key);
    if (!plus) return;
    plus.removeFromParent();
    plus.visible = false;
    plusByKey.delete(key);
    plusPool.push(plus);
  };

  const attachPlus = (empty: Mesh, q: number, r: number) => {
    const key = hexKey(q, r);
    let plus = plusByKey.get(key);
    if (!plus) {
      plus = plusPool.pop() ?? createPlusInstance();
      plusByKey.set(key, plus);
    }
    if (plus.parent !== empty) {
      plus.removeFromParent();
      empty.add(plus);
    }
    // Plaqué sur la face supérieure = peint sur la tuile.
    plus.position.set(0, EMPTY_HEIGHT / 2 + 0.0015, 0);
    plus.visible = true;
    plus.userData.isPlus = true;
    plus.userData.q = q;
    plus.userData.r = r;
  };

  const detachFog = (key: string) => {
    const fog = fogByKey.get(key);
    if (!fog) return;
    fog.removeFromParent();
    fog.visible = false;
    fogByKey.delete(key);
    fogPool.push(fog);
  };

  const attachFog = (
    empty: Mesh,
    q: number,
    r: number,
    fogKeys: ReadonlySet<string>
  ) => {
    const key = hexKey(q, r);
    const neighbors = HEX_DIRECTIONS.filter((dir) =>
      fogKeys.has(hexKey(q + dir.q, r + dir.r))
    );
    const neighborSig = neighbors.map((d) => `${d.q},${d.r}`).join("|");
    let fog = fogByKey.get(key);
    if (!fog) {
      fog = fogPool.pop();
      if (fog) fogKit.configureInstance(fog, q, r, neighbors);
      else fog = fogKit.createInstance(q, r, neighbors);
      fog.userData.neighborSig = neighborSig;
      fogByKey.set(key, fog);
    } else if (
      fog.userData.q !== q ||
      fog.userData.r !== r ||
      fog.userData.neighborSig !== neighborSig
    ) {
      fogKit.configureInstance(fog, q, r, neighbors);
      fog.userData.neighborSig = neighborSig;
    }
    if (fog.parent !== empty) {
      fog.removeFromParent();
      empty.add(fog);
    }
    // Flotte clairement au-dessus de la tuile vierge.
    const liftJitter = (fog.userData.liftJitter as number) ?? 1;
    fog.userData.baseY = (EMPTY_HEIGHT / 2 + FOG_CLOUD_LIFT) * liftJitter;
    fog.position.set(0, fog.userData.baseY as number, 0);
    fog.visible = true;
  };

  const village = createVillageMesh();
  village.group.position.y = HEX_HEIGHT / 2;
  const lumberCampKit = createLumberCampMesh();
  lumberCampKit.group.position.y = HEX_HEIGHT / 2;
  const farmKit = createFarmMesh();
  farmKit.group.position.y = HEX_HEIGHT / 2;
  const quarryKit = createQuarryMesh();
  quarryKit.group.position.y = HEX_HEIGHT / 2;
  const fishingHutKit = createFishingHutMesh();
  fishingHutKit.group.position.y = HEX_HEIGHT / 2;
  const houseKit = createHouseMesh();
  houseKit.group.position.y = HEX_HEIGHT / 2;
  const libraryKit = createLibraryMesh();
  libraryKit.group.position.y = HEX_HEIGHT / 2;
  const barracksKit = createBarracksMesh();
  barracksKit.group.position.y = HEX_HEIGHT / 2;
  const marketKit = createMarketMesh();
  marketKit.group.position.y = HEX_HEIGHT / 2;
  const sawmillKit = createSawmillMesh();
  sawmillKit.group.position.y = HEX_HEIGHT / 2;
  const millKit = createMillMesh();
  millKit.group.position.y = HEX_HEIGHT / 2;
  const smelterKit = createSmelterMesh();
  smelterKit.group.position.y = HEX_HEIGHT / 2;
  const brickworksKit = createBrickworksMesh();
  brickworksKit.group.position.y = HEX_HEIGHT / 2;
  const clayMineKit = createClayMineMesh();
  clayMineKit.group.position.y = HEX_HEIGHT / 2;
  const mineKit = createMineMesh();
  mineKit.group.position.y = HEX_HEIGHT / 2;
  const forestDecor = createForestDecorKit();
  const plainsDecor = createPlainsDecorKit();
  const mountainDecor = createMountainDecorKit();
  const mountainClouds = createMountainCloudDecorKit();
  const fusionDecor = createFusionDecorKit();
  const shoreEdges = createShoreEdgeDecorKit();
  const waterDecor = createWaterDecorKit();
  const fishBankDecor = createFishBankDecorKit();
  const cowHerdDecor = createCowHerdDecorKit();
  const ironDepositDecor = createIronDepositDecorKit();
  const clayDepositDecor = createClayDepositDecorKit();
  const lakeDecor = createLakeDecorKit();
  const influenceBorder = createInfluenceBorderKit();
  scene.add(influenceBorder.root);
  const deepWaterTexture = createDeepWaterSurfaceTexture();
  const plainsGrassTexture = createPlainsGrassTexture();
  const tilesByKey = new Map<string, HexTile>();
  /** Source de vérité gameplay côté scène (indépendant du streaming GPU). */
  const tileStatesByKey = new Map<string, TileState>();

  const registerTileState = (
    q: number,
    r: number,
    biome: BiomeId,
    isRegionCenter: boolean,
    buildingId: BuildingId | null = null,
    poiId: PoiId | null = null
  ): TileState => {
    const key = hexKey(q, r);
    const hasVillage = buildingId === "village";
    const state: TileState = {
      q,
      r,
      biome,
      buildingId,
      poiId,
      isRegionCenter,
      hasVillage
    };
    tileStatesByKey.set(key, state);
    biomesByKey.set(key, biome);
    return state;
  };

  const clearBiomeDecor = (tile: HexTile) => {
    if (!tile.decor) return;
    tile.mesh.remove(tile.decor);
    tile.decor = null;
  };

  const attachDecor = (tile: HexTile, decor: Group) => {
    // Local Y = demi-hauteur de la géométrie (le scale.y du mesh gère le relief).
    decor.position.y = tile.biome === "water" ? WATER_HEIGHT / 2 : HEX_HEIGHT / 2;
    tile.mesh.add(decor);
    tile.decor = decor;
  };

  const neighborDirsWhere = (q: number, r: number, pred: (biome: BiomeId) => boolean) => {
    const dirs: number[] = [];
    for (let i = 0; i < HEX_DIRECTIONS.length; i++) {
      const dir = HEX_DIRECTIONS[i]!;
      const neighbor = biomesByKey.get(hexKey(q + dir.q, r + dir.r));
      if (neighbor != null && pred(neighbor)) dirs.push(i);
    }
    return dirs;
  };

  /** True si la tuile touche au moins une terre (arête partagée). */
  const waterTouchesLand = (q: number, r: number) => {
    for (const dir of HEX_DIRECTIONS) {
      const key = hexKey(q + dir.q, r + dir.r);
      const biome = biomesByKey.get(key) ?? tilesByKey.get(key)?.biome;
      if (biome != null && isLandBiome(biome)) return true;
    }
    return false;
  };

  /** Distance hex à la terre la plus proche (1 = côte, 2 = plateau, 3+ = large). */
  const waterLandDistance = (q: number, r: number) => {
    if (waterTouchesLand(q, r)) return 1;
    for (const dir of HEX_DIRECTIONS) {
      const nq = q + dir.q;
      const nr = r + dir.r;
      const biome = biomesByKey.get(hexKey(nq, nr)) ?? tilesByKey.get(hexKey(nq, nr))?.biome;
      if (biome === "water" && waterTouchesLand(nq, nr)) return 2;
    }
    return 3;
  };

  /** 0 = côte, 1 = large — transition douce via le palier à 0.5. */
  const waterDepthFactor = (q: number, r: number) => {
    const dist = waterLandDistance(q, r);
    if (dist <= 1) return 0;
    if (dist === 2) return 0.5;
    return 1;
  };

  const refreshWaterLook = (tile: HexTile) => {
    const depth = waterDepthFactor(tile.q, tile.r);
    paintWaterMaterials(
      tile.materials,
      depth,
      depth > 0.25 ? deepWaterTexture : null
    );
    clearBiomeDecor(tile);
    if (tile.hasVillage) return;

    // Cabane de pêcheur : garder rivage + banc de poissons sous le bâtiment.
    if (tile.buildingId === "fishing_hut") {
      if (tile.poiId !== "fish_bank") return;
      const group = new Group();
      const landDirs = neighborDirsWhere(tile.q, tile.r, isLandBiome);
      if (landDirs.length > 0) {
        group.add(shoreEdges.createWaterEdges(landDirs));
      }
      const fish = fishBankDecor.createForTile(tile.q, tile.r);
      group.add(fish);
      group.userData.isFishBank = true;
      group.userData.fishBank = fish;
      attachDecor(tile, group);
      return;
    }

    if (tile.buildingId) return;

    if (tile.poiId === "fish_bank") {
      const group = new Group();
      const landDirs = neighborDirsWhere(tile.q, tile.r, isLandBiome);
      if (landDirs.length > 0) {
        group.add(shoreEdges.createWaterEdges(landDirs));
      }
      const fish = fishBankDecor.createForTile(tile.q, tile.r);
      group.add(fish);
      group.userData.isFishBank = true;
      group.userData.fishBank = fish;
      attachDecor(tile, group);
      return;
    }

    if (depth >= 1) {
      attachDecor(tile, waterDecor.createDeepSurface(tile.q, tile.r, "deep"));
      return;
    }
    if (depth >= 0.4) {
      attachDecor(tile, waterDecor.createDeepSurface(tile.q, tile.r, "shelf"));
      return;
    }

    const landDirs = neighborDirsWhere(tile.q, tile.r, isLandBiome);
    if (landDirs.length > 0) {
      attachDecor(tile, shoreEdges.createWaterEdges(landDirs));
    }
  };

  /** Recalcule toutes les eaux (évite les teintes périmées après expansion). */
  const refreshAllWaterLooks = () => {
    for (const tile of biomeTiles) {
      if (tile.biome === "water") refreshWaterLook(tile);
    }
  };

  const refreshBiomeDecor = (tile: HexTile) => {
    if (tile.hasVillage) {
      clearBiomeDecor(tile);
      return;
    }

    // Cabane de pêcheur : décor eau / banc conservé sous le mesh.
    if (tile.buildingId === "fishing_hut" && tile.biome === "water") {
      refreshWaterLook(tile);
      return;
    }

    // Autres bâtiments : pas de décor d’origine (ferme efface le troupeau).
    if (tile.buildingId) {
      clearBiomeDecor(tile);
      return;
    }

    if (tile.biome === "water") {
      refreshWaterLook(tile);
      return;
    }

    clearBiomeDecor(tile);
    const group = new Group();
    let hasContent = false;

    const addLake = () => {
      group.add(lakeDecor.createForTile(tile.q, tile.r));
    };

    if (isForestDecorBiome(tile.biome)) {
      if (tile.poiId === "lake") addLake();
      else group.add(forestDecor.createForTile(tile.q, tile.r, "normal"));
      hasContent = true;
    } else if (isPlainsDecorBiome(tile.biome)) {
      if (tile.poiId === "lake") addLake();
      else {
        group.add(plainsDecor.createForTile(tile.q, tile.r));
        if (tile.poiId === "cow_herd") {
          const cows = cowHerdDecor.createForTile(tile.q, tile.r);
          group.add(cows);
          group.userData.isCowHerd = true;
          group.userData.cowHerd = cows;
        } else if (tile.poiId === "clay_deposit") {
          const clay = clayDepositDecor.createForTile(tile.q, tile.r);
          group.add(clay);
          group.userData.isClayDeposit = true;
          group.userData.clayDeposit = clay;
        }
      }
      hasContent = true;
    } else if (isMountainDecorBiome(tile.biome)) {
      if (tile.poiId === "iron_deposit") {
        const iron = ironDepositDecor.createForTile(tile.q, tile.r);
        group.add(iron);
        group.userData.isIronDeposit = true;
        group.userData.ironDeposit = iron;
      } else if (tile.poiId === "lake") {
        addLake();
      } else {
        const chainDirs = mountainChainDirs(tile.q, tile.r, (cell) => {
          const neighbor = biomesByKey.get(hexKey(cell.q, cell.r));
          return neighbor != null && isMountainDecorBiome(neighbor);
        });
        group.add(mountainDecor.createForTile({ q: tile.q, r: tile.r, chainDirs }));
        const clouds = mountainClouds.createForTile(tile.q, tile.r);
        group.add(clouds);
        group.userData.hasMountainClouds = true;
        group.userData.mountainClouds = clouds;
      }
      hasContent = true;
    } else if (isFusionDecorBiome(tile.biome)) {
      if (tile.poiId === "lake") addLake();
      else group.add(fusionDecor.createForTile(tile.q, tile.r, tile.biome));
      hasContent = true;
    }

    const shoreKind = shoreKindForBiome(tile.biome);
    if (shoreKind) {
      const waterDirs = neighborDirsWhere(tile.q, tile.r, (b) => b === "water");
      if (waterDirs.length > 0) {
        group.add(shoreEdges.createLandEdges(waterDirs, shoreKind));
        hasContent = true;
      }
    }

    if (hasContent) attachDecor(tile, group);
  };

  /** Décor local + voisins dont le look dépend des adjacences (montagnes, rivages). */
  const refreshDecorAround = (q: number, r: number) => {
    const self = tilesByKey.get(hexKey(q, r));
    if (self) refreshBiomeDecor(self);
    for (const neighbor of hexNeighbors({ q, r })) {
      const tile = tilesByKey.get(hexKey(neighbor.q, neighbor.r));
      if (tile) refreshBiomeDecor(tile);
    }
  };

  const recycleEmptyMesh = (key: string, mesh: Mesh) => {
    detachPlus(key);
    detachFog(key);
    if (emptyByKey.get(key) === mesh) emptyByKey.delete(key);
    mesh.visible = false;
    mesh.position.y = EMPTY_HEIGHT / 2;
    setEmissive(meshMaterials(mesh), 0, 0, 0);
    emptyPool.push(mesh);
  };

  const releasePendingEmpty = (tile: HexTile) => {
    if (!tile.pendingEmpty) return;
    const mesh = tile.pendingEmpty;
    tile.pendingEmpty = null;
    recycleEmptyMesh(hexKey(tile.q, tile.r), mesh);
  };

  const attachBuildingMesh = (tile: HexTile, buildingId: BuildingId) => {
    if (tile.buildingMesh) {
      tile.mesh.remove(tile.buildingMesh);
      tile.buildingMesh = null;
    }
    const kit =
      buildingId === "lumber_camp"
        ? lumberCampKit
        : buildingId === "farm"
          ? farmKit
          : buildingId === "quarry"
            ? quarryKit
            : buildingId === "fishing_hut"
              ? fishingHutKit
              : buildingId === "house"
                ? houseKit
                : buildingId === "library"
                  ? libraryKit
                  : buildingId === "barracks"
                    ? barracksKit
                    : buildingId === "market"
                      ? marketKit
                : buildingId === "sawmill"
                  ? sawmillKit
                  : buildingId === "mill"
                    ? millKit
                  : buildingId === "smelter"
                    ? smelterKit
                  : buildingId === "brickworks"
                    ? brickworksKit
                  : buildingId === "clay_mine"
                    ? clayMineKit
                    : buildingId === "mine"
                      ? mineKit
                      : null;
    if (!kit) return;
    const instance = kit.group.clone(true);
    instance.position.y = tile.biome === "water" ? WATER_HEIGHT / 2 : HEX_HEIGHT / 2;
    tile.mesh.add(instance);
    tile.buildingMesh = instance;
  };

  const spawnBiomeTile = (
    q: number,
    r: number,
    biome: BiomeId,
    isRegionCenter: boolean,
    spawn: HexSpawnAnim | null = null,
    buildingId: BuildingId | null = null,
    poiId: PoiId | null = null
  ) => {
    const key = hexKey(q, r);
    const existingEmpty = emptyByKey.get(key);
    let pendingEmpty: Mesh | null = null;

    if (existingEmpty) {
      detachPlus(key);
      detachFog(key);
      if (spawn) {
        // Garde la tuile vierge visible jusqu’à la fin de la montée.
        pendingEmpty = existingEmpty;
      } else {
        recycleEmptyMesh(key, existingEmpty);
      }
    }

    const variation = tileVariation(q, r) + (isRegionCenter ? 0.12 : 0);
    const palette = biomePalette[biome];
    const materials = createMaterials(palette, variation);
    if (biome === "plains") {
      materials[1].map = plainsGrassTexture;
      materials[1].roughness = 0.82;
      materials[1].needsUpdate = true;
    }
    if (biome === "water") {
      paintWaterMaterials(materials, 0, null);
    }
    const height = tileMeshHeight(biome, poiId);
    const mesh = new Mesh(biome === "water" ? waterGeometry : biomeGeometry, materials);
    if (biome !== "water") {
      mesh.scale.y = height / HEX_HEIGHT;
    }
    const { x, z } = axialToWorld(q, r);
    const restY = height / 2;
    mesh.position.set(x, spawn ? restY - SPAWN_DEPTH : restY, z);
    mesh.userData.q = q;
    mesh.userData.r = r;
    scene.add(mesh);

    const hasVillage = buildingId === "village";
    const tile: HexTile = {
      mesh,
      restY,
      materials,
      q,
      r,
      biome,
      hasVillage,
      buildingId,
      poiId,
      isRegionCenter,
      decor: null,
      buildingMesh: null,
      spawn,
      pendingEmpty
    };
    biomeTiles.push(tile);
    tilesByMesh.set(mesh, tile);
    tilesByKey.set(key, tile);
    registerTileState(q, r, biome, isRegionCenter, buildingId, poiId);

    if (tile.hasVillage) {
      clearBiomeDecor(tile);
      mesh.add(village.group);
    } else if (tile.buildingId) {
      attachBuildingMesh(tile, tile.buildingId);
      if (tile.buildingId === "fishing_hut") {
        refreshWaterLook(tile);
      } else {
        clearBiomeDecor(tile);
      }
    } else {
      refreshBiomeDecor(tile);
    }
    return tile;
  };

  const startingLocal = createStartingWorld();
  const world = options.initialWorld
    ? {
        tiles: new Map(
          options.initialWorld.tiles.map((tile) => [
            hexKey(tile.q, tile.r),
            {
              biome: tile.biome,
              buildingId: (tile.buildingId ?? null) as BuildingId | null,
              poiId: (tile.poiId ?? null) as PoiId | null
            }
          ] as const)
        ),
        regions: options.initialWorld.regions.map((region) => ({
          center: { ...region.center },
          biome: region.biome
        }))
      }
    : {
        tiles: new Map(
          [...startingLocal.tiles.entries()].map(([key, biome]) => {
            const [q, r] = key.split(",").map(Number);
            return [
              key,
              {
                biome,
                buildingId: startingTileBuildingId(q!, r!),
                poiId: (startingLocal.pois.get(key) ?? null) as PoiId | null
              }
            ] as const;
          })
        ),
        regions: startingLocal.regions
      };
  for (const region of world.regions) {
    regionCenters.push({ ...region.center });
  }
  const regionCenterKeys = new Set(
    regionCenters.map((center) => hexKey(center.q, center.r))
  );
  for (const [key, entry] of world.tiles) {
    const [q, r] = key.split(",").map(Number);
    registerTileState(
      q!,
      r!,
      entry.biome,
      regionCenterKeys.has(key),
      entry.buildingId,
      entry.poiId
    );
  }
  // GPU streamé au premier `syncBiomeTiles` (viewDirty) — pas tout le monde d’un coup.

  const placeEmpty = (mesh: Mesh, q: number, r: number) => {
    const { x, z } = axialToWorld(q, r);
    mesh.position.set(x, EMPTY_HEIGHT / 2, z);
    mesh.visible = true;
    mesh.userData.q = q;
    mesh.userData.r = r;
    mesh.userData.revealKind = "empty";
    paintEmptyMaterials(meshMaterials(mesh), q, r, "empty");
    setEmissive(meshMaterials(mesh), 0, 0, 0);
  };

  const createEmptyMesh = () => {
    const materials = createMaterials(emptyPalette, 0);
    const mesh = new Mesh(emptyGeometry, materials);
    scene.add(mesh);
    return mesh;
  };

  const refreshRevealable = () => {
    revealableCenters.clear();
    revealableFootprint.clear();
    revealableCenterWorld.length = 0;

    for (const candidate of adjacentRegionCenters(regionCenters)) {
      if (!canPlaceRegion(biomesByKey, candidate, regionCenters)) continue;
      const key = hexKey(candidate.q, candidate.r);
      revealableCenters.add(key);
      const world = axialToWorld(candidate.q, candidate.r);
      revealableCenterWorld.push(world);
      for (const cell of regionCells(candidate)) {
        revealableFootprint.add(hexKey(cell.q, cell.r));
      }
    }

    for (const key of [...plusByKey.keys()]) {
      if (!revealableCenters.has(key)) detachPlus(key);
    }

    for (const key of revealableCenters) {
      const mesh = emptyByKey.get(key);
      if (!mesh?.visible) {
        detachPlus(key);
        continue;
      }
      const q = mesh.userData.q as number;
      const r = mesh.userData.r as number;
      attachPlus(mesh, q, r);
    }

    // Brouillard de guerre : nuages sur les vierges hors zone découvrable
    // (+ padding de régions pour previews / démos).
    const fogExemptKeys = new Set<string>(revealableFootprint);
    if (fogClearRegionPadding > 0 && regionCenters.length > 0) {
      let ring = [...regionCenters];
      const seenCenters = new Set(ring.map((c) => hexKey(c.q, c.r)));
      for (let depth = 0; depth < fogClearRegionPadding; depth++) {
        const next: { q: number; r: number }[] = [];
        for (const center of ring) {
          for (const cell of regionCells(center)) {
            fogExemptKeys.add(hexKey(cell.q, cell.r));
          }
          for (const neighbor of regionLatticeNeighbors(center)) {
            const nKey = hexKey(neighbor.q, neighbor.r);
            if (seenCenters.has(nKey)) continue;
            seenCenters.add(nKey);
            next.push(neighbor);
            for (const cell of regionCells(neighbor)) {
              fogExemptKeys.add(hexKey(cell.q, cell.r));
            }
          }
        }
        ring = next;
      }
    }

    const fogKeys = new Set<string>();
    for (const [key, mesh] of emptyByKey) {
      if (!mesh.visible) continue;
      if (fogExemptKeys.has(key)) continue;
      const spawning = tilesByKey.get(key);
      if (spawning?.pendingEmpty === mesh) continue;
      fogKeys.add(key);
    }

    for (const [key, mesh] of emptyByKey) {
      if (!mesh.visible) {
        detachFog(key);
        continue;
      }

      const q = mesh.userData.q as number;
      const r = mesh.userData.r as number;
      const inFootprint = revealableFootprint.has(key);
      paintEmptyMaterials(
        meshMaterials(mesh),
        q,
        r,
        inFootprint ? "reveal-footprint" : "empty"
      );
      mesh.userData.revealKind = inFootprint ? "reveal-footprint" : "empty";

      if (!fogKeys.has(key)) {
        detachFog(key);
        continue;
      }
      attachFog(mesh, q, r, fogKeys);
    }

    for (const key of [...fogByKey.keys()]) {
      if (!fogKeys.has(key)) detachFog(key);
    }
  };

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const groundPoint = new Vector3();
  const rayOrigin = new Vector3();
  const rayDir = new Vector3();
  const grabWorld = new Vector3();
  let hoveredMesh: Mesh | null = null;
  let selectedMesh: Mesh | null = null;
  let tutorialHighlightKeys = new Set<string>();
  let buildValidHighlightKeys = new Set<string>();
  let buildInvalidHighlightKeys = new Set<string>();
  let influenceHighlightKeys = new Set<string>();
  let previewCenter: HexCoord | null = null;
  let hoverPreviewCenter: HexCoord | null = null;
  let frame = 0;
  let viewDirty = true;
  let hoverDirty = false;
  let lastClientX = 0;
  let lastClientY = 0;
  let hasPointer = false;
  let dragging = false;
  let dragMoved = false;
  let activePointer: number | null = null;
  let recenterActive = false;
  let recenterView = false;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartView = VIEW_DEFAULT;
  const activePointers = new Map<number, { x: number; y: number }>();
  const TAP_SLOP_PX = 14;
  /** Ignore les pointer mouse synthétiques après un geste tactile. */
  let ignoreMouseUntil = 0;

  const cancelRecenter = () => {
    recenterActive = false;
    recenterView = false;
  };

  const pointerDistance = () => {
    if (activePointers.size < 2) return 0;
    const [a, b] = activePointers.values();
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  };

  const pointerMidpoint = () => {
    let x = 0;
    let y = 0;
    for (const p of activePointers.values()) {
      x += p.x;
      y += p.y;
    }
    const n = activePointers.size || 1;
    return { x: x / n, y: y / n };
  };

  const applyZoomAt = (clientX: number, clientY: number, nextViewSize: number) => {
    cancelRecenter();
    const fromX = lookTarget.x;
    const fromZ = lookTarget.z;
    clientToGround(clientX, clientY, grabWorld);
    viewSize = Math.min(VIEW_MAX, Math.max(VIEW_MIN, nextViewSize));
    const { width, height } = canvasSize();
    applyProjection(width, height);
    applyCamera();
    clientToGround(clientX, clientY, groundPoint);
    lookTarget.add(grabWorld).sub(groundPoint);
    clampLookTargetToConstructible(fromX, fromZ);
    viewDirty = true;
    hoverDirty = true;
  };

  const applyProjection = (width: number, height: number) => {
    const aspect = width / height;
    const biasY = frameBiasY;
    const biasX = frameBiasX;
    const halfW = viewSize * aspect;
    // Asymmetric frustum: look target sits right/higher when bias > 0.
    camera.left = -halfW * (1 + biasX);
    camera.right = halfW * (1 - biasX);
    camera.top = viewSize * (1 - biasY);
    camera.bottom = -viewSize * (1 + biasY);
    camera.updateProjectionMatrix();
  };

  const canvasSize = () => {
    // Prefer the laid-out container (e.g. .game-shell) over window size so
    // Side Rail margins / max-width reflows keep the orthographic frustum sharp.
    const container = canvas.parentElement ?? canvas;
    const width = Math.max(
      1,
      Math.round(container.clientWidth || canvas.clientWidth || canvas.getBoundingClientRect().width)
    );
    const height = Math.max(
      1,
      Math.round(
        container.clientHeight || canvas.clientHeight || canvas.getBoundingClientRect().height
      )
    );
    const rect = canvas.getBoundingClientRect();
    return { rect, width, height };
  };

  const clientToGround = (clientX: number, clientY: number, target: Vector3) => {
    const { rect } = canvasSize();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    rayOrigin.set(ndcX, ndcY, -1).unproject(camera);
    rayDir.set(ndcX, ndcY, 1).unproject(camera).sub(rayOrigin);
    if (Math.abs(rayDir.y) < 1e-8) {
      target.set(lookTarget.x, 0, lookTarget.z);
      return;
    }
    const t = -rayOrigin.y / rayDir.y;
    const x = rayOrigin.x + rayDir.x * t;
    const z = rayOrigin.z + rayDir.z * t;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      target.set(lookTarget.x, 0, lookTarget.z);
      return;
    }
    target.set(x, 0, z);
  };

  const visibleGroundAabb = (pad = HEX_SIZE * 3, ndcExtent = 1): Aabb => {
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    const e = Math.max(0.05, Math.min(1, ndcExtent));
    for (const [nx, ny] of [
      [-e, -e],
      [e, -e],
      [-e, e],
      [e, e]
    ] as const) {
      rayOrigin.set(nx, ny, -1).unproject(camera);
      rayDir.set(nx, ny, 1).unproject(camera).sub(rayOrigin);
      const t = -rayOrigin.y / rayDir.y;
      const x = rayOrigin.x + rayDir.x * t;
      const z = rayOrigin.z + rayDir.z * t;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minZ: minZ - pad,
      maxZ: maxZ + pad
    };
  };

  /**
   * True si du territoire jouable (régions déjà construites ou centres
   * constructibles) reste dans la moitié centrale de l’écran — évite un
   * viewport full nuages en panant trop loin, sans bloquer le pan sur
   * le monde déjà développé.
   */
  const viewportHasPlayableTerritory = () => {
    const bounds = visibleGroundAabb(HEX_SIZE * 0.35, 0.5);
    for (const p of revealableCenterWorld) {
      if (pointInAabb(p.x, p.z, bounds)) return true;
    }
    for (const state of tileStatesByKey.values()) {
      const { x, z } = axialToWorld(state.q, state.r);
      if (pointInAabb(x, z, bounds)) return true;
    }
    return tileStatesByKey.size === 0 && revealableCenterWorld.length === 0;
  };

  /**
   * Si le lookTarget sort trop loin (plus de territoire jouable au centre),
   * ramène le long du segment depuis (fromX, fromZ).
   */
  const clampLookTargetToConstructible = (fromX: number, fromZ: number) => {
    applyCamera();
    if (viewportHasPlayableTerritory()) return;

    const toX = lookTarget.x;
    const toZ = lookTarget.z;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) * 0.5;
      lookTarget.set(fromX + (toX - fromX) * mid, 0, fromZ + (toZ - fromZ) * mid);
      applyCamera();
      if (viewportHasPlayableTerritory()) lo = mid;
      else hi = mid;
    }
    lookTarget.set(fromX + (toX - fromX) * lo, 0, fromZ + (toZ - fromZ) * lo);
    applyCamera();
  };

  const pointInAabb = (x: number, z: number, bounds: Aabb) =>
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

  /** Retire le mesh GPU ; conserve `tileStatesByKey` / `biomesByKey`. */
  const detachBiomeGpu = (key: string) => {
    const tile = tilesByKey.get(key);
    if (!tile) return;
    if (tile.spawn) return;
    if (tile.mesh === selectedMesh || tile.mesh === hoveredMesh) return;

    clearBiomeDecor(tile);
    if (tile.buildingMesh) {
      tile.mesh.remove(tile.buildingMesh);
      tile.buildingMesh = null;
    }
    if (tile.hasVillage) {
      tile.mesh.remove(village.group);
    }
    if (tile.pendingEmpty) {
      releasePendingEmpty(tile);
    }
    scene.remove(tile.mesh);
    for (const material of tile.materials) material.dispose();
    tilesByMesh.delete(tile.mesh);
    tilesByKey.delete(key);
    const index = biomeTiles.indexOf(tile);
    if (index >= 0) biomeTiles.splice(index, 1);
  };

  const ensureBiomeGpu = (
    state: TileState,
    spawn: HexSpawnAnim | null = null
  ): HexTile => {
    const key = hexKey(state.q, state.r);
    const existing = tilesByKey.get(key);
    if (existing) return existing;
    const tile = spawnBiomeTile(
      state.q,
      state.r,
      state.biome,
      state.isRegionCenter,
      spawn,
      state.buildingId,
      state.poiId
    );
    refreshDecorAround(state.q, state.r);
    return tile;
  };

  /**
   * Streaming GPU des biomes : charge autour du viewport, décharge au-delà
   * d’une hystérésis. L’état logique (`tileStatesByKey`) reste complet.
   */
  const syncBiomeTiles = () => {
    const loadBounds = visibleGroundAabb(BIOME_LOAD_PAD);
    const unloadBounds = visibleGroundAabb(BIOME_UNLOAD_PAD);
    let loadedAny = false;

    for (const state of tileStatesByKey.values()) {
      const { x, z } = axialToWorld(state.q, state.r);
      if (!pointInAabb(x, z, loadBounds)) continue;
      const key = hexKey(state.q, state.r);
      if (tilesByKey.has(key)) continue;
      ensureBiomeGpu(state, null);
      loadedAny = true;
    }

    for (const tile of [...biomeTiles]) {
      const { x, z } = axialToWorld(tile.q, tile.r);
      if (pointInAabb(x, z, unloadBounds)) continue;
      detachBiomeGpu(hexKey(tile.q, tile.r));
    }

    if (loadedAny) {
      refreshAllWaterLooks();
    }
  };

  const syncEmptyTiles = () => {
    const bounds = visibleGroundAabb();
    const needed = hexesCoveringAabb(bounds);
    const keep = new Set<string>();

    for (const cell of needed) {
      if (biomesByKey.has(hexKey(cell.q, cell.r))) continue;
      keep.add(hexKey(cell.q, cell.r));
    }

    for (const [key, mesh] of emptyByKey) {
      if (keep.has(key)) continue;
      // Tuile encore sous une biomes en train d’émerger.
      const spawning = tilesByKey.get(key);
      if (spawning?.spawn && spawning.pendingEmpty === mesh) continue;
      recycleEmptyMesh(key, mesh);
    }

    for (const cell of needed) {
      if (biomesByKey.has(hexKey(cell.q, cell.r))) continue;
      const key = hexKey(cell.q, cell.r);
      if (emptyByKey.has(key)) continue;
      const mesh = emptyPool.pop() ?? createEmptyMesh();
      placeEmpty(mesh, cell.q, cell.r);
      emptyByKey.set(key, mesh);
    }

    for (const mesh of emptyPool) {
      mesh.visible = false;
    }

    refreshRevealable();
  };

  const pickMeshes = () => {
    const meshes: Mesh[] = biomeTiles.map((tile) => tile.mesh);
    for (const mesh of emptyByKey.values()) {
      if (mesh.visible) meshes.push(mesh);
    }
    return meshes;
  };

  const emptyPayload = (
    q: number,
    r: number,
    pointer?: { clientX: number; clientY: number }
  ): SelectedTile => {
    const canGenerate = canPlaceRegion(biomesByKey, { q, r }, regionCenters);
    return {
      q,
      r,
      biome: null,
      hasVillage: false,
      buildingId: null,
      canGenerate,
      isRegionCenter: canGenerate,
      clientX: pointer?.clientX,
      clientY: pointer?.clientY
    };
  };

  const biomePayload = (
    tile: HexTile,
    pointer?: { clientX: number; clientY: number }
  ): SelectedTile => ({
    q: tile.q,
    r: tile.r,
    biome: tile.biome,
    hasVillage: tile.hasVillage,
    buildingId: tile.buildingId,
    canGenerate: false,
    isRegionCenter: tile.isRegionCenter,
    clientX: pointer?.clientX,
    clientY: pointer?.clientY
  });

  /** Remonte jusqu’à la tuile hex (clic sur bâtiment / décor enfant). */
  const tileFromObject = (object: Object3D): { mesh: Mesh; tile: HexTile } | undefined => {
    let current: Object3D | null = object;
    while (current) {
      if (current instanceof Mesh) {
        const tile = tilesByMesh.get(current);
        if (tile) return { mesh: current, tile };
      }
      current = current.parent;
    }
    return undefined;
  };

  const hitAt = (clientX: number, clientY: number) => {
    const { rect } = canvasSize();
    if (rect.width < 1 || rect.height < 1) return undefined;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickMeshes(), true)[0];
    if (!(hit?.object instanceof Mesh)) return undefined;
    const pointerPos = { clientX, clientY };
    const viaPlus = Boolean(hit.object.userData.isPlus);
    if (viaPlus) {
      const q = hit.object.userData.q as number;
      const r = hit.object.userData.r as number;
      if (typeof q !== "number" || typeof r !== "number") return undefined;
      const empty = emptyByKey.get(hexKey(q, r));
      if (!empty) return undefined;
      return {
        mesh: empty,
        payload: emptyPayload(q, r, pointerPos),
        viaPlus: true as const
      };
    }
    const owned = tileFromObject(hit.object);
    if (owned) {
      return { mesh: owned.mesh, payload: biomePayload(owned.tile, pointerPos) };
    }
    const q = hit.object.userData.q;
    const r = hit.object.userData.r;
    if (typeof q !== "number" || typeof r !== "number") return undefined;
    return { mesh: hit.object, payload: emptyPayload(q, r, pointerPos) };
  };

  const syncPlusVisibility = () => {
    const openKey =
      previewCenter != null ? hexKey(previewCenter.q, previewCenter.r) : null;
    for (const [key, plus] of plusByKey) {
      plus.visible = key !== openKey;
    }
  };

  const emitSelection = (mesh: Mesh | null, payload: SelectedTile | null) => {
    selectedMesh = mesh;
    previewCenter =
      payload && payload.canGenerate && !payload.biome
        ? { q: payload.q, r: payload.r }
        : null;
    syncPlusVisibility();
    options.onSelect?.(payload);
  };

  const updateHoverFromClient = (clientX: number, clientY: number) => {
    if (dragging && dragMoved) {
      hoveredMesh = null;
      hoverPreviewCenter = null;
      canvas.style.cursor = "grabbing";
      return;
    }

    const hit = hitAt(clientX, clientY);
    const isGenerate = Boolean(hit?.payload.canGenerate);
    const isBiome = hit != null && hit.payload.biome != null;
    // Tuiles inconnues banales : pas de survol interactif (sauf centres +).
    hoveredMesh = isGenerate || isBiome ? (hit?.mesh ?? null) : null;
    hoverPreviewCenter = isGenerate
      ? { q: hit!.payload.q, r: hit!.payload.r }
      : null;
    canvas.style.cursor =
      isGenerate || isBiome ? HOVER_CURSOR : dragging ? "grabbing" : "grab";
  };

  const refreshHover = () => {
    if (!hasPointer) {
      hoveredMesh = null;
      hoverPreviewCenter = null;
      canvas.style.cursor = dragging ? "grabbing" : "grab";
      return;
    }
    updateHoverFromClient(lastClientX, lastClientY);
  };

  const resize = () => {
    const { width, height } = canvasSize();
    applyProjection(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    applyCamera();
    syncBiomeTiles();
    syncEmptyTiles();
    viewDirty = false;
    hoverDirty = true;
  };

  const zoom = (event: WheelEvent) => {
    event.preventDefault();
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    hasPointer = true;

    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    if (event.deltaMode === 2) delta *= 800;
    applyZoomAt(event.clientX, event.clientY, viewSize * Math.exp(delta * 0.00115));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (event.pointerType === "mouse" && performance.now() < ignoreMouseUntil) return;

    if (event.pointerType === "touch") {
      ignoreMouseUntil = performance.now() + 650;
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    hasPointer = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore — certains navigateurs refusent si déjà capturé
    }

    if (activePointers.size >= 2) {
      // Passe en pinch : annule le pan / empêche une sélection au relâchement.
      pinching = true;
      dragging = false;
      dragMoved = true;
      activePointer = null;
      cancelRecenter();
      pinchStartDist = pointerDistance();
      pinchStartView = viewSize;
      hoveredMesh = null;
      canvas.style.cursor = "grab";
      // Mobile : pinch = navigation carte → ferme la roue / sélection.
      if (event.pointerType === "touch") emitSelection(null, null);
      return;
    }

    if (pinching) return;

    activePointer = event.pointerId;
    dragging = true;
    dragMoved = false;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    clientToGround(event.clientX, event.clientY, grabWorld);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && performance.now() < ignoreMouseUntil) return;
    if (!activePointers.has(event.pointerId) && !dragging) {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      hasPointer = true;
      updateHoverFromClient(event.clientX, event.clientY);
      return;
    }

    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    lastClientX = event.clientX;
    lastClientY = event.clientY;
    hasPointer = true;

    if (pinching && activePointers.size >= 2) {
      const dist = pointerDistance();
      if (pinchStartDist > 0 && dist > 0) {
        const mid = pointerMidpoint();
        applyZoomAt(mid.x, mid.y, pinchStartView * (pinchStartDist / dist));
      }
      return;
    }

    if (!dragging || event.pointerId !== activePointer) {
      updateHoverFromClient(event.clientX, event.clientY);
      return;
    }

    const slop = Math.hypot(event.clientX - dragStartClientX, event.clientY - dragStartClientY);
    if (!dragMoved && slop < TAP_SLOP_PX) {
      return;
    }

    const startedPan = !dragMoved;
    clientToGround(event.clientX, event.clientY, groundPoint);
    dragMoved = true;
    hoveredMesh = null;
    cancelRecenter();
    const fromX = lookTarget.x;
    const fromZ = lookTarget.z;
    lookTarget.add(grabWorld).sub(groundPoint);
    clampLookTargetToConstructible(fromX, fromZ);
    // Recalcule le grab sous le doigt après clamp (évite l’accélération au bord).
    clientToGround(event.clientX, event.clientY, grabWorld);
    viewDirty = true;
    canvas.style.cursor = "grabbing";
    // Mobile : dès qu’on pan la carte, on ferme la modal de biomes.
    if (startedPan && event.pointerType === "touch") emitSelection(null, null);
  };

  const endDrag = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && performance.now() < ignoreMouseUntil) {
      activePointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (event.pointerType === "touch") {
      ignoreMouseUntil = performance.now() + 650;
    }

    activePointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (pinching) {
      if (activePointers.size >= 2) {
        pinchStartDist = pointerDistance();
        pinchStartView = viewSize;
        return;
      }
      // Dernier doigt du pinch : pas de sélection.
      pinching = false;
      dragging = false;
      activePointer = null;
      dragMoved = false;
      hoverDirty = true;
      return;
    }

    if (event.pointerId !== activePointer) {
      hoverDirty = true;
      return;
    }

    const wasDrag = dragMoved;
    const clientX = event.clientX;
    const clientY = event.clientY;
    dragging = false;
    activePointer = null;

    if (!wasDrag && event.type !== "pointercancel") {
      const hit = hitAt(clientX, clientY);
      if (hit?.payload.canGenerate) {
        // Toute la tuile centre (+) ouvre la roue.
        if (hit.mesh === selectedMesh) emitSelection(null, null);
        else emitSelection(hit.mesh, hit.payload);
      } else if (hit?.payload.biome != null) {
        if (hit.mesh === selectedMesh) emitSelection(null, null);
        else emitSelection(hit.mesh, hit.payload);
      } else {
        // Tap ailleurs (vide / tuile inconnue) : ferme la sélection / roue.
        emitSelection(null, null);
      }
    }

    hoverDirty = true;
  };

  const onPointerLeave = () => {
    if (dragging || pinching || activePointers.size > 0) return;
    hasPointer = false;
    hoveredMesh = null;
    canvas.style.cursor = "grab";
    hoverDirty = true;
  };

  const recenter = () => {
    recenterActive = true;
    recenterView = true;
  };

  const setFraming = (framing: HexSceneFraming) => {
    if (framing.viewSize != null) {
      viewSize = Math.min(VIEW_MAX, Math.max(VIEW_MIN, framing.viewSize));
    }
    if (framing.frameBiasY != null) {
      frameBiasY = Math.min(0.7, Math.max(0, framing.frameBiasY));
    }
    if (framing.frameBiasX != null) {
      frameBiasX = Math.min(0.7, Math.max(0, framing.frameBiasX));
    }
    const { width, height } = canvasSize();
    applyProjection(width, height);
    applyCamera();
    viewDirty = true;
    hoverDirty = true;
  };

  const clearSelection = () => {
    emitSelection(null, null);
  };

  const applyRegion = (
    center: HexCoord,
    _biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => {
    if (tiles.length === 0) return false;
    if (biomesByKey.has(hexKey(center.q, center.r))) return false;

    regionCenters.push({ ...center });
    const t0 = performance.now();
    const delays = spawnDelaysForRegion(tiles, center);
    const timed = tiles
      .map((cell) => ({
        cell,
        delayMs: delays.get(hexKey(cell.q, cell.r)) ?? SPAWN_RING_START_MS
      }))
      .sort((a, b) => a.delayMs - b.delayMs);

    for (const { cell, delayMs } of timed) {
      const poiId = (cell.poiId ?? null) as PoiId | null;
      registerTileState(
        cell.q,
        cell.r,
        cell.biome,
        cell.q === center.q && cell.r === center.r,
        (cell.buildingId ?? null) as BuildingId | null,
        poiId
      );
      // Expansion sous les yeux : toujours spawner le GPU (anim vague).
      spawnBiomeTile(
        cell.q,
        cell.r,
        cell.biome,
        cell.q === center.q && cell.r === center.r,
        { t0, delayMs },
        (cell.buildingId ?? null) as BuildingId | null,
        poiId
      );
    }
    for (const cell of tiles) {
      refreshDecorAround(cell.q, cell.r);
    }
    refreshAllWaterLooks();
    viewDirty = true;
    hoverDirty = true;
    hoverPreviewCenter = null;
    emitSelection(null, null);
    refreshRevealable();
    return true;
  };

  const applyBuilding = (q: number, r: number, buildingId: BuildingId) => {
    const key = hexKey(q, r);
    const state = tileStatesByKey.get(key);
    if (!state || state.hasVillage || state.buildingId) return false;
    if (buildingId === "village") return false;
    state.buildingId = buildingId;
    // Ferme : troupeau effacé. Gisements argile / fer : conservés pour leurs mines.
    if (
      state.poiId === "cow_herd" ||
      (state.poiId === "iron_deposit" && buildingId !== "mine") ||
      (state.poiId === "clay_deposit" && buildingId !== "clay_mine")
    ) {
      state.poiId = null;
    }

    const tile = tilesByKey.get(key) ?? ensureBiomeGpu(state, null);
    tile.buildingId = buildingId;
    if (
      tile.poiId === "cow_herd" ||
      (tile.poiId === "iron_deposit" && buildingId !== "mine") ||
      (tile.poiId === "clay_deposit" && buildingId !== "clay_mine")
    ) {
      tile.poiId = null;
    }
    attachBuildingMesh(tile, buildingId);
    if (buildingId === "fishing_hut") {
      refreshWaterLook(tile);
    } else {
      clearBiomeDecor(tile);
    }
    viewDirty = true;
    hoverDirty = true;
    emitSelection(tile.mesh, biomePayload(tile, { clientX: lastClientX, clientY: lastClientY }));
    return true;
  };

  const removeBuilding = (q: number, r: number) => {
    const key = hexKey(q, r);
    const state = tileStatesByKey.get(key);
    if (!state || state.hasVillage || !state.buildingId) return false;
    state.buildingId = null;

    const tile = tilesByKey.get(key);
    if (!tile) {
      viewDirty = true;
      return true;
    }
    if (tile.hasVillage || !tile.buildingId) return false;
    if (tile.buildingMesh) {
      tile.mesh.remove(tile.buildingMesh);
      tile.buildingMesh = null;
    }
    tile.buildingId = null;
    refreshBiomeDecor(tile);
    viewDirty = true;
    hoverDirty = true;
    emitSelection(tile.mesh, biomePayload(tile, { clientX: lastClientX, clientY: lastClientY }));
    return true;
  };

  /** Remplace biome + mesh (ex. terre↔eau) et retire le bâtiment. */
  const applyTileBiome = (q: number, r: number, biome: BiomeId) => {
    const key = hexKey(q, r);
    const state = tileStatesByKey.get(key);
    if (!state) return false;
    // Ne pas inventer / écraser le HDV hors données métier.
    if (state.hasVillage || state.buildingId === "village") return false;

    const wasCenter = state.isRegionCenter;
    state.biome = biome;
    state.buildingId = null;
    if (!poiAllowedOnBiome(state.poiId, biome)) state.poiId = null;
    biomesByKey.set(key, biome);

    const old = tilesByKey.get(key);
    if (old) {
      clearBiomeDecor(old);
      if (old.buildingMesh) {
        old.mesh.remove(old.buildingMesh);
        old.buildingMesh = null;
      }
      if (old.hasVillage) {
        old.mesh.remove(village.group);
      }
      scene.remove(old.mesh);
      for (const material of old.materials) material.dispose();
      tilesByMesh.delete(old.mesh);
      tilesByKey.delete(key);
      const index = biomeTiles.indexOf(old);
      if (index >= 0) biomeTiles.splice(index, 1);
    }

    const tile = spawnBiomeTile(
      q,
      r,
      biome,
      wasCenter,
      null,
      null,
      state.poiId
    );
    refreshDecorAround(q, r);
    refreshAllWaterLooks();
    viewDirty = true;
    hoverDirty = true;
    emitSelection(tile.mesh, biomePayload(tile, { clientX: lastClientX, clientY: lastClientY }));
    return true;
  };

  const projectScratch = new Vector3();
  const projectTile = (q: number, r: number): HexScreenPoint | null => {
    const { width, height } = canvasSize();
    if (width < 1 || height < 1) return null;
    const { x, z } = axialToWorld(q, r);
    const key = hexKey(q, r);
    const state = tileStatesByKey.get(key);
    const tile = tilesByKey.get(key);
    const restY =
      tile?.restY ??
      (state ? tileMeshHeight(state.biome, state.poiId) / 2 : EMPTY_HEIGHT / 2);
    // Légèrement au-dessus du centre volume pour viser le centre visuel de la face.
    projectScratch.set(x, restY + 0.52, z);
    projectScratch.project(camera);
    const sx = (projectScratch.x * 0.5 + 0.5) * width;
    const sy = (-projectScratch.y * 0.5 + 0.5) * height;
    const visible =
      projectScratch.x >= -1.15 &&
      projectScratch.x <= 1.15 &&
      projectScratch.y >= -1.15 &&
      projectScratch.y <= 1.15 &&
      projectScratch.z >= -1 &&
      projectScratch.z <= 1;
    return { x: sx, y: sy, visible };
  };

  const generateRegion = (q: number, r: number, biome: PrimaryBiomeId) => {
    const center = { q, r };
    const created = generateRegionTiles(biomesByKey, center, biome, regionCenters);
    if (created.length === 0) return false;
    return applyRegion(center, biome, created);
  };

  const tick = () => {
    frame = requestAnimationFrame(tick);

    if (recenterActive) {
      lookTarget.lerp(ORIGIN, 0.18);
      if (recenterView) {
        viewSize += (VIEW_DEFAULT - viewSize) * 0.18;
        if (Math.abs(viewSize - VIEW_DEFAULT) < 0.02) {
          viewSize = VIEW_DEFAULT;
          recenterView = false;
        }
        const { width, height } = canvasSize();
        applyProjection(width, height);
      }
      if (lookTarget.lengthSq() < 0.0004 && !recenterView) {
        lookTarget.set(0, 0, 0);
        recenterActive = false;
      }
      applyCamera();
      viewDirty = true;
      hoverDirty = true;
    }

    if (viewDirty) {
      syncBiomeTiles();
      syncEmptyTiles();
      viewDirty = false;
    }

    if (hoverDirty) {
      refreshHover();
      hoverDirty = false;
    }

    const activePreview = previewCenter ?? hoverPreviewCenter;
    const previewKeys = new Set(
      activePreview ? regionCells(activePreview).map((cell) => hexKey(cell.q, cell.r)) : []
    );
    const previewOk = activePreview
      ? canPlaceRegion(biomesByKey, activePreview, regionCenters)
      : false;

    const now = performance.now();
    const tutorialPulse = 0.55 + 0.45 * Math.sin(now * 0.006);
    for (const tile of biomeTiles) {
      const hoveredHere = tile.mesh === hoveredMesh;
      const selectedHere = tile.mesh === selectedMesh;
      const tutorialHere = tutorialHighlightKeys.has(hexKey(tile.q, tile.r));
      const buildValidHere = buildValidHighlightKeys.has(hexKey(tile.q, tile.r));
      const buildInvalidHere = buildInvalidHighlightKeys.has(hexKey(tile.q, tile.r));
      const influenceHere = influenceHighlightKeys.has(hexKey(tile.q, tile.r));
      const inPreview = previewKeys.has(hexKey(tile.q, tile.r));

      if (tile.spawn) {
        const elapsed = now - tile.spawn.t0 - tile.spawn.delayMs;
        if (elapsed < 0) {
          tile.mesh.position.y = tile.restY - SPAWN_DEPTH;
        } else {
          const t = Math.min(1, elapsed / SPAWN_DURATION_MS);
          tile.mesh.position.y = spawnLift(t, tile.restY);
          if (t >= 1) {
            tile.spawn = null;
            releasePendingEmpty(tile);
          }
        }
      } else {
        const targetY =
          tile.restY +
          (hoveredHere
            ? HOVER_LIFT
            : selectedHere
              ? SELECT_LIFT
              : buildValidHere
                ? SELECT_LIFT * 0.45
                : buildInvalidHere
                  ? SELECT_LIFT * 0.3
                  : tutorialHere
                    ? SELECT_LIFT * 0.55
                    : 0);
        tile.mesh.position.y += (targetY - tile.mesh.position.y) * 0.18;
      }

      if (hoveredHere) {
        setEmissive(tile.materials, 0.14, 0.115, 0.056);
      } else if (selectedHere) {
        setEmissive(tile.materials, 0.22, 0.16, 0.04);
      } else if (buildValidHere) {
        const e = 0.16 + tutorialPulse * 0.28;
        setEmissive(tile.materials, e * 0.12, e * 0.92, e * 0.22);
      } else if (buildInvalidHere) {
        const e = 0.14 + tutorialPulse * 0.26;
        setEmissive(tile.materials, e * 0.95, e * 0.1, e * 0.08);
      } else if (tutorialHere) {
        const e = 0.14 + tutorialPulse * 0.2;
        setEmissive(tile.materials, e * 0.95, e, e * 0.82);
      } else if (influenceHere) {
        // Teinte très légère — la délimitation = pointillés d’arête.
        const e = 0.035 + tutorialPulse * 0.02;
        setEmissive(tile.materials, e * 0.7, e * 0.75, e);
      } else if (inPreview && previewOk) {
        setEmissive(tile.materials, 0.08, 0.14, 0.06);
      } else if (inPreview) {
        setEmissive(tile.materials, 0.18, 0.05, 0.03);
      } else {
        setEmissive(tile.materials, 0, 0, 0);
      }
    }

    const emptyRestY = EMPTY_HEIGHT / 2;
    let hintFootprint: Set<string> | null = null;
    if (previewKeys.size === 0) {
      const focusMesh =
        hoveredMesh && revealableCenters.has(hexKey(hoveredMesh.userData.q as number, hoveredMesh.userData.r as number))
          ? hoveredMesh
          : selectedMesh &&
              revealableCenters.has(hexKey(selectedMesh.userData.q as number, selectedMesh.userData.r as number))
            ? selectedMesh
            : null;
      if (focusMesh) {
        hintFootprint = new Set(
          regionCells({ q: focusMesh.userData.q as number, r: focusMesh.userData.r as number }).map((cell) =>
            hexKey(cell.q, cell.r)
          )
        );
      }
    }

    for (const [key, mesh] of emptyByKey) {
      if (!mesh.visible) continue;
      const hoveredHere = mesh === hoveredMesh;
      const selectedHere = mesh === selectedMesh;
      const tutorialHere = tutorialHighlightKeys.has(key);
      const inPreview = previewKeys.has(key);
      const isCenter = revealableCenters.has(key);
      const inHintFootprint = Boolean(hintFootprint?.has(key) && !isCenter && !biomesByKey.has(key));
      const revealLift = inHintFootprint ? REVEAL_FOOTPRINT_LIFT : 0;
      const targetY =
        emptyRestY +
        (hoveredHere && isCenter
          ? HOVER_LIFT
          : selectedHere && isCenter
            ? SELECT_LIFT
            : tutorialHere
              ? SELECT_LIFT * 0.55
              : revealLift);
      mesh.position.y += (targetY - mesh.position.y) * 0.18;
      const materials = meshMaterials(mesh);

      if (hoveredHere && isCenter) {
        setEmissive(materials, 0.06, 0.07, 0.065);
      } else if (selectedHere && isCenter) {
        setEmissive(materials, 0.08, 0.09, 0.085);
      } else if (tutorialHere) {
        const e = 0.12 + tutorialPulse * 0.18;
        setEmissive(materials, e * 0.9, e, e * 0.85);
      } else if (inPreview && previewOk) {
        setEmissive(materials, 0.05, 0.07, 0.055);
      } else if (inPreview) {
        setEmissive(materials, 0.1, 0.04, 0.03);
      } else if (inHintFootprint) {
        setEmissive(materials, 0.03, 0.04, 0.03);
      } else {
        setEmissive(materials, 0, 0, 0);
      }
    }

    for (const fog of fogByKey.values()) {
      if (fog.visible) fogKit.animate(fog, now);
    }

    village.animate(now);

    for (const tile of biomeTiles) {
      const decor = tile.decor;
      if (!decor) continue;
      if (decor.userData.isFishBank) {
        const root = (decor.userData.fishBank as Group | undefined) ?? decor;
        fishBankDecor.animate(root, now);
      }
      if (decor.userData.isCowHerd) {
        const root = (decor.userData.cowHerd as Group | undefined) ?? decor;
        cowHerdDecor.animate(root, now);
      }
      if (decor.userData.isIronDeposit) {
        const root = (decor.userData.ironDeposit as Group | undefined) ?? decor;
        ironDepositDecor.animate(root, now);
      }
      if (decor.userData.isClayDeposit) {
        const root = (decor.userData.clayDeposit as Group | undefined) ?? decor;
        clayDepositDecor.animate(root, now);
      }
      if (decor.userData.hasMountainClouds) {
        const root = (decor.userData.mountainClouds as Group | undefined) ?? decor;
        mountainClouds.animate(root, now);
      }
      if (decor.userData.hasShoreWaves) {
        shoreEdges.animate(decor, now);
      } else {
        for (const child of decor.children) {
          if (child.userData.hasShoreWaves) {
            shoreEdges.animate(child as Group, now);
          }
        }
      }
    }

    // Parallax gyro / souris : render only, restore logical cam for picking.
    const tilt = options.getDeviceTilt?.() ?? { x: 0, y: 0 };
    const tx = Number.isFinite(tilt.x) ? Math.min(1, Math.max(-1, tilt.x)) : 0;
    const ty = Number.isFinite(tilt.y) ? Math.min(1, Math.max(-1, tilt.y)) : 0;
    if (tx !== 0 || ty !== 0) {
      applyCameraTilted(tx, ty);
      sun.position.set(
        sunBase.x + tx * TILT_SUN_STRENGTH,
        sunBase.y,
        sunBase.z + ty * TILT_SUN_STRENGTH * 0.65
      );
    }

    renderer.render(scene, camera);

    if (tx !== 0 || ty !== 0) {
      applyCamera();
      sun.position.copy(sunBase);
    }
  };

  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", zoom, { passive: false });
  requestAnimationFrame(resize);
  tick();

  const setTutorialHighlights = (coords: readonly HexCoord[]) => {
    tutorialHighlightKeys = new Set(coords.map((cell) => hexKey(cell.q, cell.r)));
  };

  const setBuildHighlights = (
    valid: readonly HexCoord[],
    invalid: readonly HexCoord[] = []
  ) => {
    buildValidHighlightKeys = new Set(valid.map((cell) => hexKey(cell.q, cell.r)));
    buildInvalidHighlightKeys = new Set(invalid.map((cell) => hexKey(cell.q, cell.r)));
  };

  const setInfluenceHighlights = (coords: readonly HexCoord[]) => {
    influenceHighlightKeys = new Set(coords.map((cell) => hexKey(cell.q, cell.r)));
    // Plateau = dessus du cylindre (mesh centré à restY = height/2 → top = 2*restY).
    influenceBorder.rebuild(coords, (q, r) => {
      const tile = tilesByKey.get(hexKey(q, r));
      if (tile) return 2 * tile.restY + 0.02;
      const biome = biomesByKey.get(hexKey(q, r));
      if (biome === "water") return WATER_HEIGHT + 0.02;
      return HEX_HEIGHT + 0.02;
    });
  };

  const api = {
    recenter,
    clearSelection,
    setFraming,
    generateRegion,
    applyRegion,
    applyBuilding,
    removeBuilding,
    applyTileBiome,
    projectTile,
    setTutorialHighlights,
    setBuildHighlights,
    setInfluenceHighlights,
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", zoom);
      observer.disconnect();
      village.dispose();
      lumberCampKit.dispose();
      farmKit.dispose();
      quarryKit.dispose();
      fishingHutKit.dispose();
      houseKit.dispose();
      libraryKit.dispose();
      barracksKit.dispose();
      marketKit.dispose();
      sawmillKit.dispose();
      millKit.dispose();
      smelterKit.dispose();
      brickworksKit.dispose();
      clayMineKit.dispose();
      mineKit.dispose();
      forestDecor.dispose();
      plainsDecor.dispose();
      mountainDecor.dispose();
      mountainClouds.dispose();
      fusionDecor.dispose();
      shoreEdges.dispose();
      influenceBorder.dispose();
      waterDecor.dispose();
      fishBankDecor.dispose();
      cowHerdDecor.dispose();
      ironDepositDecor.dispose();
      clayDepositDecor.dispose();
      lakeDecor.dispose();
      deepWaterTexture.dispose();
      plainsGrassTexture.dispose();
      biomeGeometry.dispose();
      waterGeometry.dispose();
      emptyGeometry.dispose();
      plusGeometry.dispose();
      plusMaterial.dispose();
      plusTexture.dispose();
      fogKit.dispose();
      skyTexture.dispose();
      for (const tile of biomeTiles) {
        for (const material of tile.materials) material.dispose();
      }
      for (const mesh of [...emptyByKey.values(), ...emptyPool]) {
        const materials = mesh.material;
        if (Array.isArray(materials)) {
          for (const material of materials) material.dispose();
        }
      }
      renderer.dispose();
    }
  };

  return api;
}
