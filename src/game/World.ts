import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface WorldResult {
  scene: THREE.Scene;
  colliders: number;
}

export function createWorld(physics: RAPIER.World): WorldResult {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa7ad);
  scene.fog = new THREE.FogExp2(0x9aa7ad, 0.009);

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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(90, 0.25, 90).setTranslation(0, -0.25, 0));

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
  addBox(0, 1.3, -42, 84, 2.6, 1.2, wallMat);
  addBox(-42, 1.3, 0, 1.2, 2.6, 84, wallMat);
  addBox(42, 1.3, 0, 1.2, 2.6, 84, wallMat);
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

  const grid = new THREE.GridHelper(180, 90, 0x657173, 0x737c7d);
  grid.position.y = 0.012;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.12;
  }
  scene.add(grid);

  return { scene, colliders };
}
