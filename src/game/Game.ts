import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Input } from './Input';
import { Player } from './Player';
import { createWorld } from './World';
import { TrainingDrone } from './Drone';
import { PulseProjector } from './Weapon';
import { HUD } from './HUD';

export class Game {
  private readonly root: HTMLDivElement;
  private readonly input = new Input();
  private readonly clock = new THREE.Clock();
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private physics?: RAPIER.World;
  private player?: Player;
  private weapon?: PulseProjector;
  private hud?: HUD;
  private drones: TrainingDrone[] = [];
  private animationFrame = 0;
  private score = 0;
  private started = false;
  private disposed = false;
  private startOverlay?: HTMLDivElement;
  private pauseOverlay?: HTMLDivElement;
  private pointerWasLocked = false;

  constructor(root: HTMLDivElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    try {
      await RAPIER.init();
      if (this.disposed) return;
      this.buildInterface();
      this.initializeEngine();
      this.initializeWorld();
      this.initializeGameplay();
      this.hideLoading();
      this.bindEvents();
      this.renderer?.setAnimationLoop(() => this.frame());
    } catch (error) {
      console.error('BLACKSITE failed to initialize:', error);
      this.showFatalError(error);
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.renderer?.setAnimationLoop(null);
    this.player?.dispose();
    this.weapon?.dispose();
    this.hud?.dispose();
    this.drones.forEach((drone) => drone.dispose(this.scene!));
    this.input.dispose();
    this.renderer?.dispose();
    this.physics?.free();
  }

  private buildInterface(): void {
    this.root.innerHTML = `
      <div id="game-shell">
        <div id="viewport"></div>
        <div id="hud">
          <div class="hud-top">
            <div><div class="brand">PROJECT <span>BLACKSITE</span></div><div class="mission-label">TRAINING COMPLEX // SECTOR 04</div></div>
            <div class="status-block"><div class="status-label">SIMULATION STATUS</div><div class="status-value">LIVE <span style="color:#c5a56a">●</span></div></div>
          </div>
          <div class="objective"><div class="objective-kicker">TRAINING DIRECTIVE 01</div><div class="objective-text">Navigate the compound and tag the autonomous training drones. Each target requires three successful pulse hits.</div></div>
          <div class="center-reticle"></div>
          <div class="toast" id="toast"></div>
          <div class="hud-bottom">
            <div class="panel"><div class="panel-label">VITALS</div><div class="panel-value health-value"><span id="health-value">100</span><small> / 100</small></div></div>
            <div class="panel" style="text-align:right"><div class="panel-label">EQUIPPED</div><div class="weapon-name">PULSE PROJECTOR</div><div class="weapon-note">ENERGY CELL // NON-LETHAL SIMULATION</div><div class="panel-value" id="ammo-value">24 / 24</div></div>
            <div class="panel" style="text-align:right"><div class="panel-label">TARGET SCORE</div><div class="panel-value" id="score-value">00000</div></div>
          </div>
        </div>
        <div id="start-overlay">
          <div class="overlay-card">
            <div class="overlay-kicker">SINGLE PLAYER // FIELD TEST 001</div>
            <div class="overlay-title">BLACKSITE</div>
            <div class="overlay-copy">The training complex is active. Movement, target acquisition, and equipment systems are online. Enter the range when ready.</div>
            <button class="action-button" id="start-button">ENTER TRAINING COMPLEX</button>
            <div class="controls-hint">WASD MOVE &nbsp;·&nbsp; MOUSE LOOK &nbsp;·&nbsp; SPACE JUMP<br>LEFT CLICK PULSE &nbsp;·&nbsp; R RECHARGE &nbsp;·&nbsp; ESC PAUSE</div>
          </div>
        </div>
        <div id="pause-overlay" style="display:none">
          <div class="overlay-card">
            <div class="overlay-kicker">SIMULATION PAUSED</div>
            <div class="overlay-title">ON HOLD</div>
            <div class="overlay-copy">The training range is waiting.</div>
            <button class="action-button" id="resume-button">RESUME SIMULATION</button>
          </div>
        </div>
      </div>`;
    this.hud = new HUD(this.root.querySelector<HTMLDivElement>('#hud')!);
    this.startOverlay = this.root.querySelector<HTMLDivElement>('#start-overlay')!;
    this.pauseOverlay = this.root.querySelector<HTMLDivElement>('#pause-overlay')!;
  }

  private initializeEngine(): void {
    const viewport = this.root.querySelector<HTMLDivElement>('#viewport')!;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 220);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    viewport.appendChild(this.renderer.domElement);
  }

