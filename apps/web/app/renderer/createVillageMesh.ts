import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material
} from "three";

function house(
  x: number,
  z: number,
  yaw: number,
  scale: number,
  walls: MeshStandardMaterial,
  roof: MeshStandardMaterial,
  timber: MeshStandardMaterial,
  geometries: BufferGeometry[]
) {
  const group = new Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;

  const wallW = 0.2 * scale;
  const wallD = 0.16 * scale;
  const wallH = 0.15 * scale;
  const wallGeom = new BoxGeometry(wallW, wallH, wallD);
  geometries.push(wallGeom);
  const wall = new Mesh(wallGeom, walls);
  wall.position.y = wallH / 2;
  group.add(wall);

  const roofGeom = new ConeGeometry(0.155 * scale, 0.12 * scale, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.y = wallH + 0.055 * scale;
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const doorGeom = new BoxGeometry(0.045 * scale, 0.07 * scale, 0.02 * scale);
  geometries.push(doorGeom);
  const door = new Mesh(doorGeom, timber);
  door.position.set(0, 0.035 * scale, wallD / 2 + 0.005);
  group.add(door);

  return group;
}

type SmokePuff = {
  mesh: Mesh;
  phase: number;
  speed: number;
  drift: number;
};

/** Village de départ (QG) — cheminée avec fumée animée. */
export function createVillageMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const walls = new MeshStandardMaterial({
    color: 0xfff6e8,
    roughness: 0.86,
    metalness: 0.02
  });
  const roof = new MeshStandardMaterial({
    color: 0xf0725c,
    roughness: 0.78,
    metalness: 0.04
  });
  const timber = new MeshStandardMaterial({
    color: 0xa86a42,
    roughness: 0.9,
    metalness: 0
  });
  const stone = new MeshStandardMaterial({
    color: 0xb8c4d4,
    roughness: 0.92,
    metalness: 0.02
  });
  const earth = new MeshStandardMaterial({
    color: 0xecd4a0,
    roughness: 0.95,
    metalness: 0
  });
  const smokeMat = new MeshStandardMaterial({
    color: 0xf4f0ea,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  materials.push(walls, roof, timber, stone, earth, smokeMat);

  const yardGeom = new CylinderGeometry(0.58, 0.58, 0.018, 12);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.01;
  group.add(yard);

  group.add(house(-0.28, 0.16, 0.35, 0.92, walls, roof, timber, geometries));
  group.add(house(0.3, 0.1, -0.5, 0.85, walls, roof, timber, geometries));
  group.add(house(0.16, -0.26, 0.15, 0.78, walls, roof, timber, geometries));

  const hall = house(0.02, 0.02, 0.08, 1.22, walls, roof, timber, geometries);
  const chimneyGeom = new BoxGeometry(0.04, 0.1, 0.04);
  geometries.push(chimneyGeom);
  const chimney = new Mesh(chimneyGeom, stone);
  chimney.position.set(0.06, 0.3, -0.02);
  hall.add(chimney);

  const smoke: SmokePuff[] = [];
  const puffGeo = new SphereGeometry(0.028, 6, 5);
  geometries.push(puffGeo);
  for (let i = 0; i < 4; i++) {
    const puff = new Mesh(puffGeo, smokeMat.clone());
    materials.push(puff.material as Material);
    puff.position.set(0.06, 0.36, -0.02);
    puff.scale.setScalar(0.4);
    hall.add(puff);
    smoke.push({
      mesh: puff,
      phase: (i / 4) * Math.PI * 2,
      speed: 0.55 + i * 0.08,
      drift: 0.012 + i * 0.004
    });
  }
  group.add(hall);

  const wellGeom = new CylinderGeometry(0.055, 0.06, 0.07, 8);
  geometries.push(wellGeom);
  const well = new Mesh(wellGeom, stone);
  well.position.set(-0.18, 0.035, -0.22);
  group.add(well);

  const postGeom = new BoxGeometry(0.018, 0.08, 0.018);
  geometries.push(postGeom);
  const postA = new Mesh(postGeom, timber);
  postA.position.set(-0.18, 0.09, -0.22);
  const postB = postA.clone();
  postB.position.x += 0.05;
  group.add(postA, postB);

  const beamGeom = new BoxGeometry(0.07, 0.012, 0.012);
  geometries.push(beamGeom);
  const beam = new Mesh(beamGeom, timber);
  beam.position.set(-0.155, 0.125, -0.22);
  group.add(beam);

  const animate = (nowMs: number) => {
    const t = nowMs * 0.001;
    for (const puff of smoke) {
      // Cycle 0→1 de montée / dissipation.
      const cycle = ((t * puff.speed + puff.phase / (Math.PI * 2)) % 1 + 1) % 1;
      const rise = cycle;
      const fade = cycle < 0.15 ? cycle / 0.15 : cycle > 0.7 ? 1 - (cycle - 0.7) / 0.3 : 1;
      puff.mesh.position.set(
        0.06 + Math.sin(t * 0.9 + puff.phase) * puff.drift,
        0.36 + rise * 0.22,
        -0.02 + Math.cos(t * 0.7 + puff.phase) * puff.drift * 0.6
      );
      const s = 0.35 + rise * 1.1;
      puff.mesh.scale.setScalar(s);
      const mat = puff.mesh.material as MeshStandardMaterial;
      mat.opacity = 0.5 * fade * (1 - rise * 0.55);
      puff.mesh.visible = fade > 0.04;
    }
  };

  return {
    group,
    animate,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
