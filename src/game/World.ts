import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { addAtmosphericEffects, createSkyDome } from './Graphics';

export interface WorldResult {
  scene: THREE.Scene;
  colliders: number;
}

function makeGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas texture generation is unavailable.');
  ctx.fillStyle = '#526344';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 12731;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 18000; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const length = 1 + random() * 5;
    ctx.strokeStyle = random() > 0.52
      ? 'rgba(157,163,105,0.30)'
      : 'rgba(28,43,27,0.32)';
    ctx.lineWidth = 0.6 + random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 2, y - length);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(90,67,43,0.18)' : 'rgba(190,177,127,0.12)';
    ctx.beginPath();
    ctx.arc(random() * 512, random() * 512, 0.5 + random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(38, 38);
  texture.anisotropy = 4;
  return texture;
}

export function createWorld(physics: RAPIER.World): WorldResult {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x9b9b91, 125, 285);
  createSkyDome(scene);

  const hemi = new THREE.HemisphereLight(0xdce2df, 0x394333, 1.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffdfbd, 2.65);
  sun.position.set(-42, 68, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -105;
  sun.shadow.camera.right = 105;
  sun.shadow.camera.top = 105;
  sun.shadow.camera.bottom = -105;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const grassTexture = makeGrassTexture();
  const grass = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: grassTexture, roughness: 1, metalness: 0
  });
  const earth = new THREE.MeshStandardMaterial({ color: 0x65533b, roughness: 1 });
  const mud = new THREE.MeshStandardMaterial({ color: 0x493d30, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x777568, roughness: 0.98 });
  const weatheredWood = new THREE.MeshStandardMaterial({ color: 0x574532, roughness: 0.95 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xb2a58b, roughness: 0.96 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x45413b, roughness: 0.95 });
  const olive = new THREE.MeshStandardMaterial({ color: 0x4a503b, roughness: 0.9 });
  const sandbag = new THREE.MeshStandardMaterial({ color: 0x9a8968, roughness: 1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x343a37, metalness: 0.38, roughness: 0.78 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(150, 0.25, 150).setTranslation(0, -0.25, 0));

  let colliders = 1;
  const addBox = (
    x: number, y: number, z: number, sx: number, sy: number, sz: number,
    material: THREE.Material, collision = true
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collision) {
      physics.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, y, z));
      colliders++;
    }
    return mesh;
  };

  const addHill = (x: number, z: number, sx: number, sy: number, sz: number, color: number): void => {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
    );
    hill.position.set(x, sy * 0.42 - 1.2, z);
    hill.scale.set(sx, sy, sz);
    hill.receiveShadow = true;
    hill.castShadow = true;
    scene.add(hill);
  };

  // Rolling countryside frames the playable valley. The central ground stays level
  // so the visual terrain never disagrees with the player's physics collider.
  [
    [-112, -112, 46, 25, 35, 0x68745a], [-48, -125, 52, 22, 30, 0x7b8060],
    [35, -126, 56, 30, 34, 0x687458], [112, -105, 45, 26, 42, 0x74795a],
    [-128, -22, 38, 24, 48, 0x727b5c], [128, -12, 42, 28, 50, 0x667252],
    [-120, 96, 55, 28, 38, 0x777d5c], [-45, 128, 50, 25, 34, 0x6d7858],
    [45, 130, 48, 27, 38, 0x7c8060], [118, 100, 52, 30, 42, 0x687455]
  ].forEach(h => addHill(h[0], h[1], h[2], h[3], h[4], h[5]));

  // Irregular dirt tracks across the valley, connecting the three mission areas.
  const addTrack = (points: THREE.Vector3[], width: number): void => {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const length = a.distanceTo(b);
      const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, length), earth);
      segment.position.set(mid.x, 0.018, mid.z);
      segment.rotation.y = -Math.atan2(b.x - a.x, b.z - a.z);
      segment.receiveShadow = true;
      scene.add(segment);
      const rut = new THREE.Mesh(new THREE.BoxGeometry(width * 0.12, 0.012, length * 0.96), mud);
      rut.position.set(mid.x - width * 0.25, 0.042, mid.z);
      rut.rotation.y = segment.rotation.y;
      scene.add(rut);
      const rut2 = rut.clone();
      rut2.position.x = mid.x + width * 0.25;
      scene.add(rut2);
    }
  };
  addTrack([
    new THREE.Vector3(-95, 0, 20), new THREE.Vector3(-66, 0, 12),
    new THREE.Vector3(-42, 0, -4), new THREE.Vector3(-18, 0, 2),
    new THREE.Vector3(10, 0, 15), new THREE.Vector3(39, 0, 20),
    new THREE.Vector3(70, 0, 8), new THREE.Vector3(98, 0, -12)
  ], 7.5);
  addTrack([
    new THREE.Vector3(-10, 0, -90), new THREE.Vector3(-7, 0, -58),
    new THREE.Vector3(0, 0, -28), new THREE.Vector3(8, 0, 4),
    new THREE.Vector3(0, 0, 38), new THREE.Vector3(-8, 0, 68),
    new THREE.Vector3(-12, 0, 96)
  ], 6);

  // Farmhouses and outbuildings, placed around the perimeter of the playable valley.
  const addHouse = (x: number, z: number, scale = 1, ruined = false): void => {
    const w = 11 * scale, h = 5.2 * scale, d = 8 * scale;
    addBox(x, h / 2, z, w, h, d, ruined ? stone : plaster);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 3.4 * scale, 4), roofMat);
    roof.position.set(x, h + 1.55 * scale, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = d / w;
    roof.castShadow = true;
    scene.add(roof);
    // Dark window recesses and a simple timber door.
    for (const side of [-1, 1]) {
      addBox(x + side * 2.8 * scale, 2.8 * scale, z - d / 2 - 0.035, 1.15 * scale, 1.35 * scale, 0.08, darkMetal, false);
    }
    addBox(x, 1.15 * scale, z + d / 2 + 0.045, 1.25 * scale, 2.3 * scale, 0.12, weatheredWood, false);
    if (ruined) {
      const rubble = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 * scale, 0), stone);
      rubble.position.set(x - 5 * scale, 0.55 * scale, z + 3 * scale);
      rubble.scale.set(2.2, 0.65, 1.3);
      rubble.rotation.y = 0.5;
      rubble.castShadow = true;
      scene.add(rubble);
    }
  };
  addHouse(-55, -48, 1.15, true);
  addHouse(55, -53, 1.05, false);
  addHouse(-65, 55, 0.92, false);
  addHouse(65, 58, 1.2, true);

  // A low stone farm wall, broken into sections with gaps for traversal.
  for (const [x, z, length, angle] of [
    [-56, -20, 24, 0], [-56, 2, 17, 0], [55, -18, 27, 0],
    [55, 8, 18, 0], [-30, 66, 26, Math.PI / 2], [28, 66, 22, Math.PI / 2]
  ] as const) {
    const wall = addBox(x, 0.72, z, length, 1.35, 0.75, stone);
    wall.rotation.y = angle;
  }

  // Shallow trench lines with timber revetments and sandbagged lips.
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x403a2d, roughness: 1 });
  for (const [x, z, length, angle] of [[-12, -40, 34, 0.12], [28, 35, 28, -0.22], [-58, 25, 22, 0.3]] as const) {
    const cut = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, length), trenchMat);
    cut.position.set(x, 0.025, z);
    cut.rotation.y = angle;
    scene.add(cut);
    for (let i = -length / 2; i <= length / 2; i += 2.5) {
      const px = x + Math.sin(angle) * i;
      const pz = z + Math.cos(angle) * i;
      const timber = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 1.8), weatheredWood);
      timber.position.set(px - 1.25, 0.42, pz);
      timber.rotation.y = angle;
      timber.castShadow = true;
      scene.add(timber);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.48, 0.72), sandbag);
      bag.position.set(px + 1.15, 0.28, pz);
      bag.rotation.y = angle + (i % 5) * 0.025;
      bag.castShadow = true;
      scene.add(bag);
    }
  }

  // Small sandbag positions, field crates, and wooden observation posts.
  for (const [x, z, count, angle] of [[-23, 18, 5, 0.3], [22, 27, 6, -0.4], [48, -4, 4, 1.1], [-48, 8, 4, -0.8]] as const) {
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.48, 0.72), sandbag);
      bag.position.set(x + Math.cos(angle) * i * 1.05, 0.28, z + Math.sin(angle) * i * 1.05);
      bag.rotation.y = angle;
      bag.castShadow = true;
      scene.add(bag);
    }
  }
  for (const [x, z] of [[-43, -35], [44, -36], [-45, 48], [43, 48]] as const) {
    addBox(x, 0.65, z, 2.1, 1.3, 1.6, weatheredWood);
    const lid = addBox(x, 1.34, z, 2.2, 0.12, 1.7, olive, false);
  }

  // Shell craters: flattened earthen bowls and dark, muddy centers.
  const craterRim = new THREE.MeshStandardMaterial({ color: 0x5b513d, roughness: 1 });
  for (const [x, z, radius] of [[-46, -2, 3.4], [45, 4, 4.1], [-4, -65, 3.2], [15, 61, 3.7], [70, -25, 2.8], [-72, 37, 3.1]] as const) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.8, 7, 22), craterRim);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.14, z);
    rim.scale.set(1.35, 1, 0.78);
    rim.receiveShadow = true;
    scene.add(rim);
    const center = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.78, 20), mud);
    center.rotation.x = -Math.PI / 2;
    center.position.set(x, 0.04, z);
    center.scale.set(1.35, 0.78, 1);
    scene.add(center);
  }

  // Low-poly trees along the field edges, leaving the center and objectives readable.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x51402e, roughness: 1 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x354a32, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x46583a, roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x596342, roughness: 1, flatShading: true })
  ];
  let treeSeed = 731;
  const rand = (): number => {
    treeSeed = (treeSeed * 1103515245 + 12345) & 0x7fffffff;
    return treeSeed / 0x80000000;
  };
  const treePositions: Array<[number, number]> = [];
  for (const [cx, cz] of [[-92, -42], [92, -45], [-94, 62], [94, 70], [-20, -100], [34, -103]] as const) {
    for (let i = 0; i < 8; i++) treePositions.push([cx + (rand() - 0.5) * 22, cz + (rand() - 0.5) * 25]);
  }
  treePositions.forEach(([x, z], i) => {
    const height = 4.2 + rand() * 2.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, height * 0.55, 6), trunkMat);
    trunk.position.set(x, height * 0.275, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rand() * 1.4, 1), leafMats[i % leafMats.length]);
    crown.position.set(x, height * 0.72, z);
    crown.scale.set(1, 1.25, 0.95);
    crown.castShadow = true;
    scene.add(crown);
  });

  // Weathered fence posts and sagging wire as distant environmental dressing.
  const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x584833, roughness: 1 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x494b45, metalness: 0.25, roughness: 0.85 });
  for (let i = 0; i < 16; i++) {
    const x = -75 + i * 10;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), fencePostMat);
    post.position.set(x, 0.8, 82 + Math.sin(i * 0.6) * 2);
    post.castShadow = true;
    scene.add(post);
    if (i > 0) {
      const prevX = x - 10;
      for (const y of [0.55, 1.1]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 10, 4), wireMat);
        wire.position.set((x + prevX) / 2, y, 82 + Math.sin(i * 0.6) * 2);
        wire.rotation.z = Math.PI / 2;
        scene.add(wire);
      }
    }
  }

  // Objective areas are now muddy clearings in the field, not painted sci-fi pads.
  for (const [x, z] of [[-34, -12], [34, -12], [0, 48]] as const) {
    const clearing = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), earth);
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.set(x, 0.022, z);
    clearing.receiveShadow = true;
    scene.add(clearing);
    const track = new THREE.Mesh(new THREE.RingGeometry(5.3, 5.55, 32), grass);
    track.rotation.x = -Math.PI / 2;
    track.position.set(x, 0.03, z);
    scene.add(track);
  }

  // Soft battlefield haze and restrained drifting dust.
  addAtmosphericEffects(scene);

  return { scene, colliders };
}
