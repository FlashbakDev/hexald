import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
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

export function createVillageMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const walls = new MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.86, metalness: 0.02 });
  const roof = new MeshStandardMaterial({ color: 0xc24d38, roughness: 0.78, metalness: 0.04 });
  const timber = new MeshStandardMaterial({ color: 0x6a4324, roughness: 0.9, metalness: 0 });
  const stone = new MeshStandardMaterial({ color: 0x8d969c, roughness: 0.92, metalness: 0.02 });
  const earth = new MeshStandardMaterial({ color: 0xc4a574, roughness: 0.95, metalness: 0 });
  materials.push(walls, roof, timber, stone, earth);

  const yardGeom = new CylinderGeometry(0.58, 0.58, 0.018, 12);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.01;
  group.add(yard);

  group.add(house(-0.28, 0.16, 0.35, 0.92, walls, roof, timber, geometries));
  group.add(house(0.3, 0.1, -0.5, 0.85, walls, roof, timber, geometries));
  group.add(house(0.16, -0.26, 0.15, 0.78, walls, roof, timber, geometries));

  const hall = house(0.02, 0.02, 0.08, 1.22, walls, roof, timber, geometries);
  const chimneyGeom = new BoxGeometry(0.04, 0.08, 0.04);
  geometries.push(chimneyGeom);
  const chimney = new Mesh(chimneyGeom, stone);
  chimney.position.set(0.06, 0.28, -0.02);
  hall.add(chimney);
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

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
