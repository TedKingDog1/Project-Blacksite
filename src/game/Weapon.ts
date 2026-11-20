import * as THREE from 'three';
import { TrainingDrone } from './Drone';

export interface WeaponEvents {
  onAmmoChanged: (current: number, capacity: number) => void;
  onScore: (amount: number) => void;
  onToast: (message: string) => void;
  onWeaponChanged: (name: string, note: string) => void;
}

export interface WeaponLoadout {
  slot: number;
  optic: 'reflex' | 'precision';
  capacitor: 'standard' | 'extended';
  stabilizer: boolean;
  fullAuto: boolean;
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

const DEFAULT_LOADOUT: WeaponLoadout = {
  slot: 1, optic: 'reflex', capacitor: 'standard', stabilizer: false, fullAuto: false
};

export class PulseProjector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly raycaster = new THREE.Raycaster();
  private readonly targets: TrainingDrone[];
  private readonly events: WeaponEvents;
  private readonly model = new THREE.Group();
  private readonly lensMaterial: THREE.MeshStandardMaterial;
  private readonly tracerMaterials = new Map<number, THREE.LineBasicMaterial>();
  private loadout: WeaponLoadout = { ...DEFAULT_LOADOUT };
  private ammo = PROFILES[0].capacity;
  private cooldown = 0;
  private reloadTimer = 0;
  private reloading = false;
  private aiming = false;
  private triggerHeld = false;

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
    this.events.onAmmoChanged(this.ammo, this.capacity);
    this.events.onWeaponChanged(this.profile.name, this.profile.note);
  }

  private get profile(): WeaponProfile { return PROFILES[this.loadout.slot - 1]; }
  private get capacity(): number {
    return this.profile.capacity + (this.loadout.capacitor === 'extended' ? Math.ceil(this.profile.capacity * 0.25) : 0);
  }

  update(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
    const targetPosition = this.aiming
      ? new THREE.Vector3(0.08, -0.205, -0.46)
      : new THREE.Vector3(0.34, -0.29, -0.62);
    this.model.position.lerp(targetPosition, Math.min(1, delta * 13));
    const targetScale = this.aiming ? 0.88 : 1;
    this.model.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(1, delta * 13));

    if (this.loadout.fullAuto && this.triggerHeld && !this.reloading) this.fire();
    if (!this.reloading) return;
    this.reloadTimer -= delta;
    if (this.reloadTimer <= 0) {
      this.ammo = this.capacity;
      this.reloading = false;
      this.events.onAmmoChanged(this.ammo, this.capacity);
      this.events.onToast('ENERGY CELL RESTORED');
    }
  }

  selectWeapon(slot: number): void {
    if (slot < 1 || slot > PROFILES.length || slot === this.loadout.slot) return;
    this.loadout.slot = slot;
    if (slot === 3) this.loadout.fullAuto = false;
    this.ammo = this.capacity;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0.2;
    this.lensMaterial.color.setHex(this.profile.color);
    this.lensMaterial.emissive.setHex(this.profile.color);
    this.rebuildViewModel();
    this.events.onAmmoChanged(this.ammo, this.capacity);
    this.publishWeapon();
    this.events.onToast('EQUIPPED: ' + this.profile.name);
  }

  getLoadout(): WeaponLoadout {
    return { ...this.loadout };
  }

  applyLoadout(next: WeaponLoadout): void {
    this.loadout = {
      slot: Math.min(3, Math.max(1, Math.round(next.slot))),
      optic: next.optic === 'precision' ? 'precision' : 'reflex',
      capacitor: next.capacitor === 'extended' ? 'extended' : 'standard',
      stabilizer: Boolean(next.stabilizer),
      fullAuto: Boolean(next.fullAuto) && next.slot !== 3
    };
    this.ammo = this.capacity;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0.2;
    this.lensMaterial.color.setHex(this.profile.color);
    this.lensMaterial.emissive.setHex(this.profile.color);
    this.rebuildViewModel();
    this.events.onAmmoChanged(this.ammo, this.capacity);
    this.publishWeapon();
    this.events.onToast('LOADOUT CONFIGURATION APPLIED');
  }

  setAiming(value: boolean): void { this.aiming = value; }
  getAimFov(): number { return this.loadout.optic === 'precision' ? 46 : 54; }
  setTriggerHeld(value: boolean): void { this.triggerHeld = value; }

  fire(): void {
    if (this.cooldown > 0 || this.reloading) return;
    if (this.ammo <= 0) {
      this.events.onToast('CELL EMPTY — PRESS R');
      this.triggerHeld = false;
      return;
    }

    this.ammo--;
    this.cooldown = this.profile.cooldown;
    this.events.onAmmoChanged(this.ammo, this.capacity);

    const hits = new Set<TrainingDrone>();
    const rayCount = this.profile.rays;
    const aimSpread = this.aiming ? (this.loadout.optic === 'precision' ? 0.18 : 0.28) : 1;
    const stabilizerSpread = this.loadout.stabilizer ? 0.65 : 1;
    const spread = this.profile.spread * aimSpread * stabilizerSpread;
    for (let i = 0; i < rayCount; i++) {
      const x = rayCount === 1 ? 0 : (i - (rayCount - 1) / 2) * spread;
      const y = rayCount === 1 ? 0 : ((i % 2) - 0.5) * spread;
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
      } else this.events.onToast('TARGET HIT');
    }
  }

  reload(): void {
    if (this.reloading || this.ammo === this.capacity) return;
    this.triggerHeld = false;
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

  private publishWeapon(): void {
    const upgrades = [
      this.loadout.fullAuto ? 'FULL AUTO' : 'SEMI AUTO',
      this.loadout.stabilizer ? 'STABILIZED' : 'STANDARD HANDLING'
    ].join(' // ');
    this.events.onWeaponChanged(this.profile.name, upgrades);
  }

  private createViewModel(): void {
    this.rebuildViewModel();
    this.camera.add(this.model);
  }

  private rebuildViewModel(): void {
    while (this.model.children.length) {
      const child = this.model.children[0];
      this.model.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { if (material !== this.lensMaterial) material.dispose(); });
        }
      });
    }
    const body = new THREE.MeshStandardMaterial({ color: 0x303a40, metalness: 0.82, roughness: 0.27 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.62, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151d22, metalness: 0.65, roughness: 0.38 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z); mesh.castShadow = true; this.model.add(mesh); return mesh;
    };
    if (this.loadout.slot === 1) {
      add(new THREE.BoxGeometry(0.2, 0.17, 0.46), body, 0, 0, 0);
      add(new THREE.BoxGeometry(0.13, 0.12, 0.22), dark, 0, -0.13, 0.09);
      add(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 16), trim, 0, 0.015, -0.29).rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.055, 12, 10), this.lensMaterial, 0, 0.015, -0.36);
      add(new THREE.BoxGeometry(0.045, 0.1, 0.25), trim, 0.12, -0.025, 0.02);
    } else if (this.loadout.slot === 2) {
      add(new THREE.BoxGeometry(0.25, 0.19, 0.5), body, 0, 0, 0.01);
      for (const x of [-0.075, 0.075]) {
        add(new THREE.CylinderGeometry(0.045, 0.052, 0.46, 12), dark, x, 0.025, -0.22).rotation.x = Math.PI / 2;
        add(new THREE.TorusGeometry(0.052, 0.012, 6, 12), trim, x, 0.025, -0.45).rotation.x = Math.PI / 2;
      }
      add(new THREE.BoxGeometry(0.1, 0.1, 0.17), trim, 0, 0.13, -0.04);
      add(new THREE.SphereGeometry(0.045, 10, 8), this.lensMaterial, 0, 0.14, -0.13);
      add(new THREE.BoxGeometry(0.14, 0.12, 0.2), dark, 0, -0.15, 0.08);
    } else {
      add(new THREE.BoxGeometry(0.3, 0.23, 0.43), body, 0, 0, 0.04);
      add(new THREE.BoxGeometry(0.24, 0.13, 0.24), trim, 0, 0.11, -0.12);
      add(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 16), dark, 0, 0.015, -0.31).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.13, 0.025, 8, 18), this.lensMaterial, 0, 0.015, -0.47).rotation.x = Math.PI / 2;
      for (const x of [-0.19, 0.19]) add(new THREE.BoxGeometry(0.07, 0.18, 0.32), trim, x, -0.01, -0.03);
      add(new THREE.BoxGeometry(0.15, 0.15, 0.2), dark, 0, -0.18, 0.09);
    }
    add(new THREE.BoxGeometry(0.12, 0.045, 0.13), dark, 0, 0.15, 0.02);
    add(new THREE.BoxGeometry(0.1, 0.012, 0.1), this.lensMaterial, 0, 0.19, 0.02);
    this.model.position.set(0.34, -0.29, -0.62);
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
