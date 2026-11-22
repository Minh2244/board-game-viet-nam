import * as THREE from 'three';
import { gameAudio } from '../audio/gameAudio';
import { CO_TY_PHU_CHARACTERS } from '../data/characters';
import type { PlayerState } from '../engine/types';
import { getPawnSlotPosition, getTileTransform } from './boardLayout';

interface PawnEntry {
  playerId: string;
  landHex: string;
  root: THREE.Group;
  tokenBody: THREE.Group;
  rimMat: THREE.MeshStandardMaterial;
  shadowMesh: THREE.Mesh;
  auraMesh: THREE.Mesh;
  auraMat: THREE.MeshBasicMaterial;
  animating: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function createJetPlaneMesh(): THREE.Group {
  const jet = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.25, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#0EA5E9', roughness: 0.3, metalness: 0.2 });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.96, 12), bodyMat);
  body.rotation.x = Math.PI / 2;
  jet.add(body);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.32), accentMat);
  wings.position.z = -0.05;
  jet.add(wings);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.16), accentMat);
  tail.position.z = -0.38;
  jet.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.2), accentMat);
  fin.position.set(0, 0.14, -0.36);
  jet.add(fin);

  return jet;
}

export class PawnActor3D {
  public readonly group = new THREE.Group();
  private readonly entries = new Map<string, PawnEntry>();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly loadedTextures: THREE.Texture[] = [];
  private readonly baseCylGeo: THREE.CylinderGeometry;
  private readonly bezelRingGeo: THREE.RingGeometry;
  private readonly portraitGeo: THREE.CircleGeometry;
  private readonly shadowGeo: THREE.PlaneGeometry;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly auraGeo: THREE.RingGeometry;
  private readonly waveGeo: THREE.RingGeometry;
  private readonly bezelMat: THREE.MeshStandardMaterial;
  private readonly shockwaves: ShockwaveRing[] = [];
  private readonly planeMesh: THREE.Group;
  private activePlayerId = '';
  private elapsed = 0;