  private initializeWorld(): void {
    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.physics.timestep = 1 / 60;
    const world = createWorld(this.physics);
    this.scene = world.scene;
  }

  private initializeGameplay(): void {
    if (!this.scene || !this.camera || !this.physics || !this.renderer) return;

    this.player = new Player(this.camera, this.renderer.domElement, this.physics, this.input);

    const dronePositions = [
      new THREE.Vector3(-14, 3.2, -16),
      new THREE.Vector3(0, 4.2, -22),
      new THREE.Vector3(15, 3.5, -15),
      new THREE.Vector3(-24, 3.4, 5),
      new THREE.Vector3(24, 4, 5),
      new THREE.Vector3(0, 3.8, 18)
    ];
    this.drones = dronePositions.map((position, index) => new TrainingDrone(this.scene!, position, index));

    this.weapon = new PulseProjector(this.camera, this.scene, this.drones, {
      onAmmoChanged: (current, capacity) => this.hud?.setAmmo(current, capacity),
      onScore: (amount) => {
        this.score += amount;
        this.hud?.setScore(this.score);
      },
      onToast: (message) => this.hud?.showToast(message)
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    this.root.querySelector<HTMLButtonElement>('#start-button')?.addEventListener('click', () => {
      this.started = true;
      this.startOverlay!.style.display = 'none';
      this.player?.controls.lock();
    });
    this.root.querySelector<HTMLButtonElement>('#resume-button')?.addEventListener('click', () => {
      this.pauseOverlay!.style.display = 'none';
      this.player?.controls.lock();
    });

    this.renderer?.domElement.addEventListener('click', this.onCanvasClick);
    this.player?.controls.addEventListener('lock', this.onLock);
    this.player?.controls.addEventListener('unlock', this.onUnlock);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('keydown', this.onGameKeyDown);
  }

  private frame(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.physics || !this.player) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.started && this.player.controls.isLocked) {
      this.player.applyInput();
      this.physics.timestep = Math.min(delta, 1 / 30);
      this.physics.step();
      this.player.syncCamera(this.camera);
      this.weapon?.update(delta);
      const playerPosition = this.player.position;
      this.drones.forEach((drone) => drone.update(delta, elapsed, playerPosition));
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  };

  private onCanvasClick = (): void => {
    if (this.started && !this.player?.controls.isLocked && this.pauseOverlay?.style.display !== 'none') {
      this.player?.controls.lock();
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && this.started && this.player?.controls.isLocked) this.weapon?.fire();
  };

  private onGameKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyR' && this.started && this.player?.controls.isLocked) this.weapon?.reload();
  };

  private onLock = (): void => {
    this.pointerWasLocked = true;
    if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
  };

  private onUnlock = (): void => {
    if (!this.started || this.disposed || !this.pauseOverlay) return;
    this.pauseOverlay.style.display = 'grid';
  };

  private hideLoading(): void {
    this.root.querySelector('#loading-screen')?.remove();
  }

  private showFatalError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.root.innerHTML = `<div style="padding:32px;color:#f1e8d7;font:14px monospace;background:#090d12;min-height:100%">BLACKSITE INITIALIZATION FAILED<br><br><span style="color:#d39b75">${message.replace(/[&<>"]/g, '')}</span><br><br>Check the browser console for details.</div>`;
  }
}
