import * as THREE from 'three';
import { TrainingDrone } from './Drone';

interface Projectile {
  kind: 'grenade' | 'rocket';
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  fuse: number;
  trail?: THREE.Line;
  trailPoints: THREE.Vector3[];
}
interface Burst { mesh: THREE.Mesh; ring: THREE.Mesh; age: number; }

/** Fictional energy ordnance with stylized pulse grenades and training rockets. */
export class Ordnance {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly targets: TrainingDrone[];
  private readonly onScore: (amount: number) => void;
  private readonly onToast: (message: string) => void;
  private readonly onAmmo: (grenades: number, rockets: number) => void;
  private readonly launcher = new THREE.Group();
  private readonly projectiles: Projectile[] = [];
  private readonly bursts: Burst[] = [];
  private grenades = 3;
  private rockets = 3;
  private rocketCooldown = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, targets: TrainingDrone[],
    events: { onScore: (amount: number) => void; onToast: (message: string) => void; onAmmo: (grenades: number, rockets: number) => void }) {
    this.scene = scene; this.camera = camera; this.targets = targets;
    this.onScore = events.onScore; this.onToast = events.onToast; this.onAmmo = events.onAmmo;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.5, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x26343b, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide }));
    tube.rotation.x = Math.PI / 2; tube.position.set(-0.3, -0.2, -0.53); this.launcher.add(tube);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.014, 7, 16),
      new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.65, roughness: 0.3 }));
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(-0.3, -0.2, -0.78); this.launcher.add(muzzle);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.19, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x141d22, roughness: 0.75 }));
    grip.position.set(-0.3, -0.31, -0.48); this.launcher.add(grip);
    const status = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8bd7e8, emissive: 0x267d91, emissiveIntensity: 1.6 }));
    status.position.set(-0.3, -0.115, -0.48); this.launcher.add(status);
    this.camera.add(this.launcher); this.publishAmmo();
  }

  update(delta: number): void {
    this.rocketCooldown = Math.max(0, this.rocketCooldown - delta);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.fuse -= delta;
      if (p.kind === 'grenade') {
        p.velocity.y -= 9.2 * delta; p.mesh.position.addScaledVector(p.velocity, delta);
        if (p.mesh.position.y < 0.42) {
          p.mesh.position.y = 0.42; p.velocity.y = Math.abs(p.velocity.y) * 0.34;
          p.velocity.x *= 0.72; p.velocity.z *= 0.72;
        }
      } else p.mesh.position.addScaledVector(p.velocity, delta);
      if (p.trail) {
        p.trailPoints.unshift(p.mesh.position.clone()); p.trailPoints.length = Math.min(12, p.trailPoints.length);
        const positions = new Float32Array(36);
        for (let j = 0; j < 12; j++) {
          const point = p.trailPoints[Math.min(j, p.trailPoints.length - 1)] ?? p.mesh.position;
          positions[j * 3] = point.x; positions[j * 3 + 1] = point.y; positions[j * 3 + 2] = point.z;
        }
        p.trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        p.trail.geometry.computeBoundingSphere();
        (p.trail.material as THREE.LineBasicMaterial).opacity = Math.min(0.82, p.fuse * 0.9);
      }
      const hit = this.targets.some((target) => target.position.distanceTo(p.mesh.position) < 1.15);
      if (p.fuse <= 0 || hit) this.detonate(i);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.age += delta; const t = Math.min(1, b.age / 0.48);
      b.mesh.scale.setScalar(0.5 + t * 5.5); (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - t);
      b.ring.scale.setScalar(0.4 + t * 8); (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (t >= 1) {
        this.scene.remove(b.mesh, b.ring); b.mesh.geometry.dispose(); b.ring.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose(); (b.ring.material as THREE.Material).dispose(); this.bursts.splice(i, 1);
      }
    }
  }

  throwGrenade(): void {
    if (this.grenades <= 0) { this.onToast('PULSE GRENADES DEPLETED'); return; }
    this.grenades--;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, 0.75);
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x77d9e9, emissive: 0x167c9a, emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.25 })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 7, 18),
      new THREE.MeshStandardMaterial({ color: 0xc5a56a, emissive: 0x8a5d20, emissiveIntensity: 1.3 }));
    ring.rotation.x = Math.PI / 2; mesh.add(ring); mesh.position.copy(origin); this.scene.add(mesh);
    this.projectiles.push({ kind: 'grenade', mesh, velocity: direction.multiplyScalar(10).add(new THREE.Vector3(0, 4.3, 0)), fuse: 1.45, trailPoints: [] });
    this.publishAmmo(); this.onToast('PULSE GRENADE AWAY');
  }

  launchRocket(): void {
    if (this.rockets <= 0) { this.onToast('ROCKET CELLS DEPLETED'); return; }
    if (this.rocketCooldown > 0) return;
    this.rockets--; this.rocketCooldown = 0.8;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(direction, this.camera.up).normalize();
    const origin = this.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, 0.8).addScaledVector(right, -0.3);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.58, 10),
      new THREE.MeshStandardMaterial({ color: 0xb5bdba, metalness: 0.68, roughness: 0.32 }));
    body.rotation.x = Math.PI / 2; mesh.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.057, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x8bd7e8, emissive: 0x267d91, emissiveIntensity: 1.8 }));
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.36; mesh.add(nose);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x303a40, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.13), finMat);
      fin.position.z = 0.2; fin.rotation.z = i * Math.PI / 2; mesh.add(fin);
    }
    mesh.position.copy(origin); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction); this.scene.add(mesh);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xbceef4, transparent: true, opacity: 0.82 }));
    this.scene.add(trail);
    this.projectiles.push({ kind: 'rocket', mesh, velocity: direction.multiplyScalar(31), fuse: 1.75, trail, trailPoints: [origin.clone()] });
    this.publishAmmo(); this.onToast('TRAINING ROCKET LAUNCHED');
  }

  reset(): void { this.clearProjectiles(); this.grenades = 3; this.rockets = 3; this.rocketCooldown = 0; this.publishAmmo(); }

  dispose(): void {
    this.clearProjectiles(); this.camera.remove(this.launcher);
    this.launcher.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
  }

  private detonate(index: number): void {
    const [p] = this.projectiles.splice(index, 1); if (!p) return;
    this.scene.remove(p.mesh);
    p.mesh.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
    if (p.trail) { this.scene.remove(p.trail); p.trail.geometry.dispose(); (p.trail.material as THREE.Material).dispose(); }
    const center = p.mesh.position.clone(); const radius = p.kind === 'rocket' ? 8 : 6;
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14),
      new THREE.MeshBasicMaterial({ color: p.kind === 'rocket' ? 0x9de8f2 : 0x70d7e7, transparent: true, opacity: 0.42, depthWrite: false }));
    core.position.copy(center); core.scale.setScalar(0.5); this.scene.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xc5a56a, transparent: true, opacity: 0.8 }));
    ring.position.copy(center); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.4); this.scene.add(ring);
    this.bursts.push({ mesh: core, ring, age: 0 });
    let tagged = 0;
    for (const target of this.targets) if (target.position.distanceTo(center) <= radius && target.registerHit()) { this.onScore(100); tagged++; }
    this.onToast(tagged ? 'AREA TAG CONFIRMED +' + tagged * 100 : 'ENERGY BURST');
  }

  private clearProjectiles(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh); p.mesh.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
      if (p.trail) { this.scene.remove(p.trail); p.trail.geometry.dispose(); (p.trail.material as THREE.Material).dispose(); }
    }
    this.projectiles.length = 0;
    for (const b of this.bursts) { this.scene.remove(b.mesh, b.ring); b.mesh.geometry.dispose(); b.ring.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); (b.ring.material as THREE.Material).dispose(); }
    this.bursts.length = 0;
  }

  private publishAmmo(): void { this.onAmmo(this.grenades, this.rockets); }
}
