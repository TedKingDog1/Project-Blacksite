import * as THREE from 'three';
import { TrainingDrone } from './Drone';

/**
 * A fictional autonomous training robot. It inherits the target and damage
 * interface used by the weapon system, but presents as a ground-based unit.
 */
export class SquadBot extends TrainingDrone {
  private readonly bodyParts: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, position: THREE.Vector3, seed: number) {
    super(scene, position, seed);
    // Replace the hovering drone silhouette with a compact, unmistakably
    // artificial training chassis. The inherited target hitboxes remain.
    this.group.children.slice(0, 3).forEach((part) => { part.visible = false; });

    const armor = new THREE.MeshStandardMaterial({ color: 0x3c4b53, metalness: 0.72, roughness: 0.34 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.55, roughness: 0.3 });
    const sensor = new THREE.MeshStandardMaterial({ color: 0x83d9e8, emissive: 0x237d91, emissiveIntensity: 2.1 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.drone = this;
      this.group.add(mesh);
      this.bodyParts.push(mesh);
    };

    add(new THREE.BoxGeometry(0.72, 0.9, 0.42), armor, 0, 0, 0);
    add(new THREE.BoxGeometry(0.48, 0.42, 0.38), armor, 0, 0.68, 0);
    add(new THREE.BoxGeometry(0.32, 0.08, 0.08), sensor, 0, 0.73, -0.205);
    add(new THREE.BoxGeometry(0.18, 0.58, 0.22), armor, -0.49, 0.02, 0);
    add(new THREE.BoxGeometry(0.18, 0.58, 0.22), armor, 0.49, 0.02, 0);
    add(new THREE.BoxGeometry(0.2, 0.66, 0.24), armor, -0.2, -0.72, 0);
    add(new THREE.BoxGeometry(0.2, 0.66, 0.24), armor, 0.2, -0.72, 0);
    add(new THREE.BoxGeometry(0.34, 0.1, 0.46), edge, 0, -1.05, -0.025);
    this.group.position.y = 1.25;
  }

  override update(delta: number, elapsed: number, player: THREE.Vector3, formationTarget?: THREE.Vector3): void {
    super.update(delta, elapsed, player, formationTarget);
    this.group.position.y = 1.25;
    for (const part of this.bodyParts) {
      if (part.position.y > 0.5) part.rotation.y = Math.sin(elapsed * 1.4) * 0.025;
    }
    this.group.rotation.y = Math.atan2(player.x - this.group.position.x, player.z - this.group.position.z);
  }
}
