import * as THREE from 'three';
import type { GameState } from '../engine/types';
import { DiceActor3D } from './DiceActor3D';

interface ConfettiPiece {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
}

export class MonopolySceneController {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly diceActor: DiceActor3D;
  private readonly confetti: ConfettiPiece[] = [];
  private disposed = false;
  private rafId = 0;
  private lastTime = performance.now();
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, initialState: GameState) {
    this.container = container;

    const width = Math.max(200, container.clientWidth);
    const height = Math.max(150, container.clientHeight);
    const aspect = width / height;

    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.2, 60);
    this.positionCamera(width, height);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();

    // Mặt sàn hứng bóng đổ trong suốt rộng khắp toàn Sân Giữa
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.ShadowMaterial({ opacity: 0.34 }),
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = 0;
    shadowFloor.receiveShadow = true;
    this.scene.add(shadowFloor);

    this.diceActor = new DiceActor3D(initialState.diceCount);
    this.diceActor.setImmediateValues(initialState.lastDiceValues);
    this.scene.add(this.diceActor.group);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private positionCamera(width: number, height: number): void {
    const aspect = Math.max(0.55, width / Math.max(150, height));
    const scale = aspect < 1.35 ? 1.35 / aspect : 1;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 7.6 * scale, 3.85 * scale);
    this.camera.lookAt(0, 0.45, 0);
    this.camera.updateProjectionMatrix();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight('#FFFDF5', '#0F172A', 1.25);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#FFF7ED', 1.85);
    sun.position.set(4.5, 11, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight('#7DD3FC', 0.55);
    fill.position.set(-4.5, 5.5, -3.2);
    this.scene.add(fill);

    const goldRim = new THREE.PointLight('#FDE68A', 0.9, 12);
    goldRim.position.set(0, 2.2, 3.2);
    this.scene.add(goldRim);
  }

  public setDiceCharging(active: boolean, charge01: number): void {
    this.diceActor.setCharging(active, charge01);
  }

  public setImmediateDice(values: number[]): void {
    this.diceActor.setImmediateValues(values);
  }

  public animateDiceRoll(values: number[], isDouble: boolean, power01 = 0.6): Promise<void> {
    return this.diceActor.animateRoll(values, isDouble, power01);
  }

  public triggerVictoryFireworks(): void {
    const colors = ['#34D399', '#FBBF24', '#38BDF8', '#F472B6', '#A78BFA'];
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
    for (let i = 0; i < 64; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const m = new THREE.Mesh(geo, mat);
      m.position.set((Math.random() - 0.5) * 1.8, 0.3, (Math.random() - 0.5) * 1.4);
      this.scene.add(m);
      this.confetti.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5.6,
          4.0 + Math.random() * 4.2,
          (Math.random() - 0.5) * 4.2,
        ),
        rotSpeed: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      });
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(200, this.container.clientWidth);
    const height = Math.max(150, this.container.clientHeight);
    this.positionCamera(width, height);
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    for (let i = this.confetti.length - 1; i >= 0; i -= 1) {
      const cf = this.confetti[i];
      cf.vel.y -= 9.5 * dt;
      cf.mesh.position.addScaledVector(cf.vel, dt);
      cf.mesh.rotation.x += cf.rotSpeed.x * dt;
      cf.mesh.rotation.y += cf.rotSpeed.y * dt;
      if (cf.mesh.position.y < -1) {
        this.scene.remove(cf.mesh);
        (cf.mesh.material as THREE.Material).dispose();
        this.confetti.splice(i, 1);
      }
    }

    this.diceActor.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.diceActor.dispose();

    const disposeMat = (m: THREE.Material) => {
      if ('map' in m && m.map instanceof THREE.Texture) {
        m.map.dispose();
      }
      m.dispose();
    };
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(disposeMat);
        else disposeMat(obj.material);
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
