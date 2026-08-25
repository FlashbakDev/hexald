import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
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
  generateRegionTiles
} from "@hexald/game-core";
import { createForestDecorKit } from "./createForestDecor";
import { createFogCloudKit, FOG_CLOUD_LIFT } from "./createFogCloudKit";
import { createFarmMesh } from "./createFarmMesh";
import { createLumberCampMesh } from "./createLumberCampMesh";
import { createQuarryMesh } from "./createQuarryMesh";
import {
  createMountainDecorKit,
  mountainChainDirs
} from "./createMountainDecor";
import { createPlainsDecorKit } from "./createPlainsDecor";
import {
  createShoreEdgeDecorKit,
  shoreKindForBiome
} from "./createShoreEdgeDecor";
import { createWaterDecorKit, createDeepWaterSurfaceTexture, isLandBiome, paintWaterMaterials } from "./createWaterDecor";
import { createVillageMesh } from "./createVillageMesh";

const HEX_SIZE = 1;
const HEX_HEIGHT = 0.28;
/** Mer pure : plus basse que la terre / les côtes (lisibilité). */
const WATER_HEIGHT = 0.12;
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

const biomePalette: Record<BiomeId, { top: number; side: number }> = {
  forest: { top: 0x62c46f, side: 0x2a7040 },
  plains: { top: 0x8fce6e, side: 0x4a8a3a },
  mountain: { top: 0xd0d7e2, side: 0x6b7586 },
  water: { top: 0x62bfe8, side: 0x2f86b5 },
  forest_plains: { top: 0xa8c45e, side: 0x6a8a38 },
  plains_mountain: { top: 0xc4b894, side: 0x8a7a5c },
  forest_mountain: { top: 0x7a9a7e, side: 0x4a6050 }
};

const emptyPalette = { top: 0xd8e2da, side: 0x66756c };
const revealFootprintPalette = { top: 0xc5d4a8, side: 0x6a7a55 };

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
  isRegionCenter: boolean;
  decor: Group | null;
  buildingMesh: Group | null;
  spawn: HexSpawnAnim | null;
  /** Tuile vierge conservée sous l’anim jusqu’à la fin du spawn. */
  pendingEmpty: Mesh | null;
};

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
  return biome === "forest" || biome === "forest_mountain";
}

function isPlainsDecorBiome(biome: BiomeId) {
  return biome === "plains";
}

function isMountainDecorBiome(biome: BiomeId) {
  return biome === "mountain" || biome === "plains_mountain";
}

function tileMeshHeight(biome: BiomeId) {
  return biome === "water" ? WATER_HEIGHT : HEX_HEIGHT;
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
  /** Projette le centre d’une tuile (au-dessus du bâtiment) en coords canvas. */
  projectTile: (q: number, r: number) => HexScreenPoint | null;
};

export type HexSceneFraming = {
  /** Orthographic half-extent; larger = more zoomed out. */
  viewSize?: number;
  /**
   * 0 = look target centered.
   * Positive shifts the look target toward the top of the screen (0–0.7).
   */
  frameBiasY?: number;
};

export type HexSceneOptions = {
  onSelect?: (tile: SelectedTile | null) => void;
  /** Monde persisté ; sinon région de départ locale. */
  initialWorld?: {
    tiles: readonly WorldTileSnapshot[];
    regions: readonly WorldRegionSnapshot[];
  };
} & HexSceneFraming;

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
  top: number,
  side: number,
  variation: number
) {
  materials[0].color.setHex(side).offsetHSL(variation * 0.02, 0, variation * 0.05);
  materials[1].color.setHex(top).offsetHSL(variation * 0.03, variation * 0.05, variation * 0.04);
  materials[2].color.copy(materials[0].color);
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
  materials[2].color.copy(materials[0].color);
}

