import * as THREE from 'three';
import { TrainingDrone } from './Drone';

export interface WeaponEvents {
  onAmmoChanged: (current: number, capacity: number) => void;
  onScore: (amount: number) => void;
  onToast: (message: string) => void;
}

export class PulseProjector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly raycaster = new THREE.Raycaster();
  private readonly targets: TrainingDrone[];
  private readonly events: WeaponEvents;
  private readonly model = new THREE.Group();
  private ammo = 24;
  private readonly capacity = 24;
  private cooldown = 0;
  private reloadTimer = 0;
  private reloading = false;
  private readonly tracerMaterial = new THREE.LineBasicMaterial({ color: 0x78dff5, transparent: true, opacity: 0.9 });

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    targets: TrainingDrone[],
    events: WeaponEvents
  ) {
    this.camera = camera;
    this.scene = scene;
    this.targets = targets;
    this.events = events;
    this.createViewModel();
    this.events.onAmmoChanged(this.ammo, this.capacity);
  }

  update(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.ammo = this.capacity;
        this.reloading = false;
        this.events.onAmmoChanged(this.ammo, this.capacity);
        this.events.onToast('ENERGY CELL RESTORED');
      }
    }
  }

  fire(): void {
    if (this.cooldown > 0 || this.reloading) return;
    if (this.ammo <= 0) {
      this.events.onToast('CELL EMPTY — PRESS R');
      return;
    }

    this.ammo--;
    this.cooldown = 0.19;
    this.events.onAmmoChanged(this.ammo, this.capacity);

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 65;
    const meshes: THREE.Object3D[] = [];
    for (const target of this.targets) {
      if (target.group.visible) target.group.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes.push(object);
      });
    }

    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const end = hit?.point ?? this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 35);
    this.drawPulse(end);

    if (hit) {
      const drone = hit.object.userData.drone as TrainingDrone | undefined;
      if (drone?.registerHit()) {
        this.events.onScore(100);
        this.events.onToast('TARGET TAGGED  +100');
      } else if (drone) {
        this.events.onToast('TARGET HIT');
      }
    }
  }

  reload(): void {
    if (this.reloading || this.ammo === this.capacity) return;
    this.reloading = true;
    this.reloadTimer = 1.15;
    this.events.onToast('RECHARGING');
  }

  dispose(): void {
    this.camera.remove(this.model);
    this.tracerMaterial.dispose();
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
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0x5bd5eb, emissive: 0x167f9a, emissiveIntensity: 2.2,
      metalness: 0.2, roughness: 0.2
    });

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.48), bodyMaterial);
    housing.position.set(0, 0, 0);
    this.model.add(housing);

    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 16), trimMaterial);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.015, -0.27);
    this.model.add(emitter);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), lensMaterial);
    lens.position.set(0, 0.015, -0.34);
    this.model.add(lens);

    const side = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.1, 0.22), trimMaterial);
    side.position.set(0.115, -0.025, 0.02);
    this.model.add(side);

    this.model.position.set(0.34, -0.29, -0.62);
    this.camera.add(this.model);
  }

  private drawPulse(end: THREE.Vector3): void {
    const start = this.camera.getWorldPosition(new THREE.Vector3());
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, this.tracerMaterial.clone());
    this.scene.add(line);

    const material = line.material as THREE.LineBasicMaterial;
    let elapsed = 0;
    const fade = (): void => {
      elapsed += 0.04;
      material.opacity = Math.max(0, 0.9 * (1 - elapsed / 0.16));
      if (elapsed >= 0.16) {
        this.scene.remove(line);
        geometry.dispose();
        material.dispose();
      } else {
        requestAnimationFrame(fade);
      }
    };
    requestAnimationFrame(fade);
  }
}
