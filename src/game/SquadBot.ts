import * as THREE from 'three';
import { TrainingDrone } from './Drone';

/** A fictional autonomous training robot with a procedural walk cycle. */
export class SquadBot extends TrainingDrone {
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly previousPosition = new THREE.Vector3();
  private walkBlend = 0;

  constructor(scene: THREE.Scene, position: THREE.Vector3, seed: number) {
    super(scene, position, seed);
    this.group.children.slice(0, 3).forEach((part) => { part.visible = false; });
    const armor = new THREE.MeshStandardMaterial({ color: 0x3c4b53, metalness: 0.72, roughness: 0.34 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc5a56a, metalness: 0.55, roughness: 0.3 });
    const sensor = new THREE.MeshStandardMaterial({ color: 0x83d9e8, emissive: 0x237d91, emissiveIntensity: 2.1 });
    const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.drone = this; parent.add(mesh);
    };
    this.torso.position.y = 0.12; this.group.add(this.torso);
    add(this.torso, new THREE.BoxGeometry(0.72, 0.9, 0.42), armor, 0, 0, 0);
    add(this.torso, new THREE.BoxGeometry(0.48, 0.42, 0.38), armor, 0, 0.68, 0);
    add(this.torso, new THREE.BoxGeometry(0.32, 0.08, 0.08), sensor, 0, 0.73, -0.205);
    add(this.torso, new THREE.BoxGeometry(0.22, 0.16, 0.46), edge, 0, -0.16, -0.02);
    this.leftArm.position.set(-0.47, 0.38, 0); this.rightArm.position.set(0.47, 0.38, 0);
    this.group.add(this.leftArm, this.rightArm);
    for (const arm of [this.leftArm, this.rightArm]) {
      add(arm, new THREE.BoxGeometry(0.19, 0.56, 0.22), armor, 0, -0.25, 0);
      add(arm, new THREE.BoxGeometry(0.2, 0.18, 0.24), edge, 0, -0.53, -0.01);
    }
    this.leftLeg.position.set(-0.2, -0.43, 0); this.rightLeg.position.set(0.2, -0.43, 0);
    this.group.add(this.leftLeg, this.rightLeg);
    for (const leg of [this.leftLeg, this.rightLeg]) {
      add(leg, new THREE.BoxGeometry(0.21, 0.62, 0.25), armor, 0, -0.3, 0);
      add(leg, new THREE.BoxGeometry(0.34, 0.12, 0.46), edge, 0, -0.62, -0.06);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), edge);
      joint.position.y = 0.02; leg.add(joint);
    }
    this.group.position.copy(position); this.previousPosition.copy(position);
  }

  override update(delta: number, elapsed: number, player: THREE.Vector3, formationTarget?: THREE.Vector3): void {
    super.update(delta, elapsed, player, formationTarget);
    const moved = this.group.position.distanceTo(this.previousPosition);
    this.previousPosition.copy(this.group.position);
    const moving = Math.min(1, moved / Math.max(delta, 0.001) / 1.6);
    this.walkBlend += (moving - this.walkBlend) * Math.min(1, delta * 7);
    const gait = elapsed * 8.5 + this.group.id * 0.7;
    const stride = Math.sin(gait) * 0.58 * this.walkBlend;
    this.leftLeg.rotation.x = stride; this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.x = -stride * 0.62 - 0.12; this.rightArm.rotation.x = stride * 0.62 - 0.12;
    this.torso.position.y = 0.12 + Math.abs(Math.sin(gait)) * 0.045 * this.walkBlend;
    this.torso.rotation.z = Math.sin(gait * 0.5) * 0.025 * this.walkBlend;
    this.group.rotation.y = Math.atan2(player.x - this.group.position.x, player.z - this.group.position.z);
  }
}
