import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { addArchitecturalDetail, addAtmosphericEffects, createConcreteTexture, createSkyDome } from './Graphics';

export interface WorldResult {
  scene: THREE.Scene;
  colliders: number;
}

export function createWorld(physics: RAPIER.World): WorldResult {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x9a9c96, 105, 235);
  createSkyDome(scene);

  const hemi = new THREE.HemisphereLight(0xdce8ee, 0x303b3b, 1.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffdfb5, 3.2);
  sun.position.set(-35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -92;
  sun.shadow.camera.right = 92;
  sun.shadow.camera.top = 92;
  sun.shadow.camera.bottom = -92;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const concreteTexture = createConcreteTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x9b9d98, map: concreteTexture, bumpMap: concreteTexture,
    bumpScale: 0.035, roughness: 0.96, metalness: 0.02
  });
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

  // Sector-specific objective landmarks: illuminated rings, numbered pylons and painted approach pads.
  const objectiveColors = [0x79d6e8, 0xd9b879, 0x91d8a5];
  const sectors = [{ x: -34, z: -12 }, { x: 34, z: -12 }, { x: 0, z: 48 }];
  sectors.forEach((sector, index) => {
    const color = objectiveColors[index];
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.08, 40),
      new THREE.MeshStandardMaterial({ color: 0x343e42, roughness: 0.92, metalness: 0.18 }));
    pad.position.set(sector.x, 0.05, sector.z); pad.receiveShadow = true; scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.085, 8, 48),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.15, metalness: 0.35, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(sector.x, 0.16, sector.z); scene.add(ring);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 5.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x303a40, metalness: 0.72, roughness: 0.4 }));
    mast.position.set(sector.x, 2.9, sector.z); mast.castShadow = true; scene.add(mast);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
    beacon.position.set(sector.x, 5.95, sector.z); scene.add(beacon);
    const sectorLight = new THREE.PointLight(color, 5, 13, 2);
    sectorLight.position.set(sector.x, 3.2, sector.z); scene.add(sectorLight);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8, 0.018, 0.22),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    stripe.position.set(sector.x, 0.11, sector.z + 5.2); scene.add(stripe);
  });

  // Service roads, road dashes and utility cabinets establish the scale of the complex.
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343c40, roughness: 0.96 });
  const roadEdge = new THREE.MeshStandardMaterial({ color: 0x9d9a88, roughness: 0.9 });
  for (const z of [-46, 46]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(116, 0.035, 7), asphalt);
    road.position.set(0, 0.025, z); road.receiveShadow = true; scene.add(road);
    for (const x of [-54, -36, -18, 0, 18, 36, 54]) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.012, 0.12), roadEdge);
      dash.position.set(x, 0.05, z); scene.add(dash);
    }
  }
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x46545a, metalness: 0.62, roughness: 0.48 });
  for (const [x, z] of [[-61, -30], [61, -30], [-61, 30], [61, 30]] as const) {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.7), cabinetMat);
    cabinet.position.set(x, 0.9, z); cabinet.castShadow = true; scene.add(cabinet);
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x8bd7e8, emissive: 0x267d91, emissiveIntensity: 1.4 }));
    indicator.position.set(x, 1.35, z - 0.36); scene.add(indicator);
  }

  addArchitecturalDetail(scene);
  addAtmosphericEffects(scene);

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