  constructor(players: readonly PlayerState[]) {
    this.baseCylGeo = new THREE.CylinderGeometry(0.35, 0.39, 0.16, 28);
    this.baseCylGeo.translate(0, 0.08, 0);

    this.bezelRingGeo = new THREE.RingGeometry(0.3, 0.355, 28);
    this.bezelRingGeo.rotateX(-Math.PI / 2);

    this.portraitGeo = new THREE.CircleGeometry(0.305, 28);
    this.portraitGeo.rotateX(-Math.PI / 2);

    this.bezelMat = new THREE.MeshStandardMaterial({
      color: '#FEF3C7',
      roughness: 0.25,
      metalness: 0.45,
    });

    this.shadowGeo = new THREE.PlaneGeometry(0.88, 0.88);
    this.shadowGeo.rotateX(-Math.PI / 2);
    const shadowTex = createContactShadowTexture();
    this.loadedTextures.push(shadowTex);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });

    this.auraGeo = new THREE.RingGeometry(0.4, 0.54, 32);
    this.auraGeo.rotateX(-Math.PI / 2);

    this.waveGeo = new THREE.RingGeometry(0.3, 0.44, 28);
    this.waveGeo.rotateX(-Math.PI / 2);

    for (const p of players) {
      const charInfo =
        CO_TY_PHU_CHARACTERS.find((c) => c.id === p.characterId) ?? CO_TY_PHU_CHARACTERS[0];
      const tex = this.textureLoader.load(charInfo.avatarUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.loadedTextures.push(tex);

      const rimMat = new THREE.MeshStandardMaterial({
        color: p.landHex,
        roughness: 0.32,
        metalness: 0.18,
      });

      const baseMesh = new THREE.Mesh(this.baseCylGeo, rimMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;

      const bezelMesh = new THREE.Mesh(this.bezelRingGeo, this.bezelMat);
      bezelMesh.position.y = 0.163;

      const portraitMat = new THREE.MeshBasicMaterial({
        map: tex,
      });
      const portraitMesh = new THREE.Mesh(this.portraitGeo, portraitMat);
      portraitMesh.position.y = 0.166;

      const tokenBody = new THREE.Group();
      tokenBody.add(baseMesh);
      tokenBody.add(bezelMesh);
      tokenBody.add(portraitMesh);

      const shadowMesh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      shadowMesh.position.y = 0.014;

      const auraMat = new THREE.MeshBasicMaterial({
        color: p.landHex,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const auraMesh = new THREE.Mesh(this.auraGeo, auraMat);
      auraMesh.position.y = 0.022;

      const root = new THREE.Group();
      root.add(shadowMesh);
      root.add(auraMesh);
      root.add(tokenBody);
      this.group.add(root);

      this.entries.set(p.id, {
        playerId: p.id,
        landHex: p.landHex,
        root,
        tokenBody,
        rimMat,
        shadowMesh,
        auraMesh,
        auraMat,
        animating: false,
      });
    }

    this.planeMesh = createJetPlaneMesh();
    this.planeMesh.visible = false;
    this.group.add(this.planeMesh);

    this.syncLayout(players, players[0]?.id ?? '');
  }

  private spawnLandingWave(x: number, z: number, hexColor: string): void {
    const mat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.waveGeo, mat);
    mesh.position.set(x, 0.032, z);
    this.group.add(mesh);
    this.shockwaves.push({ mesh, mat, age: 0, maxAge: 0.34 });
  }

  public syncLayout(players: readonly PlayerState[], activePlayerId: string): void {
    this.activePlayerId = activePlayerId;

    const groups = new Map<number, PlayerState[]>();
    for (const p of players) {
      const list = groups.get(p.position) ?? [];
      list.push(p);
      groups.set(p.position, list);
    }

    for (const p of players) {
      const entry = this.entries.get(p.id);
      if (!entry) continue;
      entry.root.visible = !p.isBankrupt;
      if (p.isBankrupt) continue;

      entry.landHex = p.landHex;
      entry.rimMat.color.set(p.landHex);
      entry.auraMat.color.set(p.landHex);
      if (entry.animating) continue;

      const tileGroup = groups.get(p.position) ?? [p];
      const slotIdx = tileGroup.findIndex((item) => item.id === p.id);
      const pos = getPawnSlotPosition(p.position, Math.max(0, slotIdx), tileGroup.length, p.inJail);
      entry.root.position.copy(pos);
      entry.tokenBody.scale.set(1, 1, 1);
      entry.tokenBody.rotation.set(0, 0, 0);
      const s = tileGroup.length >= 3 ? 0.82 : 0.95;
      entry.root.scale.set(s, s, s);
    }
  }

  /** Nhảy co giãn nhún bật sinh động qua từng ô + sóng chạm đất + nháy sáng ô dẫm qua */
  public animateStepPath(
    playerId: string,
    path: number[],
    backwards: boolean,
    onStepTile?: (tileIndex: number) => void,
  ): Promise<void> {
    const entry = this.entries.get(playerId);
    if (!entry || path.length === 0) return Promise.resolve();

    entry.animating = true;
    const stepMs = 175;

    return new Promise((resolve) => {
      let idx = 0;
      let hopStartPos = entry.root.position.clone();
      let hopTargetTf = getTileTransform(path[0]);
      let hopStartTime = performance.now();
      gameAudio.playPawnHop(0, backwards);

      const tick = (now: number) => {
        const raw = (now - hopStartTime) / stepMs;
        const t = Math.min(1, Math.max(0, raw));
        const tx = hopTargetTf.x;
        const tz = hopTargetTf.z;

        // Pha 1 (0..0.15): Nhún lấy đà
        if (t < 0.15) {
          const ct = t / 0.15;
          entry.root.position.set(hopStartPos.x, 0.03, hopStartPos.z);
          entry.tokenBody.scale.set(1 + ct * 0.2, 1 - ct * 0.28, 1 + ct * 0.2);
          entry.shadowMesh.scale.setScalar(1.06);
        } else if (t < 0.88) {
          // Pha 2 (0.15..0.88): Bay vòng cung + vươn người
          const at = (t - 0.15) / 0.73;
          const ease = at < 0.5 ? 2 * at * at : 1 - Math.pow(-2 * at + 2, 2) / 2;
          const arc = Math.sin(at * Math.PI);
          entry.root.position.x = hopStartPos.x + (tx - hopStartPos.x) * ease;
          entry.root.position.z = hopStartPos.z + (tz - hopStartPos.z) * ease;
          entry.root.position.y = 0.03 + arc * 0.72;
          const stretch = 1 + arc * 0.22;
          entry.tokenBody.scale.set(1 - arc * 0.12, stretch, 1 - arc * 0.12);
          entry.shadowMesh.scale.setScalar(Math.max(0.55, 1 - arc * 0.35));
        } else {
          // Pha 3 (0.88..1): Tiếp đất nhún nảy nhẹ
          const lt = (t - 0.88) / 0.12;
          const bounce = Math.sin(lt * Math.PI);
          entry.root.position.set(tx, 0.03, tz);
          entry.tokenBody.scale.set(1 + bounce * 0.18, 1 - bounce * 0.22, 1 + bounce * 0.18);
          entry.shadowMesh.scale.setScalar(1.04);
        }

        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }

        // Chạm đích ô -> tạo sóng lan + chớp sáng ô
        entry.tokenBody.scale.set(1, 1, 1);
        entry.shadowMesh.scale.setScalar(1);
        this.spawnLandingWave(tx, tz, entry.landHex);
        onStepTile?.(path[idx]);

        idx += 1;
        if (idx >= path.length) {
          entry.root.position.set(tx, 0.03, tz);
          entry.animating = false;
          resolve();
          return;
        }

        hopStartPos = entry.root.position.clone();
        hopTargetTf = getTileTransform(path[idx]);
        hopStartTime = performance.now();
        gameAudio.playPawnHop(idx, backwards);
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  public animateAirportFlight(playerId: string, fromIndex: number, toIndex: number): Promise<void> {
    const entry = this.entries.get(playerId);
    if (!entry) return Promise.resolve();

    entry.animating = true;
    gameAudio.playAirplaneTakeoff();

    const fromTf = getTileTransform(fromIndex);
    const toTf = getTileTransform(toIndex);
    const p0 = new THREE.Vector3(fromTf.x, 0.05, fromTf.z);
    const p1 = new THREE.Vector3(toTf.x, 0.05, toTf.z);

    this.planeMesh.visible = true;
    this.planeMesh.position.copy(p0);
    this.planeMesh.lookAt(p1.x, 0.6, p1.z);

    const dur = 1150;
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / dur));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const arcY = Math.sin(t * Math.PI) * 3.2;

        const cur = new THREE.Vector3().lerpVectors(p0, p1, ease);
        this.planeMesh.position.set(cur.x, arcY + 0.25, cur.z);
        this.planeMesh.lookAt(p1.x, arcY * 0.8 + 0.25, p1.z);
        entry.root.position.set(cur.x, arcY + 0.42, cur.z);

        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        entry.root.position.set(p1.x, 0.03, p1.z);
        this.planeMesh.visible = false;
        this.spawnLandingWave(p1.x, p1.z, entry.landHex);
        entry.animating = false;
        resolve();
      };
      requestAnimationFrame(step);
    });
  }

  public animateJailLock(playerId: string, fromIndex: number): Promise<void> {
    const entry = this.entries.get(playerId);
    if (!entry) return Promise.resolve();

    entry.animating = true;
    gameAudio.playJailLock();

    const p0 = entry.root.position.clone();
    const jailTf = getTileTransform(13);
    const p1 = new THREE.Vector3(jailTf.x + 0.16, 0.03, jailTf.z - 0.16);
    const dur = fromIndex === 13 ? 280 : 680;

    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / dur));
        entry.root.position.lerpVectors(p0, p1, t);
        entry.root.position.y = 0.03 + Math.sin(t * Math.PI) * 2.2;
        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        entry.root.position.copy(p1);
        this.spawnLandingWave(p1.x, p1.z, '#EF4444');
        entry.animating = false;
        resolve();
      };
      requestAnimationFrame(step);
    });
  }

  public update(dt: number, _camera: THREE.Camera): void {
    this.elapsed += dt;

    for (const entry of this.entries.values()) {
      if (!entry.root.visible) continue;
      if (entry.playerId === this.activePlayerId) {
        const pulse = 0.6 + Math.sin(this.elapsed * 4.5) * 0.35;
        entry.auraMat.opacity = pulse;
        const sc = 1 + Math.sin(this.elapsed * 4.5) * 0.1;
        entry.auraMesh.scale.set(sc, sc, 1);
      } else {
        entry.auraMat.opacity = 0;
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const sw = this.shockwaves[i];
      sw.age += dt;
      const p = Math.min(1, sw.age / sw.maxAge);
      sw.mesh.scale.setScalar(1 + p * 1.45);
      sw.mat.opacity = 0.85 * (1 - p);
      if (sw.age >= sw.maxAge) {
        this.group.remove(sw.mesh);
        sw.mat.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    this.baseCylGeo.dispose();
    this.bezelRingGeo.dispose();
    this.portraitGeo.dispose();
    this.bezelMat.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.auraGeo.dispose();
    this.waveGeo.dispose();
    for (const sw of this.shockwaves) {
      sw.mat.dispose();
    }
    this.entries.forEach((e) => {
      e.rimMat.dispose();
      e.auraMat.dispose();
      e.tokenBody.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      });
    });
    this.loadedTextures.forEach((t) => t.dispose());
    this.planeMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
