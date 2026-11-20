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

    this.addNode('FIELD GENERATOR', 'Bring the field power unit back online.', -34, -12, 0xb7a36f);
    this.addNode('INTELLIGENCE MAP', 'Recover the marked reconnaissance map.', 34, -12, 0x9aaf83);
    this.addNode('RADIO TRANSMITTER', 'Restore the field radio link.', 0, 48, 0x9aa9a8);
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
      item.light.intensity = item.activated ? 0.12 : active ? 0.65 : 0.08;
      if (active) {
        const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.035;
        item.ring.scale.setScalar(pulse);
        item.beacon.rotation.z = Math.sin(performance.now() * 0.0015) * 0.035;
      }
    });

    const signature = [this.current, this.nearby, this.complete, this.nodes.filter(n => n.activated).length].join(':');
    if (signature !== this.lastPublished) this.publish();
  }

  interact(playerPosition: THREE.Vector3): void {
    if (this.complete) {
      this.onMessage('ALL FIELD OBJECTIVES COMPLETE');
      return;
    }
    const node = this.nodes[this.current];
    if (!node) return;
    const distance = new THREE.Vector2(playerPosition.x - node.position.x, playerPosition.z - node.position.z).length();
    if (distance > this.interactionRange) {
      this.onMessage('MOVE CLOSER TO THE FIELD EQUIPMENT');
      return;
    }

    node.activated = true;
    (node.screen.material as THREE.Material).dispose();
    node.screen.material = new THREE.MeshStandardMaterial({
      color: 0x7d8a65, emissive: 0x26351f, emissiveIntensity: 0.12,
      metalness: 0.05, roughness: 0.9
    });
    node.ring.visible = false;
    node.beacon.visible = false;
    node.light.intensity = 0.12;
    this.onMessage(node.name + ' // COMPLETE');

    this.current++;
    if (this.current >= this.nodes.length) {
      this.complete = true;
      this.onMessage('FIELD OBJECTIVES COMPLETE');
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
        color: 0x8a8065, emissive: 0x17150f, emissiveIntensity: 0.05,
        metalness: 0.02, roughness: 0.92
      });
      node.ring.visible = false;
      node.beacon.visible = false;
      node.light.intensity = 0.08;
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
    // Keep the interaction point offset from the small field marker at the clearing center.
    group.position.set(x + 2.2, 0, z);
    const nodeIndex = this.nodes.length;

    const wood = new THREE.MeshStandardMaterial({ color: 0x584631, roughness: 0.96 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d4139, metalness: 0.22, roughness: 0.82 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x77776a, metalness: 0.48, roughness: 0.72 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0x9b916e, roughness: 1 });
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a8065, emissive: 0x17150f, emissiveIntensity: 0.05,
      metalness: 0.02, roughness: 0.92
    });

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, px: number, py: number, pz: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    // Common timber equipment platform.
    add(new THREE.BoxGeometry(1.8, 0.18, 1.35), wood, 0, 0.16, 0);

    if (nodeIndex === 0) {
      // Portable field generator with fuel tank, exhaust, and a small control panel.
      add(new THREE.BoxGeometry(1.25, 0.9, 0.82), dark, 0, 0.72, 0);
      add(new THREE.BoxGeometry(1.34, 0.1, 0.9), metal, 0, 1.22, 0);
      const tank = add(new THREE.CylinderGeometry(0.25, 0.25, 0.92, 12), metal, -0.72, 0.65, 0);
      tank.rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.55, 8), dark, 0.48, 1.35, -0.2);
      add(new THREE.BoxGeometry(0.52, 0.32, 0.045), screenMaterial, 0.1, 0.77, -0.43);
      add(new THREE.BoxGeometry(0.16, 0.16, 0.05), metal, -0.34, 0.82, -0.46);
    } else if (nodeIndex === 1) {
      // Field map table, folded paper map, and a wooden document case.
      for (const px of [-0.62, 0.62]) {
        for (const pz of [-0.42, 0.42]) add(new THREE.BoxGeometry(0.12, 0.92, 0.12), wood, px, 0.58, pz);
      }
      add(new THREE.BoxGeometry(1.65, 0.14, 1.15), wood, 0, 1.08, 0);
      const map = add(new THREE.PlaneGeometry(1.35, 0.82), canvas, 0, 1.16, 0);
      map.rotation.x = -Math.PI / 2;
      const caseBox = add(new THREE.BoxGeometry(0.62, 0.24, 0.5), dark, 0.48, 1.28, -0.18);
      caseBox.rotation.y = -0.15;
      add(new THREE.BoxGeometry(0.42, 0.055, 0.035), screenMaterial, 0.48, 1.42, -0.45);
    } else {
      // Field radio cabinet, dial plate, and a tall antenna mast.
      add(new THREE.BoxGeometry(1.05, 1.0, 0.72), oliveMaterial(), 0, 0.72, 0);
      add(new THREE.BoxGeometry(0.66, 0.46, 0.055), screenMaterial, 0, 0.86, -0.39);
      for (let i = 0; i < 3; i++) {
        const dial = add(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 12), metal, -0.28 + i * 0.28, 0.42, -0.4);
        dial.rotation.x = Math.PI / 2;
      }
      add(new THREE.CylinderGeometry(0.035, 0.055, 2.8, 8), metal, 0.72, 1.6, 0.12);
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 6), dark, 0.72, 2.7, 0.12);
    }

    // A weathered signboard replaces the floating holographic label.
    add(new THREE.BoxGeometry(2.25, 0.52, 0.12), wood, 0, 2.15, 0.52);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const context = labelCanvas.getContext('2d');
    if (context) {
      context.fillStyle = '#584631';
      context.fillRect(0, 0, 512, 128);
      context.strokeStyle = '#b6a27b';
      context.lineWidth = 8;
      context.strokeRect(5, 5, 502, 118);
      context.fillStyle = '#eee5ce';
      context.font = 'bold 34px monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(name, 256, 64, 480);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.12, 0.46),
      new THREE.MeshBasicMaterial({ map: labelTexture, transparent: false, toneMapped: false })
    );
    label.position.set(0, 2.15, 0.455);
    group.add(label);

    // A muted chalk ring and small cloth pennant mark the currently active field objective.
    const ring = add(new THREE.TorusGeometry(1.55, 0.045, 6, 40),
      new THREE.MeshStandardMaterial({ color: 0xa18e69, roughness: 1 }), 0, 0.11, 0);
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;

    add(new THREE.CylinderGeometry(0.035, 0.05, 2.1, 6), wood, -1.05, 1.05, 0.72);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0.48);
    flagShape.lineTo(0.78, 0.22);
    flagShape.lineTo(0, -0.04);
    flagShape.closePath();
    const beacon = add(new THREE.ShapeGeometry(flagShape), new THREE.MeshStandardMaterial({
      color, side: THREE.DoubleSide, roughness: 1
    }), -0.64, 1.72, 0.72);
    beacon.visible = false;

    const light = new THREE.PointLight(0xe1c58b, 0.08, 5, 2);
    light.position.set(0, 1.8, 0);
    group.add(light);

    this.scene.add(group);
    this.nodes.push({
      name, description, position: new THREE.Vector3(x + 2.2, 0, z),
      color, group, ring, beacon, light,
      screen: this.findStatusMesh(group), activated: false
    });
  }

  private findStatusMesh(group: THREE.Group): THREE.Mesh {
    // The small status panel is the first mesh added after the main equipment housing.
    const candidates: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) candidates.push(object);
    });
    const panel = candidates.find(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      return material?.color?.getHex() === 0x8a8065;
    });
    return panel ?? candidates[1];
  }

  private publish(): void {
    const node = this.nodes[this.current];
    this.lastPublished = [this.current, this.nearby, this.complete, this.nodes.filter(n => n.activated).length].join(':');
    this.onChange({
      stage: Math.min(this.current + 1, this.nodes.length),
      total: this.nodes.length,
      activated: this.nodes.filter(item => item.activated).length,
      name: node?.name ?? 'FIELD OBJECTIVES COMPLETE',
      description: node?.description ?? 'All field objectives are complete.',
      complete: this.complete,
      nearby: this.nearby
    });
  }
}

function oliveMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x535742, roughness: 0.9 });
}
