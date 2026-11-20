import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Input } from './Input';

export class Player {
  readonly controls: PointerLockControls;
  readonly body: RAPIER.RigidBody;
  private readonly input: Input;
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private canJump = false;
  private readonly speed = 7.2;

  constructor(
    camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    physics: RAPIER.World,
    input: Input
  ) {
    this.input = input;
    this.controls = new PointerLockControls(camera, element);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.5, 12)
      .setLinearDamping(4.5)
      .setAngularDamping(1)
      .lockRotations()
      .setCanSleep(false);

    this.body = physics.createRigidBody(bodyDesc);
    physics.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.34).setFriction(0.8).setRestitution(0),
      this.body
    );
  }

  applyInput(): void {
    const velocity = this.body.linvel();
    this.controls.getDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();

    this.movement.set(0, 0, 0);
    if (this.input.isDown('KeyW')) this.movement.add(this.forward);
    if (this.input.isDown('KeyS')) this.movement.sub(this.forward);
    if (this.input.isDown('KeyD')) this.movement.add(this.right);
    if (this.input.isDown('KeyA')) this.movement.sub(this.right);

    if (this.movement.lengthSq() > 0) this.movement.normalize().multiplyScalar(this.speed);

    const grounded = this.body.translation().y <= 1.18;
    this.canJump = grounded;
    let vertical = velocity.y;

    if (grounded && vertical < 0) vertical = -0.5;
    if (this.canJump && this.input.isDown('Space')) {
      vertical = 5.2;
      this.canJump = false;
    }

    this.body.setLinvel({ x: this.movement.x, y: vertical, z: this.movement.z }, true);
  }

  syncCamera(camera: THREE.PerspectiveCamera): void {
    const position = this.body.translation();
    camera.position.set(position.x, position.y + 0.48, position.z);
  }

  get position(): THREE.Vector3 {
    const p = this.body.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
