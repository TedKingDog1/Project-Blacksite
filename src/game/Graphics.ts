import * as THREE from 'three';

/** Procedural atmosphere and surface detail: no downloads or external assets required. */
export function createSkyDome(scene: THREE.Scene): void {
  const geometry = new THREE.SphereGeometry(700, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x26394a) },
      horizon: { value: new THREE.Color(0xa6a69b) },
      sunDirection: { value: new THREE.Vector3(-0.48, 0.72, 0.5).normalize() },
      sunColor: { value: new THREE.Color(0xffd6a0) }
    },
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      varying vec3 vWorldDirection;
      void main() {
        vec3 direction = normalize(vWorldDirection);
        float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float gradient = pow(height, 0.62);
        vec3 sky = mix(horizon, zenith, gradient);
        float sun = pow(max(dot(direction, normalize(sunDirection)), 0.0), 420.0);
        float glow = pow(max(dot(direction, normalize(sunDirection)), 0.0), 18.0);
        sky += sunColor * (sun * 1.8 + glow * 0.12);
        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  scene.add(dome);
}

export function createConcreteTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas texture generation is unavailable.');
  const image = context.createImageData(size, size);
  let seed = 9137;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = Math.floor(112 + random() * 34);
    image.data[i] = grain;
    image.data[i + 1] = grain + 2;
    image.data[i + 2] = grain + 3;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  for (let i = 0; i < 1800; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = random() * 2.2 + 0.25;
    context.fillStyle = random() > 0.5 ? 'rgba(24,30,32,0.12)' : 'rgba(230,225,211,0.10)';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 30);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function addArchitecturalDetail(scene: THREE.Scene): void {
  const trim = new THREE.MeshStandardMaterial({ color: 0x252f35, metalness: 0.62, roughness: 0.48 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x92999a, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x243b47, metalness: 0.55, roughness: 0.22,
    emissive: 0x172b35, emissiveIntensity: 0.35
  });
  const amber = new THREE.MeshStandardMaterial({
    color: 0xd0a76a, emissive: 0x7b4d1d, emissiveIntensity: 0.7,
    metalness: 0.25, roughness: 0.45
  });
  const add = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  // Recessed-looking window strips and structural corner pilasters.
  for (const [cx, cz, width, depth] of [[-30, -25, 12, 10], [30, -25, 12, 10], [-53, -48, 18, 14], [53, -48, 18, 14]] as const) {
    const halfW = width / 2;
    const halfD = depth / 2;
    const top = width === 12 ? 5.25 : 4.8;
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        add(cx + i * (width / 3.5), top, cz + side * (halfD + 0.035), width / 4.4, 0.9, 0.07, glass);
        add(cx + i * (width / 3.5), top + 0.52, cz + side * (halfD + 0.08), width / 4.1, 0.09, 0.14, trim);
      }
      add(cx + side * (halfW + 0.035), 2.9, cz, 0.08, 5.4, depth, concrete);
    }
    for (const side of [-1, 1]) {
      add(cx + side * (halfW + 0.035), 2.9, cz, 0.08, 5.4, depth, concrete);
    }
    add(cx, 0.95, cz + halfD + 0.08, width * 0.42, 1.9, 0.12, trim);
    add(cx, 1.0, cz + halfD + 0.16, width * 0.37, 1.65, 0.05, glass);
    add(cx, 2.05, cz + halfD + 0.2, width * 0.4, 0.12, 0.08, amber);
  }

  // Repeated runway/service-lane reflectors give the yard scale at a distance.
  const reflector = new THREE.MeshStandardMaterial({ color: 0xb9a77d, emissive: 0x4a3214, emissiveIntensity: 0.22, roughness: 0.65 });
  for (let z = -66; z <= 66; z += 6) {
    for (const x of [-66, 66]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.8), reflector);
      marker.position.set(x, 0.035, z);
      scene.add(marker);
    }
  }

  // Large, readable bay-door framing on the outer service buildings.
  for (const x of [-53, 53]) {
    const z = -40.86;
    add(x, 1.8, z, 6.4, 3.5, 0.16, trim);
    add(x, 1.8, z - 0.1, 5.8, 3.0, 0.08, glass);
    for (let y = 0.55; y < 3.2; y += 0.42) add(x, y, z - 0.17, 5.8, 0.045, 0.06, concrete);
  }
}
