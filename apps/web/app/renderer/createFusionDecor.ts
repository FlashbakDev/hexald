import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";
import type { FusionBiomeId } from "@hexald/shared";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function tileHash(q: number, r: number, salt = 0) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return n >>> 0;
}

const EDGE_SPOTS: readonly { x: number; z: number }[] = [
  { x: -0.28, z: 0.18 },
  { x: 0.26, z: -0.2 },
  { x: 0.12, z: 0.3 },
  { x: -0.2, z: -0.28 },
  { x: 0.32, z: 0.1 },
  { x: -0.08, z: 0.04 }
];

/**
 * Décor léger des fusions — lisible sans rivaliser avec forêt / montagne pleines.
 * Lisière · Piémont · Haute forêt.
 */
export function createFusionDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const trunk = new MeshStandardMaterial({
    color: 0x6a4528,
    roughness: 0.93,
    metalness: 0.01
  });
  const foliage = new MeshStandardMaterial({
    color: 0x4a9a55,
    roughness: 0.85,
    metalness: 0.02
  });
  const foliageSoft = new MeshStandardMaterial({
    color: 0x6aad58,
    roughness: 0.86,
    metalness: 0.02
  });
  const grassA = new MeshStandardMaterial({
    color: 0x6aad4e,
    roughness: 0.9,
    metalness: 0
  });
  const grassB = new MeshStandardMaterial({
    color: 0x7fbe5c,
    roughness: 0.88,
    metalness: 0
  });
  const rock = new MeshStandardMaterial({
    color: 0x7a848e,
    roughness: 0.95,
    metalness: 0.03
  });
  const rockWarm = new MeshStandardMaterial({
    color: 0x8a7e6e,
    roughness: 0.94,
    metalness: 0.02
  });
  const rockDark = new MeshStandardMaterial({
    color: 0x5c6570,
    roughness: 0.97,
    metalness: 0.04
  });
  const rockLight = new MeshStandardMaterial({
    color: 0x9aa3ae,
    roughness: 0.9,
    metalness: 0.02
  });
  const plateauMoss = new MeshStandardMaterial({
    color: 0x6a8a58,
    roughness: 0.88,
    metalness: 0.02
  });
  const bush = new MeshStandardMaterial({
    color: 0x4a8a48,
    roughness: 0.9,
    metalness: 0.01
  });
  materials.push(
    trunk,
    foliage,
    foliageSoft,
    grassA,
    grassB,
    rock,
    rockWarm,
    rockDark,
    rockLight,
    plateauMoss,
    bush
  );

  const trunkThin = new CylinderGeometry(0.016, 0.024, 0.1, 5);
  const leafMid = new ConeGeometry(0.1, 0.16, 6);
  const leafTip = new ConeGeometry(0.065, 0.12, 5);
  const leafRound = new ConeGeometry(0.11, 0.14, 7);
  const bladeGeom = new ConeGeometry(0.026, 0.065, 4);
  const rockGeom = new CylinderGeometry(0.055, 0.07, 0.045, 5);
  const rockLow = new ConeGeometry(0.14, 0.1, 5);
  const bushGeom = new ConeGeometry(0.07, 0.08, 5);
  // Haute forêt : demi-massif + plateau
  const cliffBody = new ConeGeometry(0.42, 0.28, 6);
  const cliffBase = new CylinderGeometry(0.38, 0.44, 0.1, 6);
  const plateauTop = new CylinderGeometry(0.28, 0.32, 0.045, 6);
  const cliffFace = new ConeGeometry(0.22, 0.2, 5);
  geometries.push(
    trunkThin,
    leafMid,
    leafTip,
    leafRound,
    bladeGeom,
    rockGeom,
    rockLow,
    bushGeom,
    cliffBody,
    cliffBase,
    plateauTop,
    cliffFace
  );

  function addMesh(
    group: Group,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    group.add(mesh);
  }

  function sapling(group: Group, scale: number, yaw: number, soft: boolean) {
    const tree = new Group();
    tree.rotation.y = yaw;
    const leaf = soft ? foliageSoft : foliage;
    addMesh(tree, trunkThin, trunk, 0, 0.045 * scale, 0, scale, scale, scale, 0);
    addMesh(tree, leafMid, leaf, 0, 0.14 * scale, 0, scale * 0.9, scale * 0.95, scale * 0.9, 0.2);
    addMesh(tree, leafTip, leaf, 0, 0.22 * scale, 0, scale * 0.75, scale, scale * 0.75, 0.5);
    group.add(tree);
  }

  function smallBroadleaf(group: Group, scale: number, yaw: number) {
    const tree = new Group();
    tree.rotation.y = yaw;
    addMesh(tree, trunkThin, trunk, 0, 0.05 * scale, 0, scale * 1.05, scale, scale * 1.05, 0);
    addMesh(tree, leafRound, foliageSoft, 0, 0.16 * scale, 0, scale * 1.1, scale * 0.9, scale * 1.1, 0.15);
    addMesh(tree, leafTip, foliage, 0.02 * scale, 0.24 * scale, -0.015 * scale, scale * 0.7, scale * 0.85, scale * 0.7, 0.8);
    group.add(tree);
  }

  function grassTuft(group: Group, x: number, z: number, scale: number, yaw: number, dark: boolean) {
    const bunch = new Group();
    bunch.position.set(x, 0, z);
    bunch.rotation.y = yaw;
    const mat = dark ? grassA : grassB;
    const count = 2 + (dark ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      addMesh(
        bunch,
        bladeGeom,
        mat,
        (i - 1) * 0.02,
        0.03 * scale,
        (i % 2) * 0.016,
        scale * 0.85,
        scale,
        scale * 0.85,
        (i - 1) * 0.2
      );
    }
    group.add(bunch);
  }

  function placeGrass(group: Group, hash: number, count: number, start = 0) {
    for (let i = 0; i < count; i += 1) {
      const spot = EDGE_SPOTS[(hash + start + i * 2) % EDGE_SPOTS.length]!;
      const jx = (((hash >>> (i * 3)) & 7) / 7 - 0.5) * 0.07;
      const jz = (((hash >>> (i * 3 + 2)) & 7) / 7 - 0.5) * 0.07;
      const scale = 0.7 + (((hash >>> (i + 1)) & 3) / 3) * 0.35;
      const yaw = ((hash >>> (i * 4)) & 15) / 15 * Math.PI * 2;
      grassTuft(group, spot.x + jx, spot.z + jz, scale, yaw, ((hash >>> i) & 1) === 1);
    }
  }

  /** Lisière : herbe + 1–2 jeunes arbres. */
  function forestPlains(q: number, r: number) {
    const hash = tileHash(q, r, 11);
    const group = new Group();
    placeGrass(group, hash, 2 + (hash % 2));

    const treeCount = 1 + ((hash >>> 4) % 2);
    for (let i = 0; i < treeCount; i += 1) {
      const spot = EDGE_SPOTS[(hash + 3 + i * 2) % EDGE_SPOTS.length]!;
      const scale = 0.75 + ((hash >>> (i + 2)) & 3) * 0.08;
      const yaw = ((hash >>> (i * 5)) & 15) / 15 * Math.PI * 2;
      if (((hash >>> i) & 1) === 0) sapling(group, scale, yaw, true);
      else smallBroadleaf(group, scale * 0.95, yaw);
      const last = group.children[group.children.length - 1] as Group;
      last.position.set(spot.x * 0.85, 0, spot.z * 0.85);
    }

    if (((hash >>> 8) & 1) === 1) {
      const spot = EDGE_SPOTS[(hash + 5) % EDGE_SPOTS.length]!;
      addMesh(group, bushGeom, bush, spot.x * 0.7, 0.035, spot.z * 0.7, 0.9, 0.85, 0.9, hash * 0.01);
    }

    return group;
  }

  /** Piémont : collines basses + herbe, pas de massif. */
  function plainsMountain(q: number, r: number) {
    const hash = tileHash(q, r, 29);
    const h1 = tileHash(q, r, 71);
    const group = new Group();

    const moundCount = 1 + (hash % 2);
    for (let i = 0; i < moundCount; i += 1) {
      const ang = ((hash + i * 2.4) % (Math.PI * 2));
      const dist = 0.12 + ((h1 >>> (i * 2)) % 4) * 0.05;
      const mat = ((hash >>> i) & 1) === 1 ? rockWarm : rock;
      addMesh(
        group,
        rockLow,
        mat,
        Math.cos(ang) * dist,
        0.04,
        Math.sin(ang) * dist,
        0.85 + (i % 2) * 0.2,
        0.7 + ((h1 >>> i) & 3) * 0.1,
        0.85 + (i % 2) * 0.15,
        ang
      );
    }

    // Petit rocher satellite
    if (((h1 >>> 3) & 1) === 1) {
      const ang = ((h1 * 0.7) % (Math.PI * 2));
      addMesh(
        group,
        rockGeom,
        rock,
        Math.cos(ang) * 0.3,
        0.02,
        Math.sin(ang) * 0.3,
        1,
        0.9,
        1.1,
        ang
      );
    }

    placeGrass(group, hash, 2 + (h1 % 2), 1);
    return group;
  }

  /**
   * Haute forêt : demi-montagne (falaise d’un côté) + plateau moussu + quelques arbres.
   * Lecture claire forêt ∩ montagne, sans le massif entier.
   */
  function forestMountain(q: number, r: number) {
    const hash = tileHash(q, r, 53);
    const h1 = tileHash(q, r, 101);
    const group = new Group();

    // Orientation du massif : une moitié de l’hex
    const yaw = ((hash % 6) * Math.PI) / 3;
    const ox = Math.cos(yaw) * 0.22;
    const oz = Math.sin(yaw) * 0.22;
    const plateauY = 0.22;

    const massif = new Group();
    massif.position.set(ox, 0, oz);
    massif.rotation.y = yaw;

    // Socle rocheux bas
    addMesh(massif, cliffBase, rockDark, 0, 0.05, 0, 1, 1, 1.05, 0);
    // Corps en demi-cône (aplati côté plateau)
    addMesh(massif, cliffBody, rock, 0.02, 0.14, 0, 1.05, 1.05, 0.85, 0.15);
    // Face de falaise côté extérieur
    addMesh(massif, cliffFace, rockLight, 0.18, 0.12, 0.02, 0.95, 1.1, 0.75, 0.4);
    // Petit éperon
    addMesh(massif, rockLow, rockDark, -0.12, 0.06, 0.14, 0.7, 0.85, 0.65, 1.1);

    // Plateau plat moussu au sommet
    addMesh(massif, plateauTop, plateauMoss, -0.02, plateauY, -0.02, 1.05, 1, 1.05, 0.2);
    // Liseré rocheux du plateau
    addMesh(massif, plateauTop, rockLight, -0.02, plateauY - 0.02, -0.02, 1.12, 0.55, 1.12, 0.5);

    group.add(massif);

    // Arbres sur le plateau (2–3 pins / pousses)
    const treeCount = 2 + (h1 % 2);
    const plateauSpots: readonly { x: number; z: number; scale: number }[] = [
      { x: -0.08, z: -0.06, scale: 0.72 },
      { x: 0.1, z: 0.04, scale: 0.58 },
      { x: -0.02, z: 0.12, scale: 0.5 },
      { x: 0.06, z: -0.1, scale: 0.55 }
    ];
    for (let i = 0; i < treeCount; i += 1) {
      const spot = plateauSpots[(hash + i * 2) % plateauSpots.length]!;
      const scale = spot.scale * (0.95 + ((h1 >>> i) & 3) * 0.05);
      const treeYaw = ((hash >>> (i * 3)) & 15) / 15 * Math.PI * 2;
      const pine = new Group();
      pine.rotation.y = treeYaw;
      // Position locale massif → monde
      const lx = spot.x;
      const lz = spot.z;
      const wx = ox + Math.cos(yaw) * lx - Math.sin(yaw) * lz;
      const wz = oz + Math.sin(yaw) * lx + Math.cos(yaw) * lz;
      pine.position.set(wx, plateauY + 0.02, wz);
      addMesh(pine, trunkThin, trunk, 0, 0.05 * scale, 0, scale * 1.1, scale * 1.15, scale * 1.1, 0);
      addMesh(pine, leafMid, foliage, 0, 0.16 * scale, 0, scale * 1.05, scale, scale * 1.05, 0.2);
      addMesh(pine, leafTip, foliage, 0, 0.26 * scale, 0, scale * 0.85, scale, scale * 0.85, 0.5);
      group.add(pine);
    }

    // Un arbre / buisson au pied, côté forêt (opposé au massif)
    const footX = -ox * 0.85;
    const footZ = -oz * 0.85;
    if (((hash >>> 5) & 1) === 0) {
      sapling(group, 0.7, yaw + Math.PI * 0.3, true);
      const last = group.children[group.children.length - 1] as Group;
      last.position.set(footX, 0, footZ);
    } else {
      addMesh(group, bushGeom, bush, footX, 0.035, footZ, 1.05, 0.95, 1.05, yaw);
    }

    // Petit rocher au pied de la falaise
    addMesh(
      group,
      rockGeom,
      rock,
      ox + Math.cos(yaw) * 0.28,
      0.02,
      oz + Math.sin(yaw) * 0.28,
      1.15,
      1,
      1.25,
      yaw + 0.4
    );

    return group;
  }

  function createForTile(q: number, r: number, biome: FusionBiomeId) {
    if (biome === "forest_plains") return forestPlains(q, r);
    if (biome === "plains_mountain") return plainsMountain(q, r);
    return forestMountain(q, r);
  }

  return {
    createForTile,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
