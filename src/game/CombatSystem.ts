import * as THREE from 'three';
import { Player } from './Player';
import { TrainingDrone } from './Drone';

interface EnergyPulse {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface CombatEvents {
  onHealthChanged: (health: number) => void;
  onToast: (message: string) => void;
  onDefeated: () => void;
}

export class CombatSystem {
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly drones: TrainingDrone[];
  private readonly events: CombatEvents;
  private readonly geometry = new THREE.SphereGeometry(0.17, 10, 8);
  private readonly material = new THREE.MeshStandardMaterial({
    color: 0xffa66b, emissive: 0xd94b19, emissiveIntensity: 2.8, roughness: 0.25
  });
  private readonly pulses: EnergyPulse[] = [];
  private health = 100;
  private damageCooldown = 0;
  private defeated = false;

  constructor(scene: THREE.Scene, player: Player, drones: TrainingDrone[], events: CombatEvents) {
    this.scene = scene;
    this.player = player;
    this.drones = drones;
    this.events = events;
    this.events.onHealthChanged(this.health);
  }

  update(delta: number): void {
    if (this.defeated) return;
    this.damageCooldown = Math.max(0, this.damageCooldown - delta);
    const playerPosition = this.player.position;
    for (const drone of this.drones) {
      if (drone.shouldFire(delta, playerPosition)) this.launchPulse(drone.position, playerPosition);
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      pulse.life -= delta;
      pulse.mesh.position.addScaledVector(pulse.velocity, delta);
      if (pulse.mesh.position.distanceTo(playerPosition) < 0.85) {
        this.removePulse(i);
        this.applyDamage();
      } else if (pulse.life <= 0) this.removePulse(i);
    }
  }

  respawn(): void {
    this.clearPulses();
    this.health = 100;
    this.damageCooldown = 0;
    this.defeated = false;
    this.player.body.setTranslation({ x: 0, y: 1.5, z: 12 }, true);
    this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.events.onHealthChanged(this.health);
    this.events.onToast('SIMULATION RESUMED');
  }

  dispose(): void {
    this.clearPulses();
    this.geometry.dispose();
    this.material.dispose();
  }

  private launchPulse(origin: THREE.Vector3, target: THREE.Vector3): void {
    if (this.pulses.length >= 18) this.removePulse(0);
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.copy(origin);
    const aimPoint = target.clone().add(new THREE.Vector3(0, 0.25, 0));
    const velocity = aimPoint.sub(origin).normalize().multiplyScalar(13);
    this.scene.add(mesh);
    this.pulses.push({ mesh, velocity, life: 3.5 });
  }

  private applyDamage(): void {
    if (this.damageCooldown > 0 || this.defeated) return;
    this.damageCooldown = 0.35;
    this.health = Math.max(0, this.health - 15);
    this.events.onHealthChanged(this.health);
    if (this.health === 0) {
      this.defeated = true;
      this.clearPulses();
      this.events.onDefeated();
    } else this.events.onToast('SIMULATION HIT — VITALS ' + this.health + '%');
  }

  private clearPulses(): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) this.removePulse(i);
  }

  private removePulse(index: number): void {
    const [pulse] = this.pulses.splice(index, 1);
    if (pulse) this.scene.remove(pulse.mesh);
  }
}
