import * as THREE from 'three';

export class TrainingDrone {
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly glow: THREE.PointLight;
  private health = 3;
  private respawnTimer = 0;
  private phase: number;
  private readonly home: THREE.Vector3;
  private active = true;

  constructor(scene: THREE.Scene, position: THREE.Vector3, seed: number) {
    this.home = position.clone();
    this.phase = seed * 1.7;

    const shell = new THREE.MeshStandardMaterial({
      color: 0x58666d, metalness: 0.72, roughness: 0.32
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xc5a56a, emissive: 0x8a5d20, emissiveIntensity: 1.4,
      metalness: 0.45, roughness: 0.3
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ad7e8, emissive: 0x167c9a, emissiveIntensity: 2.4,
      metalness: 0.25, roughness: 0.25
    });

    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), coreMaterial);
    this.core.castShadow = true;
    this.core.userData.drone = this;
    this.group.add(this.core);

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.055, 8, 28), shell);
    this.ring.rotation.x = Math.PI / 2.6;
    this.ring.userData.drone = this;
    this.group.add(this.ring);

    const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), accent);
    antenna.position.y = 0.55;
    antenna.userData.drone = this;
    this.group.add(antenna);

    this.glow = new THREE.PointLight(0x42c7e6, 2.5, 5);
    this.group.add(this.glow);

    this.group.position.copy(position);
    scene.add(this.group);
  }

  update(delta: number, elapsed: number, player: THREE.Vector3): void {
    if (!this.active) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }

    const offset = new THREE.Vector3(
      Math.sin(elapsed * 0.55 + this.phase) * 2.2,
      Math.sin(elapsed * 1.4 + this.phase) * 0.45,
      Math.cos(elapsed * 0.48 + this.phase) * 2.2
    );
    const desired = this.home.clone().add(offset);
    const distance = this.group.position.distanceTo(player);

    // Training targets drift away when approached, creating a moving aim challenge.
    if (distance < 8) {
      const away = this.group.position.clone().sub(player).setY(0).normalize();
      desired.addScaledVector(away, (8 - distance) * 0.7);
    }

    this.group.position.lerp(desired, Math.min(1, delta * 1.8));
    this.group.rotation.y += delta * 0.65;
    this.ring.rotation.z += delta * 0.8;
    this.glow.intensity = 2.0 + Math.sin(elapsed * 4 + this.phase) * 0.6;
  }

  registerHit(): boolean {
    if (!this.active) return false;
    this.health--;
    const material = this.core.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 4;
    if (this.health <= 0) {
      this.active = false;
      this.respawnTimer = 3.5;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  private respawn(): void {
    this.health = 3;
    this.active = true;
    this.group.visible = true;
    this.group.position.copy(this.home);
    (this.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.4;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
}
