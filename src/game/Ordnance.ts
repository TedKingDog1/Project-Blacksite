import * as THREE from 'three';
import { TrainingDrone } from './Drone';

interface Projectile {
  kind: 'grenade' | 'rocket';
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  fuse: number;
  previous: THREE.Vector3;
  trailPoints: THREE.Vector3[];
  smokeClock: number;
}
interface Burst { mesh: THREE.Mesh; ring: THREE.Mesh; age: number; }
interface SmokePuff { mesh: THREE.Mesh; age: number; life: number; velocity: THREE.Vector3; }
interface AmmoCache { group: THREE.Group; active: boolean; respawn: number; position: THREE.Vector3; }

export class Ordnance {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly targets: TrainingDrone[];
  private readonly onScore: (amount: number) => void;
  private readonly onToast: (message: string) => void;
  private readonly onAmmo: (grenades: number, rockets: number, launcherRounds: number) => void;
  private readonly onWeapon: (name: string, note: string) => void;
  private readonly rocketModel = new THREE.Group();
  private readonly launcherModel = new THREE.Group();
  private readonly projectiles: Projectile[] = [];
  private readonly bursts: Burst[] = [];
  private readonly smoke: SmokePuff[] = [];
  private readonly caches: AmmoCache[] = [];
  private readonly smokeGeometry = new THREE.SphereGeometry(0.19, 7, 6);
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x89949a, transparent: true, opacity: 0.38, depthWrite: false });
  private readonly cacheMaterial = new THREE.MeshStandardMaterial({ color: 0x3a474b, metalness: 0.58, roughness: 0.58 });
  private readonly cacheAccent = new THREE.MeshStandardMaterial({ color: 0x8bd7e8, emissive: 0x267d91, emissiveIntensity: 1.5 });
  private grenades = 3;
  private rockets = 3;
  private launcherRounds = 6;
  private rocketCooldown = 0;
  private selected: 'primary' | 'rpg' | 'launcher' = 'primary';

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, targets: TrainingDrone[],
    events: { onScore: (amount: number) => void; onToast: (message: string) => void;
      onAmmo: (grenades: number, rockets: number, launcherRounds: number) => void;
      onWeapon: (name: string, note: string) => void }) {
    this.scene = scene; this.camera = camera; this.targets = targets;
    this.onScore = events.onScore; this.onToast = events.onToast;
    this.onAmmo = events.onAmmo; this.onWeapon = events.onWeapon;
    this.buildRocketModel(); this.buildLauncherModel();
    this.camera.add(this.rocketModel, this.launcherModel);
    this.rocketModel.visible = false; this.launcherModel.visible = false;
    this.createAmmoCaches(); this.publishAmmo();
  }

  private buildRocketModel(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x414b50, metalness: 0.76, roughness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.62, roughness: 0.32 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.72, 14, 1, true), bodyMat);
    tube.rotation.x = Math.PI / 2; tube.position.set(0.34, -0.25, -0.53); this.rocketModel.add(tube);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 7, 18), accent);
    rim.rotation.x = Math.PI / 2; rim.position.set(0.34, -0.25, -0.9); this.rocketModel.add(rim);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.2), accent);
    sight.position.set(0.34, -0.08, -0.45); this.rocketModel.add(sight);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.18), bodyMat);
    grip.position.set(0.34, -0.4, -0.35); this.rocketModel.add(grip);
  }

  private buildLauncherModel(): void {
    const body = new THREE.MeshStandardMaterial({ color: 0x303a40, metalness: 0.78, roughness: 0.3 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.58, roughness: 0.34 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.68, 14, 1, true), body);
    tube.rotation.x = Math.PI / 2; tube.position.set(0.34, -0.26, -0.57); this.launcherModel.add(tube);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 7, 18), trim);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0.34, -0.26, -0.91); this.launcherModel.add(muzzle);
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.19, 0.32), body);
    chamber.position.set(0.34, -0.2, -0.2); this.launcherModel.add(chamber);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.18), trim);
    grip.position.set(0.34, -0.42, -0.34); this.launcherModel.add(grip);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.15), trim);
    sight.position.set(0.34, -0.08, -0.43); this.launcherModel.add(sight);
  }

  private createAmmoCaches(): void {
    for (const [x, z] of [[-31, 8], [31, 8], [-51, 37], [51, 37]] as const) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 1.1), this.cacheMaterial);
      base.position.y = 0.48; base.castShadow = true; group.add(base);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 1.16), this.cacheAccent);
      lid.position.y = 1.02; group.add(lid);
      for (const dx of [-0.48, 0.48]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.76, 1.12), this.cacheAccent);
        stripe.position.set(dx, 0.48, 0); group.add(stripe);
      }
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), this.cacheAccent);
      beacon.position.y = 1.42; group.add(beacon);
      group.position.set(x, 0, z); this.scene.add(group);
      this.caches.push({ group, active: true, respawn: 0, position: new THREE.Vector3(x, 0, z) });
    }
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    this.rocketCooldown = Math.max(0, this.rocketCooldown - delta);
    this.updateCaches(delta, playerPosition);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.fuse -= delta; p.previous.copy(p.mesh.position);
      if (p.kind === 'grenade') {
        p.velocity.y -= 9.2 * delta; p.mesh.position.addScaledVector(p.velocity, delta);
        if (p.mesh.position.y < 0.42) {
          p.mesh.position.y = 0.42; p.velocity.y = Math.abs(p.velocity.y) * 0.34;
          p.velocity.x *= 0.72; p.velocity.z *= 0.72;
        }
      } else p.mesh.position.addScaledVector(p.velocity, delta);
      if (p.kind === 'rocket') {
        p.smokeClock -= delta;
        if (p.smokeClock <= 0) { this.spawnSmoke(p.mesh.position); p.smokeClock = 0.035; }
      }
      let hit = false;
      const segment = new THREE.Line3(p.previous, p.mesh.position);
      const closest = new THREE.Vector3();
      for (const target of this.targets) {
        segment.closestPointToPoint(target.position, true, closest);
        if (closest.distanceTo(target.position) < 1.35) { hit = true; break; }
      }
      if (p.fuse <= 0 || hit) this.detonate(i);
    }
    this.updateSmoke(delta);
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

  private updateCaches(delta: number, player: THREE.Vector3): void {
    for (const cache of this.caches) {
      if (!cache.active) {
        cache.respawn -= delta;
        if (cache.respawn <= 0) { cache.active = true; cache.group.visible = true; }
        continue;
      }
      if (new THREE.Vector2(player.x - cache.position.x, player.z - cache.position.z).length() < 2.5) {
        this.grenades = Math.min(6, this.grenades + 3);
        this.rockets = Math.min(6, this.rockets + 3);
        this.launcherRounds = Math.min(12, this.launcherRounds + 6);
        cache.active = false; cache.respawn = 22; cache.group.visible = false;
        this.publishAmmo(); this.onToast('AMMO CACHE COLLECTED // ORDNANCE RESTOCKED');
      }
    }
  }

  private spawnSmoke(position: THREE.Vector3): void {
    if (this.smoke.length >= 48) this.removeSmoke(0);
    const material = this.smokeMaterial.clone();
    const mesh = new THREE.Mesh(this.smokeGeometry, material);
    mesh.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12));
    mesh.scale.setScalar(0.55 + Math.random() * 0.55);
    this.scene.add(mesh);
    this.smoke.push({ mesh, age: 0, life: 0.9 + Math.random() * 0.65,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.65, 0.7 + Math.random() * 0.7, (Math.random() - 0.5) * 0.65) });
  }

  private updateSmoke(delta: number): void {
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const puff = this.smoke[i]; puff.age += delta;
      puff.mesh.position.addScaledVector(puff.velocity, delta);
      puff.velocity.multiplyScalar(Math.max(0, 1 - delta * 0.7));
      const t = puff.age / puff.life;
      puff.mesh.scale.multiplyScalar(1 + delta * 1.35);
      (puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.38 * (1 - t);
      if (t >= 1) this.removeSmoke(i);
    }
  }

  private removeSmoke(index: number): void {
    const [puff] = this.smoke.splice(index, 1);
    if (!puff) return;
    this.scene.remove(puff.mesh); (puff.mesh.material as THREE.Material).dispose();
  }

  selectPrimary(): void {
    this.selected = 'primary'; this.rocketModel.visible = false; this.launcherModel.visible = false;
  }
  selectRPG(): void {
    this.selected = 'rpg'; this.rocketModel.visible = true; this.launcherModel.visible = false;
    this.onWeapon('RPG-01 ROCKET LAUNCHER', 'SMOKE-TRAIL ROCKET // LIMITED AMMO');
    this.onToast('EQUIPPED: RPG-01');
  }
  selectGrenadeLauncher(): void {
    this.selected = 'launcher'; this.rocketModel.visible = false; this.launcherModel.visible = true;
    this.onWeapon('GL-06 GRENADE LAUNCHER', 'ARC-LOB PULSE GRENADE // LIMITED AMMO');
    this.onToast('EQUIPPED: GL-06');
  }
  fireSelected(): boolean {
    if (this.selected === 'rpg') { this.launchRocket(); return true; }
    if (this.selected === 'launcher') { this.launchGrenade(); return true; }
    return false;
  }

  throwGrenade(): void {
    if (this.grenades <= 0) { this.onToast('PULSE GRENADES DEPLETED'); return; }
    this.grenades--;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, 0.75);
    this.spawnGrenadeProjectile(origin, direction.multiplyScalar(10).add(new THREE.Vector3(0, 4.3, 0)), 1.45);
    this.publishAmmo(); this.onToast('PULSE GRENADE AWAY');
  }

  private launchGrenade(): void {
    if (this.launcherRounds <= 0) { this.onToast('GRENADE LAUNCHER EMPTY // FIND AMMO CACHE'); return; }
    this.launcherRounds--;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, 0.8);
    this.spawnGrenadeProjectile(origin, direction.multiplyScalar(23), 2.3);
    this.publishAmmo(); this.onToast('GRENADE LAUNCHED');
  }

  private spawnGrenadeProjectile(origin: THREE.Vector3, velocity: THREE.Vector3, fuse: number): void {
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x77d9e9, emissive: 0x167c9a, emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.25 }));
    mesh.add(shell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 7, 18),
      new THREE.MeshStandardMaterial({ color: 0xc5a56a, emissive: 0x8a5d20, emissiveIntensity: 1.3 }));
    ring.rotation.x = Math.PI / 2; mesh.add(ring); mesh.position.copy(origin); this.scene.add(mesh);
    this.projectiles.push({ kind: 'grenade', mesh, velocity, fuse, previous: origin.clone(), trailPoints: [], smokeClock: 0 });
  }

  private launchRocket(): void {
    if (this.rockets <= 0) { this.onToast('ROCKET CELLS DEPLETED // FIND AMMO CACHE'); return; }
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
    this.projectiles.push({ kind: 'rocket', mesh, velocity: direction.multiplyScalar(34), fuse: 4.5,
      previous: origin.clone(), trailPoints: [], smokeClock: 0 });
    this.publishAmmo(); this.onToast('RPG ROCKET AWAY');
  }

  private detonate(index: number): void {
    const [p] = this.projectiles.splice(index, 1); if (!p) return;
    this.scene.remove(p.mesh);
    p.mesh.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
    const center = p.mesh.position.clone(); const radius = p.kind === 'rocket' ? 9 : 7;
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14),
      new THREE.MeshBasicMaterial({ color: p.kind === 'rocket' ? 0x9de8f2 : 0x70d7e7, transparent: true, opacity: 0.42, depthWrite: false }));
    core.position.copy(center); core.scale.setScalar(0.5); this.scene.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xc5a56a, transparent: true, opacity: 0.8 }));
    ring.position.copy(center); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.4); this.scene.add(ring);
    this.bursts.push({ mesh: core, ring, age: 0 });
    let tagged = 0;
    for (const target of this.targets) {
      if (target.position.distanceTo(center) > radius) continue;
      // Three quick hit registrations match the robot's three-hit durability.
      for (let hit = 0; hit < 3; hit++) {
        if (target.registerHit()) { this.onScore(100); tagged++; break; }
      }
    }
    this.onToast(tagged ? 'BLAST TAG CONFIRMED +' + tagged * 100 : 'ENERGY BURST');
  }

  reset(): void {
    this.clearProjectiles(); this.grenades = 3; this.rockets = 3; this.launcherRounds = 6; this.rocketCooldown = 0; this.publishAmmo();
  }

  dispose(): void {
    this.clearProjectiles();
    for (const cache of this.caches) { this.scene.remove(cache.group); cache.group.clear(); }
    this.camera.remove(this.rocketModel, this.launcherModel);
    this.rocketModel.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.launcherModel.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.smokeGeometry.dispose(); this.smokeMaterial.dispose(); this.cacheMaterial.dispose(); this.cacheAccent.dispose();
  }

  private clearProjectiles(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
    }
    this.projectiles.length = 0;
    for (let i = this.smoke.length - 1; i >= 0; i--) this.removeSmoke(i);
    for (const b of this.bursts) { this.scene.remove(b.mesh, b.ring); b.mesh.geometry.dispose(); b.ring.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); (b.ring.material as THREE.Material).dispose(); }
    this.bursts.length = 0;
  }

  private publishAmmo(): void { this.onAmmo(this.grenades, this.rockets, this.launcherRounds); }
}
