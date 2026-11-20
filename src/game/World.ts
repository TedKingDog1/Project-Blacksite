import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface WorldResult {
  scene: THREE.Scene;
  colliders: number;
}

export function createWorld(physics: RAPIER.World): WorldResult {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa7ad);
  scene.fog = new THREE.FogExp2(0x9aa7ad, 0.0045);

  const hemi = new THREE.HemisphereLight(0xdce8ee, 0x303b3b, 2.0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe5bf, 3.0);
  sun.position.set(-35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x626b6d, roughness: 0.94 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(120, 0.25, 120).setTranslation(0, -0.25, 0));

  const lineMat = new THREE.MeshStandardMaterial({ color: 0xc2b89d, roughness: 0.85 });
  for (let i = -4; i <= 4; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 24), lineMat);
    stripe.position.set(i * 5, 0.008, -8);
    scene.add(stripe);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x737d80, roughness: 0.88 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x39464b, roughness: 0.82, metalness: 0.25 });
  const containerMat = new THREE.MeshStandardMaterial({ color: 0x596b69, roughness: 0.78, metalness: 0.2 });

  let colliders = 1;
  const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, y, z)
    );
    colliders++;
  };

  // Low cover, perimeter barriers, and inert industrial scenery.
  addBox(0, 2, -72, 145, 4, 1.2, wallMat);
  addBox(-72, 2, 0, 1.2, 4, 145, wallMat);
  addBox(72, 2, 0, 1.2, 4, 145, wallMat);
  addBox(0, 2, 72, 145, 4, 1.2, wallMat);
  addBox(-18, 0.65, -8, 8, 1.3, 2.2, darkMat);
  addBox(18, 0.65, -8, 8, 1.3, 2.2, darkMat);
  addBox(-23, 1.4, 19, 12, 2.8, 3.2, containerMat);
  addBox(22, 1.4, 20, 12, 2.8, 3.2, containerMat);
  addBox(0, 0.7, 29, 15, 1.4, 2.4, wallMat);
  addBox(-9, 0.55, 5, 2.4, 1.1, 2.4, darkMat);
  addBox(10, 0.55, 9, 2.4, 1.1, 2.4, darkMat);

  // Simple modular industrial buildings around the training yard.
  addBox(-30, 3, -25, 12, 6, 10, wallMat);
  addBox(30, 3, -25, 12, 6, 10, wallMat);
  addBox(-30, 6.1, -25, 12.4, 0.3, 10.4, darkMat);
  addBox(30, 6.1, -25, 12.4, 0.3, 10.4, darkMat);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30383b, metalness: 0.65, roughness: 0.45 });
  for (const [x, z] of [[-37, -35], [37, -35], [-37, 35], [37, 35]] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 10), poleMat);
    pole.position.set(x, 4, z);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.PointLight(0xffd9a0, 18, 18, 2);
    lamp.position.set(x, 7.4, z);
    scene.add(lamp);
  }


  // Outer service yards: low buildings, loading bays, and additional cover.
  addBox(-53, 2.8, -48, 18, 5.6, 14, wallMat);
  addBox(-53, 5.7, -48, 18.5, 0.35, 14.5, darkMat);
  addBox(53, 2.8, -48, 18, 5.6, 14, wallMat);
  addBox(53, 5.7, -48, 18.5, 0.35, 14.5, darkMat);
  addBox(-52, 0.8, 42, 13, 1.6, 3, containerMat);
  addBox(-37, 0.8, 48, 11, 1.6, 3, darkMat);
  addBox(49, 0.8, 43, 14, 1.6, 3, containerMat);
  addBox(34, 0.8, 49, 11, 1.6, 3, darkMat);
  addBox(0, 1.1, -56, 22, 2.2, 2.4, darkMat);
  addBox(-12, 0.65, 36, 3, 1.3, 3, darkMat);
  addBox(13, 0.65, 39, 3, 1.3, 3, darkMat);
  addBox(-39, 0.65, -4, 3, 1.3, 8, containerMat);
  addBox(40, 0.65, -2, 3, 1.3, 8, containerMat);

  // Painted service-lane markings and compact non-colliding surface details.
  const markingMat = new THREE.MeshStandardMaterial({ color: 0xb5a77f, roughness: 0.9 });
  for (const z of [-62, -32, 0, 32, 62]) {
    const marking = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 5), markingMat);
    marking.position.set(0, 0.018, z);
    scene.add(marking);
  }
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc5a56a, roughness: 0.85 });
  for (const x of [-62, -48, 48, 62]) {
    for (const z of [-18, 18]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4, 0.018, 0.16), stripeMat);
      stripe.position.set(x, 0.02, z);
      scene.add(stripe);
    }
  }

  // Repeated ventilation units and rooftop details add silhouette without heavy geometry.
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.55, roughness: 0.65 });
  const ventTopMat = new THREE.MeshStandardMaterial({ color: 0x879195, metalness: 0.45, roughness: 0.55 });
  for (const [x, z] of [[-30, -25], [30, -25], [-53, -48], [53, -48]] as const) {
    for (let i = -1; i <= 1; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 1.1), ventMat);
      vent.position.set(x + i * 3, 6.48, z);
      vent.castShadow = true;
      scene.add(vent);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 1.25), ventTopMat);
      cap.position.set(x + i * 3, 6.91, z);
      scene.add(cap);
    }
  }

  // Tall wayfinding pylons mark the training sectors.
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x303b40, metalness: 0.65, roughness: 0.4 });
  const pylonLightMat = new THREE.MeshStandardMaterial({ color: 0x8bd7e8, emissive: 0x267d91, emissiveIntensity: 1.8 });
  for (const [x, z] of [[-63, -5], [63, -5], [-5, -63], [5, 63]] as const) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.5, 0.55), pylonMat);
    pylon.position.set(x, 2.25, z);
    pylon.castShadow = true;
    scene.add(pylon);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), pylonLightMat);
    beacon.position.set(x, 4.2, z);
    scene.add(beacon);
  }

  const grid = new THREE.GridHelper(240, 120, 0x657173, 0x737c7d);
  grid.position.y = 0.012;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.12;
  }
  scene.add(grid);

  return { scene, colliders };
}
