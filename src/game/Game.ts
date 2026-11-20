import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Input } from './Input';
import { Player } from './Player';
import { createWorld } from './World';
import { TrainingDrone } from './Drone';
import { SquadBot } from './SquadBot';
import { MissionDirector, type MissionSnapshot } from './MissionDirector';
import { PulseProjector, type WeaponLoadout } from './Weapon';
import { HUD } from './HUD';
import { CombatSystem } from './CombatSystem';
import { Ordnance } from './Ordnance';

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
  private combat?: CombatSystem;
  private ordnance?: Ordnance;
  private mission?: MissionDirector;
  private readonly squadOffsets = [
    new THREE.Vector3(-2, 0, -3), new THREE.Vector3(2, 0, -3),
    new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4, 0, 0),
    new THREE.Vector3(-2, 0, 3), new THREE.Vector3(2, 0, 3)
  ];
  private drones: TrainingDrone[] = [];
  private score = 0;
  private missionWave = 1;
  private started = false;
  private disposed = false;
  private physicsAccumulator = 0;
  private startOverlay?: HTMLDivElement;
  private pauseOverlay?: HTMLDivElement;
  private deathOverlay?: HTMLDivElement;
  private missionOverlay?: HTMLDivElement;
  private loadoutOverlay?: HTMLDivElement;
  private loadoutReturn: 'start' | 'pause' = 'start';
  private isAiming = false;
  private defeated = false;

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
    this.renderer?.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onGameKeyDown);
    this.renderer?.domElement.removeEventListener('click', this.onCanvasClick);
    this.player?.controls.removeEventListener('lock', this.onLock);
    this.player?.controls.removeEventListener('unlock', this.onUnlock);
    this.player?.dispose();
    this.weapon?.dispose();
    this.ordnance?.dispose();
    this.hud?.dispose();
    this.combat?.dispose();
    if (this.scene) this.drones.forEach((drone) => drone.dispose(this.scene!));
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
          <div class="objective"><div class="objective-kicker" id="mission-kicker">MISSION 01 // WAVE 1 OF 3</div><div class="objective-text" id="mission-objective">Tag all 6 squad units to advance. Complete all three waves.</div></div>
          <div class="center-reticle"></div>
          <div class="toast" id="toast"></div>
          <div class="ordnance-readout" id="ordnance-readout">PULSE GRENADES 03 <span>//</span> ROCKET CELLS 03</div>
          <div class="hud-bottom">
            <div class="panel"><div class="panel-label">VITALS</div><div class="panel-value health-value"><span id="health-value">100</span><small> / 100</small></div></div>
            <div class="panel" style="text-align:right"><div class="panel-label">EQUIPPED</div><div class="weapon-name" id="weapon-name">PULSE PROJECTOR</div><div class="weapon-note" id="weapon-note">BALANCED ENERGY CELL</div><div class="panel-value" id="ammo-value">24 / 24</div></div>
            <div class="panel" style="text-align:right"><div class="panel-label">TARGET SCORE</div><div class="panel-value" id="score-value">00000</div></div>
          </div>
        </div>
        <div id="start-overlay">
          <div class="overlay-card">
            <div class="overlay-kicker">SINGLE PLAYER // FIELD TEST 001</div>
            <div class="overlay-title">BLACKSITE</div>
            <div class="overlay-copy">The training complex is active. Movement, target acquisition, and equipment systems are online. Enter the range when ready.</div>
            <button class="action-button" id="start-button">ENTER TRAINING COMPLEX</button>
            <button class="secondary-button" id="start-loadout">CUSTOMIZE LOADOUT</button>
            <div class="controls-hint">WASD MOVE · MOUSE LOOK · SPACE JUMP<br>LEFT CLICK FIRE · RIGHT CLICK ADS · 1–3 EQUIP · G GRENADE · Q ROCKET · R RECHARGE · ESC PAUSE</div>
          </div>
        </div>
        <div id="pause-overlay" style="display:none">
          <div class="overlay-card">
            <div class="overlay-kicker">SIMULATION PAUSED</div>
            <div class="overlay-title">ON HOLD</div>
            <div class="overlay-copy">The training range is waiting.</div>
            <button class="action-button" id="resume-button">RESUME SIMULATION</button>
            <button class="secondary-button" id="pause-loadout">EDIT LOADOUT</button>
          </div>
        </div>

        <div id="loadout-overlay" style="display:none">
          <div class="loadout-card">
            <div class="overlay-kicker">ARMORY // CONFIGURATION BAY</div>
            <div class="overlay-title loadout-title">WEAPON SYSTEMS</div>
            <div class="loadout-grid">
              <label class="loadout-field">PRIMARY PLATFORM
                <select id="loadout-weapon"><option value="1">01 // PULSE PROJECTOR</option><option value="2">02 // ARC REPEATER</option><option value="3">03 // NOVA EMITTER</option></select>
              </label>
              <label class="loadout-field">SIGHT MODULE
                <select id="loadout-optic"><option value="reflex">Reflex sight</option><option value="precision">Precision optic</option></select>
              </label>
              <label class="loadout-field">ENERGY CAPACITOR
                <select id="loadout-capacitor"><option value="standard">Standard cell</option><option value="extended">Extended cell (+25% capacity)</option></select>
              </label>
            </div>
            <div class="upgrade-list">
              <label class="upgrade-option"><input id="upgrade-stabilizer" type="checkbox"><span><strong>STABILIZATION ARRAY</strong><small>Reduces energy spread for more consistent shots.</small></span></label>
              <label class="upgrade-option" id="full-auto-option"><input id="upgrade-full-auto" type="checkbox"><span><strong>FULL-AUTO CONVERTER</strong><small>Allows continuous energy discharge while holding fire. Not compatible with Nova burst mode.</small></span></label>
            </div>
            <div class="loadout-note">Changes apply when you confirm the configuration.</div>
            <button class="action-button" id="apply-loadout">APPLY CONFIGURATION</button>
            <button class="secondary-button" id="cancel-loadout">RETURN</button>
          </div>
        </div>
        <div id="mission-overlay" style="display:none">
          <div class="overlay-card">
            <div class="overlay-kicker">PROJECT BLACKSITE // FIELD TEST COMPLETE</div>
            <div class="overlay-title">MISSION CLEAR</div>
            <div class="overlay-copy">All three training waves have been completed. Mission performance logged.</div>
            <button class="action-button" id="replay-mission">RUN SIMULATION AGAIN</button>
          </div>
        </div>
        <div id="death-overlay" style="display:none">
          <div class="overlay-card">
            <div class="overlay-kicker">FIELD TEST 001 // SESSION INTERRUPTED</div>
            <div class="overlay-title">SIMULATION ENDED</div>
            <div class="overlay-copy">Your training run has ended. Re-enter the range to restore your vitals and continue the exercise.</div>
            <button class="action-button" id="respawn-button">RE-ENTER TRAINING RANGE</button>
            <div class="controls-hint">VITALS RESTORED ON RE-ENTRY</div>
          </div>
        </div>
      </div>`;
    this.hud = new HUD(this.root.querySelector<HTMLDivElement>('#hud')!);
    this.startOverlay = this.root.querySelector<HTMLDivElement>('#start-overlay')!;
    this.pauseOverlay = this.root.querySelector<HTMLDivElement>('#pause-overlay')!;
    this.deathOverlay = this.root.querySelector<HTMLDivElement>('#death-overlay')!;
    this.missionOverlay = this.root.querySelector<HTMLDivElement>('#mission-overlay')!;
    this.loadoutOverlay = this.root.querySelector<HTMLDivElement>('#loadout-overlay')!;
  }

  private initializeEngine(): void {
    const viewport = this.root.querySelector<HTMLDivElement>('#viewport')!;
    this.camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 900);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.autoUpdate = true;
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

    const squadCenter = new THREE.Vector3(0, 1.25, -14);
    this.drones = this.squadOffsets.map((offset, index) =>
      new SquadBot(this.scene!, squadCenter.clone().add(offset), index)
    );
    this.mission = new MissionDirector(
      (snapshot) => this.updateMissionDisplay(snapshot),
      (message) => this.hud?.showToast(message)
    );

    this.weapon = new PulseProjector(this.camera, this.scene, this.drones, {
      onAmmoChanged: (current, capacity) => this.hud?.setAmmo(current, capacity),
      onScore: (amount) => {
        this.score += amount;
        this.hud?.setScore(this.score);
        this.mission?.targetTagged();
      },
      onToast: (message) => this.hud?.showToast(message),
      onWeaponChanged: (name, note) => this.hud?.setWeapon(name, note)
    });

    this.ordnance = new Ordnance(this.scene, this.camera, this.drones, {
      onScore: (amount) => { this.score += amount; this.hud?.setScore(this.score); this.mission?.targetTagged(); },
      onToast: (message) => this.hud?.showToast(message),
      onAmmo: (grenades, rockets) => {
        const readout = this.root.querySelector<HTMLElement>('#ordnance-readout');
        if (readout) readout.innerHTML = 'PULSE GRENADES ' + String(grenades).padStart(2, '0') + ' <span>//</span> ROCKET CELLS ' + String(rockets).padStart(2, '0');
      }
    });

    this.combat = new CombatSystem(this.scene, this.player, this.drones, {
      onHealthChanged: (health) => this.hud?.setHealth(health),
      onToast: (message) => this.hud?.showToast(message),
      onDefeated: () => {
        this.defeated = true;
        this.deathOverlay!.style.display = 'grid';
        this.player?.controls.unlock();
      }
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
    this.root.querySelector<HTMLButtonElement>('#replay-mission')?.addEventListener('click', () => {
      this.mission?.reset();
      this.ordnance?.reset();
      this.score = 0;
      this.hud?.setScore(0);
      this.missionOverlay!.style.display = 'none';
      this.started = true;
      this.player?.controls.lock();
    });
    this.root.querySelector<HTMLButtonElement>('#respawn-button')?.addEventListener('click', () => {
      this.combat?.respawn();
      this.ordnance?.reset();
      this.mission?.reset();
      this.ordnance?.reset();
      this.score = 0;
      this.hud?.setScore(0);
      this.defeated = false;
      this.deathOverlay!.style.display = 'none';
      this.player?.controls.lock();
    });

    this.renderer?.domElement.addEventListener('click', this.onCanvasClick);
    this.root.querySelector<HTMLButtonElement>('#start-loadout')?.addEventListener('click', () => this.openLoadout('start'));
    this.root.querySelector<HTMLButtonElement>('#pause-loadout')?.addEventListener('click', () => this.openLoadout('pause'));
    this.root.querySelector<HTMLButtonElement>('#cancel-loadout')?.addEventListener('click', () => this.closeLoadout(false));
    this.root.querySelector<HTMLButtonElement>('#apply-loadout')?.addEventListener('click', () => this.closeLoadout(true));
    this.root.querySelector<HTMLSelectElement>('#loadout-weapon')?.addEventListener('change', this.onLoadoutWeaponChange);
    this.player?.controls.addEventListener('lock', this.onLock);
    this.player?.controls.addEventListener('unlock', this.onUnlock);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onGameKeyDown);
  }

  private frame(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.physics || !this.player) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.started && this.player.controls.isLocked) {
      this.physicsAccumulator += delta;
      const fixedStep = 1 / 60;
      while (this.physicsAccumulator >= fixedStep) {
        this.player.applyInput();
        this.physics.timestep = fixedStep;
        this.physics.step();
        this.physicsAccumulator -= fixedStep;
      }

      this.player.syncCamera(this.camera);
      this.weapon?.update(delta);
      this.ordnance?.update(delta);
      this.combat?.update(delta, 1 + (this.missionWave - 1) * 0.22);
      const playerPosition = this.player.position;
      const patrolPhase = (elapsed * 0.075) % (Math.PI * 2);
      const squadCenter = new THREE.Vector3(
        Math.cos(patrolPhase) * 17,
        1.25,
        -12 + Math.sin(patrolPhase) * 18
      );
      this.drones.forEach((drone, index) =>
        drone.update(delta, elapsed, playerPosition, squadCenter.clone().add(this.squadOffsets[index]))
      );
    } else {
      this.physicsAccumulator = 0;
    }

    const targetFov = this.isAiming ? (this.weapon?.getAimFov() ?? 54) : 76;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 11);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private updateMissionDisplay(snapshot: MissionSnapshot): void {
    const kicker = this.root.querySelector<HTMLElement>('#mission-kicker');
    const objective = this.root.querySelector<HTMLElement>('#mission-objective');
    this.missionWave = snapshot.wave;
    if (kicker) kicker.textContent = 'MISSION 01 // WAVE ' + snapshot.wave + ' OF ' + snapshot.totalWaves;
    if (objective) objective.textContent = snapshot.complete
      ? 'All training waves completed.'
      : 'Tag ' + (snapshot.targetsRequired - snapshot.targetsTagged) + ' more squad units to advance.';
    if (snapshot.complete && this.missionOverlay) {
      this.started = false;
      this.missionOverlay.style.display = 'grid';
      this.player?.controls.unlock();
    }
  }

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  };

  private onCanvasClick = (): void => {
    if (this.started && !this.player?.controls.isLocked && this.pauseOverlay?.style.display !== 'none') {
      this.player?.controls.lock();
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (!this.started || !this.player?.controls.isLocked) return;
    if (event.button === 2) {
      this.isAiming = true;
      this.weapon?.setAiming(true);
      this.root.querySelector('#hud')?.classList.add('aiming');
      event.preventDefault();
    }
    if (event.button === 0) {
      this.weapon?.setTriggerHeld(true);
      this.weapon?.fire();
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.weapon?.setTriggerHeld(false);
    if (event.button === 2) {
      this.isAiming = false;
      this.weapon?.setAiming(false);
      this.root.querySelector('#hud')?.classList.remove('aiming');
    }
  };

  private onContextMenu = (event: MouseEvent): void => { event.preventDefault(); };

  private onLoadoutWeaponChange = (): void => {
    const slot = Number(this.root.querySelector<HTMLSelectElement>('#loadout-weapon')?.value ?? 1);
    const option = this.root.querySelector<HTMLInputElement>('#upgrade-full-auto');
    const wrapper = this.root.querySelector<HTMLElement>('#full-auto-option');
    if (slot === 3 && option) {
      option.checked = false;
      option.disabled = true;
      wrapper?.classList.add('disabled');
    } else if (option) {
      option.disabled = false;
      wrapper?.classList.remove('disabled');
    }
  };

  private openLoadout(from: 'start' | 'pause'): void {
    if (!this.weapon || !this.loadoutOverlay) return;
    this.loadoutReturn = from;
    const loadout = this.weapon.getLoadout();
    (this.root.querySelector('#loadout-weapon') as HTMLSelectElement).value = String(loadout.slot);
    (this.root.querySelector('#loadout-optic') as HTMLSelectElement).value = loadout.optic;
    (this.root.querySelector('#loadout-capacitor') as HTMLSelectElement).value = loadout.capacitor;
    (this.root.querySelector('#upgrade-stabilizer') as HTMLInputElement).checked = loadout.stabilizer;
    (this.root.querySelector('#upgrade-full-auto') as HTMLInputElement).checked = loadout.fullAuto;
    this.onLoadoutWeaponChange();
    this.loadoutOverlay.style.display = 'grid';
    if (from === 'start') this.startOverlay!.style.display = 'none';
    else this.pauseOverlay!.style.display = 'none';
  }

  private closeLoadout(apply: boolean): void {
    if (!this.loadoutOverlay || !this.weapon) return;
    if (apply) {
      const config: WeaponLoadout = {
        slot: Number((this.root.querySelector('#loadout-weapon') as HTMLSelectElement).value),
        optic: (this.root.querySelector('#loadout-optic') as HTMLSelectElement).value as WeaponLoadout['optic'],
        capacitor: (this.root.querySelector('#loadout-capacitor') as HTMLSelectElement).value as WeaponLoadout['capacitor'],
        stabilizer: (this.root.querySelector('#upgrade-stabilizer') as HTMLInputElement).checked,
        fullAuto: (this.root.querySelector('#upgrade-full-auto') as HTMLInputElement).checked
      };
      this.weapon.applyLoadout(config);
    }
    this.loadoutOverlay.style.display = 'none';
    if (this.loadoutReturn === 'start') this.startOverlay!.style.display = 'grid';
    else this.pauseOverlay!.style.display = 'grid';
  };

  private onGameKeyDown = (event: KeyboardEvent): void => {
    if (!this.started || !this.player?.controls.isLocked) return;
    if (event.repeat) return;
    if (event.code === 'KeyR') this.weapon?.reload();
    if (event.code === 'KeyG') this.ordnance?.throwGrenade();
    if (event.code === 'KeyQ') this.ordnance?.launchRocket();
    if (event.code === 'Digit1') this.weapon?.selectWeapon(1);
    if (event.code === 'Digit2') this.weapon?.selectWeapon(2);
    if (event.code === 'Digit3') this.weapon?.selectWeapon(3);
  };

  private onLock = (): void => {
    if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
  };

  private onUnlock = (): void => {
    this.isAiming = false;
    this.weapon?.setAiming(false);
    this.weapon?.setTriggerHeld(false);
    this.root.querySelector('#hud')?.classList.remove('aiming');
    if (!this.started || this.disposed || !this.pauseOverlay || this.defeated) return;
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