function createMaterials(top: number, side: number, variation: number) {
  const materials = [
    new MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
    new MeshStandardMaterial({ roughness: 0.68, metalness: 0.05 }),
    new MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 })
  ];
  paintMaterials(materials, top, side, variation);
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
  ctx.fillStyle = "#f4faf0";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 110; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(55, 110, 40, ${0.035 + Math.random() * 0.05})`;
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

const EMPTY_GROUND = 0x8a9890;
const ORIGIN = new Vector3();

export function createHexScene(canvas: HTMLCanvasElement, options: HexSceneOptions = {}): HexSceneApi {
  const scene = new Scene();
  scene.background = new Color(EMPTY_GROUND);

  const lookTarget = new Vector3();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  const applyCamera = () => {
    camera.position.copy(lookTarget).add(CAMERA_OFFSET);
    camera.lookAt(lookTarget);
    // Requis pour unproject pendant le pan/pinch : sinon matrixWorld reste
    // stale entre deux frames et le grab-pan accélère (surtout Safari iOS).
    camera.updateMatrixWorld();
  };

  applyCamera();

  let viewSize = Math.min(
    VIEW_MAX,
    Math.max(VIEW_MIN, options.viewSize ?? VIEW_DEFAULT)
  );
  let frameBiasY = Math.min(0.7, Math.max(0, options.frameBiasY ?? 0));

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  scene.add(new HemisphereLight(0xf4efe4, 0x6d8a6a, 0.95));
  scene.add(new AmbientLight(0xf2efe6, 0.28));
  const sun = new DirectionalLight(0xfff1d2, 1.05);
  sun.position.set(4, 10, 2);
  scene.add(sun);

  const biomeGeometry = new CylinderGeometry(HEX_SIZE, HEX_SIZE, HEX_HEIGHT, 6);
  const waterGeometry = new CylinderGeometry(HEX_SIZE, HEX_SIZE, WATER_HEIGHT, 6);
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
  const forestDecor = createForestDecorKit();
  const plainsDecor = createPlainsDecorKit();
  const mountainDecor = createMountainDecorKit();
  const shoreEdges = createShoreEdgeDecorKit();
  const waterDecor = createWaterDecorKit();
  const deepWaterTexture = createDeepWaterSurfaceTexture();
  const plainsGrassTexture = createPlainsGrassTexture();
  const tilesByKey = new Map<string, HexTile>();

  const clearBiomeDecor = (tile: HexTile) => {
    if (!tile.decor) return;
    tile.mesh.remove(tile.decor);
    tile.decor = null;
  };

  const attachDecor = (tile: HexTile, decor: Group) => {
    decor.position.y = tileMeshHeight(tile.biome) / 2;
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
    if (tile.hasVillage || tile.buildingId) return;

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
    // Quartier / village / bâtiment : pas de décor d’origine.
    if (tile.hasVillage || tile.buildingId) {
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

    if (isForestDecorBiome(tile.biome)) {
      const density = tile.biome === "forest_mountain" ? "high" : "normal";
      group.add(forestDecor.createForTile(tile.q, tile.r, density));
      hasContent = true;
    } else if (isPlainsDecorBiome(tile.biome)) {
      group.add(plainsDecor.createForTile(tile.q, tile.r));
      hasContent = true;
    } else if (isMountainDecorBiome(tile.biome)) {
      const chainDirs = mountainChainDirs(tile.q, tile.r, (cell) => {
        const neighbor = biomesByKey.get(hexKey(cell.q, cell.r));
        return neighbor != null && isMountainDecorBiome(neighbor);
      });
      group.add(mountainDecor.createForTile({ q: tile.q, r: tile.r, chainDirs }));
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
            : null;
    if (!kit) return;
    const instance = kit.group.clone(true);
    instance.position.y = tileMeshHeight(tile.biome) / 2;
    tile.mesh.add(instance);
    tile.buildingMesh = instance;
  };

  const spawnBiomeTile = (
    q: number,
    r: number,
    biome: BiomeId,
    isRegionCenter: boolean,
    spawn: HexSpawnAnim | null = null,
    buildingId: BuildingId | null = null
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
    const materials = createMaterials(palette.top, palette.side, variation);
    if (biome === "plains") {
      materials[1].map = plainsGrassTexture;
      materials[1].roughness = 0.82;
      materials[1].needsUpdate = true;
    }
    if (biome === "water") {
      paintWaterMaterials(materials, 0, null);
    }
    const height = tileMeshHeight(biome);
    const mesh = new Mesh(biome === "water" ? waterGeometry : biomeGeometry, materials);
    const { x, z } = axialToWorld(q, r);
    const restY = height / 2;
    mesh.position.set(x, spawn ? restY - SPAWN_DEPTH : restY, z);
    mesh.userData.q = q;
    mesh.userData.r = r;
    scene.add(mesh);

    const tile: HexTile = {
      mesh,
      restY,
      materials,
      q,
      r,
      biome,
      hasVillage: q === 0 && r === 0,
      buildingId: q === 0 && r === 0 ? null : buildingId,
      isRegionCenter,
      decor: null,
      buildingMesh: null,
      spawn,
      pendingEmpty
    };
    biomeTiles.push(tile);
    tilesByMesh.set(mesh, tile);
    tilesByKey.set(key, tile);
    biomesByKey.set(key, biome);

    if (tile.hasVillage) {
      clearBiomeDecor(tile);
      mesh.add(village.group);
    } else if (tile.buildingId) {
      clearBiomeDecor(tile);
      attachBuildingMesh(tile, tile.buildingId);
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
            { biome: tile.biome, buildingId: (tile.buildingId ?? null) as BuildingId | null }
          ] as const)
        ),
        regions: options.initialWorld.regions.map((region) => ({
          center: { ...region.center },
          biome: region.biome
        }))
      }
    : {
        tiles: new Map(
          [...startingLocal.tiles.entries()].map(([key, biome]) => [
            key,
            { biome, buildingId: null as BuildingId | null }
          ])
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
    spawnBiomeTile(q!, r!, entry.biome, regionCenterKeys.has(key), null, entry.buildingId);
  }
  refreshAllWaterLooks();

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
    const materials = createMaterials(emptyPalette.top, emptyPalette.side, 0);
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

    // Brouillard de guerre : nuages sur les vierges hors zone découvrable.
    const fogKeys = new Set<string>();
    for (const [key, mesh] of emptyByKey) {
      if (!mesh.visible) continue;
      if (revealableFootprint.has(key)) continue;
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
    const bias = frameBiasY;
    camera.left = -viewSize * aspect;
    camera.right = viewSize * aspect;
    // Asymmetric frustum: look target sits higher on screen when bias > 0.
    camera.top = viewSize * (1 - bias);
    camera.bottom = -viewSize * (1 + bias);
    camera.updateProjectionMatrix();
  };

  const canvasSize = () => {
    const rect = canvas.getBoundingClientRect();
    return {
      rect,
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    };
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
   * True si du territoire constructible (ou connu) reste dans la moitié
   * centrale de l’écran — évite un viewport full nuages en panant trop loin.
   */
  const viewportHasConstructible = () => {
    const bounds = visibleGroundAabb(HEX_SIZE * 0.35, 0.5);
    if (revealableCenterWorld.length > 0) {
      for (const p of revealableCenterWorld) {
        if (pointInAabb(p.x, p.z, bounds)) return true;
      }
      return false;
    }
    // Plus rien à explorer : reste sur le territoire connu.
    for (const tile of biomeTiles) {
      if (pointInAabb(tile.mesh.position.x, tile.mesh.position.z, bounds)) return true;
    }
    return biomeTiles.length === 0;
  };

  /**
   * Si le lookTarget sort trop loin (plus de constructible au centre),
   * ramène le long du segment depuis (fromX, fromZ).
   */
  const clampLookTargetToConstructible = (fromX: number, fromZ: number) => {
    applyCamera();
    if (viewportHasConstructible()) return;

    const toX = lookTarget.x;
    const toZ = lookTarget.z;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) * 0.5;
      lookTarget.set(fromX + (toX - fromX) * mid, 0, fromZ + (toZ - fromZ) * mid);
      applyCamera();
      if (viewportHasConstructible()) lo = mid;
      else hi = mid;
    }
    lookTarget.set(fromX + (toX - fromX) * lo, 0, fromZ + (toZ - fromZ) * lo);
    applyCamera();
  };

  const pointInAabb = (x: number, z: number, bounds: Aabb) =>
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

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
      spawnBiomeTile(cell.q, cell.r, cell.biome, cell.q === center.q && cell.r === center.r, {
        t0,
        delayMs
      });
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
    const tile = tilesByKey.get(hexKey(q, r));
    if (!tile || tile.hasVillage || tile.buildingId) return false;
    tile.buildingId = buildingId;
    clearBiomeDecor(tile);
    attachBuildingMesh(tile, buildingId);
    viewDirty = true;
    hoverDirty = true;
    emitSelection(tile.mesh, biomePayload(tile));
    return true;
  };

  const projectScratch = new Vector3();
  const projectTile = (q: number, r: number): HexScreenPoint | null => {
    const { x, z } = axialToWorld(q, r);
    const tile = tilesByKey.get(hexKey(q, r));
    if (!tile) return null;
    const lift = 0.52;
    projectScratch.set(x, tile.restY + lift, z);
    projectScratch.project(camera);
    const { width, height } = canvasSize();
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
    for (const tile of biomeTiles) {
      const hoveredHere = tile.mesh === hoveredMesh;
      const selectedHere = tile.mesh === selectedMesh;
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
        const targetY = tile.restY + (hoveredHere ? HOVER_LIFT : selectedHere ? SELECT_LIFT : 0);
        tile.mesh.position.y += (targetY - tile.mesh.position.y) * 0.18;
      }

      if (hoveredHere) {
        setEmissive(tile.materials, 0.14, 0.115, 0.056);
      } else if (selectedHere) {
        setEmissive(tile.materials, 0.22, 0.16, 0.04);
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
      const inPreview = previewKeys.has(key);
      const isCenter = revealableCenters.has(key);
      const inHintFootprint = Boolean(hintFootprint?.has(key) && !isCenter && !biomesByKey.has(key));
      const revealLift = inHintFootprint ? REVEAL_FOOTPRINT_LIFT : 0;
      const targetY =
        emptyRestY +
        (hoveredHere && isCenter ? HOVER_LIFT : selectedHere && isCenter ? SELECT_LIFT : revealLift);
      mesh.position.y += (targetY - mesh.position.y) * 0.18;
      const materials = meshMaterials(mesh);

      if (hoveredHere && isCenter) {
        setEmissive(materials, 0.06, 0.07, 0.065);
      } else if (selectedHere && isCenter) {
        setEmissive(materials, 0.08, 0.09, 0.085);
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

    renderer.render(scene, camera);
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

  const api = {
    recenter,
    clearSelection,
    setFraming,
    generateRegion,
    applyRegion,
    applyBuilding,
    projectTile,
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
      forestDecor.dispose();
      plainsDecor.dispose();
      mountainDecor.dispose();
      shoreEdges.dispose();
      waterDecor.dispose();
      deepWaterTexture.dispose();
      plainsGrassTexture.dispose();
      biomeGeometry.dispose();
      waterGeometry.dispose();
      emptyGeometry.dispose();
      plusGeometry.dispose();
      plusMaterial.dispose();
      plusTexture.dispose();
      fogKit.dispose();
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
