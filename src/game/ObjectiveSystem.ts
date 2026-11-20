import * as THREE from 'three';

export interface ObjectiveSnapshot {
  stage: number;
  total: number;
  activated: number;
  name: string;
  description: string;
  complete: boolean;
  nearby: boolean;
}

interface ObjectiveNode {
  name: string;
  description: string;
  position: THREE.Vector3;
  color: number;
  group: THREE.Group;
  ring: THREE.Mesh;
  beacon: THREE.Mesh;
  light: THREE.PointLight;
  screen: THREE.Mesh;
  activated: boolean;
}

export class ObjectiveSystem {
  private readonly scene: THREE.Scene;
  private readonly nodes: ObjectiveNode[] = [];
  private readonly onChange: (snapshot: ObjectiveSnapshot) => void;
  private readonly onMessage: (message: string) => void;
  private readonly interactionRange = 3.8;
  private current = 0;
  private nearby = false;
  private complete = false;
  private lastPublished = '';

  constructor(
    scene: THREE.Scene,
    onChange: (snapshot: ObjectiveSnapshot) => void,
    onMessage: (message: string) => void
  ) {
    this.scene = scene;
    this.onChange = onChange;
    this.onMessage = onMessage;

    this.addNode('AUXILIARY POWER', 'Restore power to the facility network.', -34, -12, 0x79d6e8);
    this.addNode('DATA ARCHIVE', 'Retrieve the facility survey record.', 34, -12, 0xd9b879);
    this.addNode('COMMUNICATIONS ARRAY', 'Synchronize the remote communications link.', 0, 48, 0x91d8a5);
    this.publish();
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    const node = this.nodes[this.current];
    this.nearby = !this.complete && !!node &&
      new THREE.Vector2(playerPosition.x - node.position.x, playerPosition.z - node.position.z).length() <= this.interactionRange;

    this.nodes.forEach((item, index) => {
      const active = !item.activated && index === this.current && !this.complete;
      item.ring.visible = active;
      item.beacon.visible = active;
      item.light.intensity = item.activated ? 1.1 : active ? 4.5 : 0.35;
      if (active) {
        const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.08;
        item.ring.scale.setScalar(pulse);
        item.beacon.rotation.y += delta * 1.4;
        item.beacon.rotation.x += delta * 0.7;
      }
    });

    const signature = [this.current, this.nearby, this.complete, this.nodes.filter(n => n.activated).length].join(':');
    if (signature !== this.lastPublished) this.publish();
  }

  interact(playerPosition: THREE.Vector3): void {
    if (this.complete) {
      this.onMessage('ALL FACILITY SYSTEMS RESTORED');
      return;
    }
    const node = this.nodes[this.current];
    if (!node) return;
    const distance = new THREE.Vector2(playerPosition.x - node.position.x, playerPosition.z - node.position.z).length();
    if (distance > this.interactionRange) {
      this.onMessage('MOVE CLOSER TO THE ACTIVE TERMINAL');
      return;
    }

    node.activated = true;
    (node.screen.material as THREE.Material).dispose();
    node.screen.material = new THREE.MeshStandardMaterial({
      color: 0x75d7a1, emissive: 0x238c59, emissiveIntensity: 1.6,
      metalness: 0.2, roughness: 0.35
    });
    node.ring.visible = false;
    node.beacon.visible = false;
    node.light.intensity = 1.1;
    this.onMessage(node.name + ' // COMPLETE');

    this.current++;
    if (this.current >= this.nodes.length) {
      this.complete = true;
      this.onMessage('FACILITY RESTORED // MISSION COMPLETE');
    } else {
      this.onMessage('NEXT: ' + this.nodes[this.current].name);
    }
    this.publish();
  }

  reset(): void {
    this.current = 0;
    this.nearby = false;
    this.complete = false;
    for (const node of this.nodes) {
      node.activated = false;
      (node.screen.material as THREE.Material).dispose();
      node.screen.material = new THREE.MeshStandardMaterial({
        color: 0x173c46, emissive: node.color, emissiveIntensity: 0.75,
        metalness: 0.25, roughness: 0.38
      });
      node.ring.visible = false;
      node.beacon.visible = false;
      node.light.intensity = 0.35;
    }
    this.publish();
  }

  dispose(): void {
    for (const node of this.nodes) {
      this.scene.remove(node.group);
      node.group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(material => {
            if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
            material.dispose();
          });
        } else if (mesh.material) {
          if (mesh.material instanceof THREE.SpriteMaterial) mesh.material.map?.dispose();
          mesh.material.dispose();
        }
      });
    }
    this.nodes.length = 0;
  }

  private addNode(name: string, description: string, x: number, z: number, color: number): void {
    const group = new THREE.Group();
    // Offset the terminal from the sector mast already placed at the pad center.
    group.position.set(x + 2.2, 0, z);

    const dark = new THREE.MeshStandardMaterial({ color: 0x26353c, metalness: 0.72, roughness: 0.38 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8b9697, metalness: 0.62, roughness: 0.42 });
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x173c46, emissive: color, emissiveIntensity: 0.75,
      metalness: 0.25, roughness: 0.38
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.9), dark);
    base.position.y = 0.16;
    base.castShadow = true;
    group.add(base);

    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.05, 0.58), dark);
    pedestal.position.set(0, 0.76, 0);
    pedestal.castShadow = true;
    group.add(pedestal);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.68), trim);
    cap.position.set(0, 1.32, 0);
    group.add(cap);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.055), screenMaterial);
    screen.position.set(0, 0.98, -0.31);
    group.add(screen);

    const status = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 0.035),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8 }));
    status.position.set(0, 1.32, -0.35);
    group.add(status);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.055, 8, 48),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, metalness: 0.3, roughness: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    ring.visible = false;
    group.add(ring);

    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
    beacon.position.y = 2.25;
    beacon.visible = false;
    group.add(beacon);

    const light = new THREE.PointLight(color, 0.35, 10, 2);
    light.position.set(0, 2.1, 0);
    group.add(light);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(7,13,17,0.82)';
      context.fillRect(0, 0, 512, 96);
      context.strokeStyle = '#c5a56a';
      context.lineWidth = 3;
      context.strokeRect(2, 2, 508, 92);
      context.fillStyle = '#e9eef2';
      context.font = '600 31px monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(name, 256, 49, 480);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    label.scale.set(5.2, 0.98, 1);
    label.position.set(0, 3.1, 0);
    group.add(label);

    this.scene.add(group);
    this.nodes.push({
      name, description, position: new THREE.Vector3(x + 2.2, 0, z), color,
      group, ring, beacon, light, screen, activated: false
    });
  }

  private publish(): void {
    const node = this.nodes[this.current];
    this.lastPublished = [this.current, this.nearby, this.complete, this.nodes.filter(n => n.activated).length].join(':');
    this.onChange({
      stage: Math.min(this.current + 1, this.nodes.length),
      total: this.nodes.length,
      activated: this.nodes.filter(item => item.activated).length,
      name: node?.name ?? 'FACILITY RESTORED',
      description: node?.description ?? 'All facility systems are online.',
      complete: this.complete,
      nearby: this.nearby
    });
  }
}
