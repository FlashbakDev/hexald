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

/** Bibliothèque low-poly : bâtiment pierre + toit + livres. */
export function createLibraryMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const stone = new MeshStandardMaterial({
    color: 0xc8c2b4,
    roughness: 0.92,
    metalness: 0.04
  });
  const timber = new MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.88,
    metalness: 0
  });
  const roof = new MeshStandardMaterial({
    color: 0x5c4030,
    roughness: 0.9,
    metalness: 0.02
  });
  const bookRed = new MeshStandardMaterial({
    color: 0x8b3a3a,
    roughness: 0.85,
    metalness: 0.05
  });
  const bookBlue = new MeshStandardMaterial({
    color: 0x3a5a8b,
    roughness: 0.85,
    metalness: 0.05
  });
  const earth = new MeshStandardMaterial({
    color: 0x6b8f4e,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(stone, timber, roof, bookRed, bookBlue, earth);

  const yardGeom = new CylinderGeometry(0.4, 0.4, 0.014, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.007;
  group.add(yard);

  const wallGeom = new BoxGeometry(0.34, 0.22, 0.26);
  geometries.push(wallGeom);
  const walls = new Mesh(wallGeom, stone);
  walls.position.set(0, 0.11, 0);
  group.add(walls);

  const doorGeom = new BoxGeometry(0.08, 0.12, 0.02);
  geometries.push(doorGeom);
  const door = new Mesh(doorGeom, timber);
  door.position.set(0, 0.08, 0.14);
  group.add(door);

  const roofGeom = new ConeGeometry(0.28, 0.14, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(0, 0.28, 0);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const bookGeom = new BoxGeometry(0.03, 0.07, 0.05);
  geometries.push(bookGeom);
  const colors = [bookRed, bookBlue, bookRed];
  for (let i = 0; i < 3; i++) {
    const book = new Mesh(bookGeom, colors[i]!);
    book.position.set(0.14, 0.05 + i * 0.01, -0.12 + i * 0.03);
    book.rotation.y = 0.2 * i;
    group.add(book);
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
