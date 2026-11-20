import * as THREE from 'three';
import { TrainingDrone } from './Drone';

export interface WeaponEvents {
  onAmmoChanged: (current: number, capacity: number) => void;
  onScore: (amount: number) => void;
  onToast: (message: string) => void;
  onWeaponChanged: (name: string, note: string) => void;
}

interface WeaponProfile {
  name: string;
  note: string;
  capacity: number;
  cooldown: number;
  reloadTime: number;
  rays: number;
  spread: number;
  color: number;
  score: number;
}

const PROFILES: WeaponProfile[] = [
  { name: 'PULSE PROJECTOR', note: 'BALANCED ENERGY CELL', capacity: 24, cooldown: 0.19, reloadTime: 1.15, rays: 1, spread: 0, color: 0x5bd5eb, score: 100 },
  { name: 'ARC REPEATER', note: 'RAPID ENERGY DISCHARGE', capacity: 36, cooldown: 0.095, reloadTime: 1.45, rays: 1, spread: 0.006, color: 0x9be58d, score: 100 },
  { name: 'NOVA EMITTER', note: 'WIDE-ANGLE ENERGY BURST', capacity: 8, cooldown: 0.62, reloadTime: 1.6, rays: 5, spread: 0.045, color: 0xe7a2ef, score: 100 }
];

export class PulseProjector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly raycaster = new THREE.Raycaster();
  private readonly targets: TrainingDrone[];
  private readonly events: WeaponEvents;
  private readonly model = new THREE.Group();
  private readonly lensMaterial: THREE.MeshStandardMaterial;
  private readonly tracerMaterials = new Map<number, THREE.LineBasicMaterial>();
  private weaponIndex = 0;
  private ammo = PROFILES[0].capacity;
  private cooldown = 0;
  private reloadTimer = 0;
  private reloading = false;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene, targets: TrainingDrone[], events: WeaponEvents) {
    this.camera = camera;
    this.scene = scene;
    this.targets = targets;
    this.events = events;
    this.lensMaterial = new THREE.MeshStandardMaterial({
      color: PROFILES[0].color, emissive: PROFILES[0].color,
      emissiveIntensity: 1.8, metalness: 0.2, roughness: 0.2
    });
    this.createViewModel();
    this.events.onAmmoChanged(this.ammo, this.profile.capacity);
    this.events.onWeaponChanged(this.profile.name, this.profile.note);
  }

  private get profile(): WeaponProfile { return PROFILES[this.weaponIndex]; }

  update(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (!this.reloading) return;
    this.reloadTimer -= delta;
    if (this.reloadTimer <= 0) {
      this.ammo = this.profile.capacity;
      this.reloading = false;
      this.events.onAmmoChanged(this.ammo, this.profile.capacity);
      this.events.onToast('ENERGY CELL RESTORED');
    }
  }

  selectWeapon(slot: number): void {
    if (slot < 1 || slot > PROFILES.length || slot - 1 === this.weaponIndex) return;
    this.weaponIndex = slot - 1;
    this.ammo = this.profile.capacity;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0.2;
    this.lensMaterial.color.setHex(this.profile.color);
    this.lensMaterial.emissive.setHex(this.profile.color);
    this.events.onAmmoChanged(this.ammo, this.profile.capacity);
    this.events.onWeaponChanged(this.profile.name, this.profile.note);
    this.events.onToast('EQUIPPED: ' + this.profile.name);
  }

  fire(): void {
    if (this.cooldown > 0 || this.reloading) return;
    if (this.ammo <= 0) {
      this.events.onToast('CELL EMPTY — PRESS R');
      return;
    }

    this.ammo--;
    this.cooldown = this.profile.cooldown;
    this.events.onAmmoChanged(this.ammo, this.profile.capacity);

    const hits = new Set<TrainingDrone>();
    const rayCount = this.profile.rays;
    for (let i = 0; i < rayCount; i++) {
      const x = rayCount === 1 ? 0 : (i - (rayCount - 1) / 2) * this.profile.spread;
      const y = rayCount === 1 ? 0 : ((i % 2) - 0.5) * this.profile.spread;
      this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      this.raycaster.far = 80;
      const hit = this.raycaster.intersectObjects(this.scene.children, true)[0];
      const end = hit?.point ?? this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 42);
      this.drawPulse(end, this.profile.color);
      const drone = hit?.object.userData.drone as TrainingDrone | undefined;
      if (drone && this.targets.includes(drone)) hits.add(drone);
    }

    for (const drone of hits) {
      if (drone.registerHit()) {
        this.events.onScore(this.profile.score);
        this.events.onToast('TARGET TAGGED  +' + this.profile.score);
      } else {
        this.events.onToast('TARGET HIT');
      }
    }
  }

  reload(): void {
    if (this.reloading || this.ammo === this.profile.capacity) return;
    this.reloading = true;
    this.reloadTimer = this.profile.reloadTime;
    this.events.onToast('RECHARGING');
  }

  dispose(): void {
    this.camera.remove(this.model);
    for (const material of this.tracerMaterials.values()) material.dispose();
    this.model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  private createViewModel(): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x303a40, metalness: 0.8, roughness: 0.28 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.55, roughness: 0.3 });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.48), bodyMaterial);
    this.model.add(housing);
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 16), trimMaterial);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.015, -0.27);
    this.model.add(emitter);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), this.lensMaterial);
    lens.position.set(0, 0.015, -0.34);
    this.model.add(lens);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.1, 0.22), trimMaterial);
    side.position.set(0.115, -0.025, 0.02);
    this.model.add(side);
    this.model.position.set(0.34, -0.29, -0.62);
    this.camera.add(this.model);
  }

  private drawPulse(end: THREE.Vector3, color: number): void {
    const start = this.camera.getWorldPosition(new THREE.Vector3());
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    let material = this.tracerMaterials.get(color);
    if (!material) {
      material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      this.tracerMaterials.set(color, material);
    }
    const lineMaterial = material.clone();
    const line = new THREE.Line(geometry, lineMaterial);
    this.scene.add(line);
    let elapsed = 0;
    const fade = (): void => {
      elapsed += 0.04;
      lineMaterial.opacity = Math.max(0, 0.9 * (1 - elapsed / 0.16));
      if (elapsed >= 0.16) {
        this.scene.remove(line);
        geometry.dispose();
        lineMaterial.dispose();
      } else requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }
}
