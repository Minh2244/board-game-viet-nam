import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cryptoRandomInt } from '@/shared/crypto/random';
import { gameAudio } from '../audio/gameAudio';

const DIE_SIZE = 1.04;
const HALF_DIE = DIE_SIZE / 2;
const DICE_ZONE_Z = 0;

/**
 * Thứ tự mặt khớp hệ tọa độ chuẩn (tổng 2 mặt đối = 7):
 * +Y=1, -Y=6, +Z=2, -Z=5, +X=3, -X=4
 */
function targetQuaternionForFace(value: number, yawAngle: number): THREE.Quaternion {
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');
  switch (value) {
    case 1:
      euler.set(0, 0, 0);
      break;
    case 6:
      euler.set(Math.PI, 0, 0);
      break;
    case 2:
      euler.set(-Math.PI / 2, 0, 0);
      break;
    case 5:
      euler.set(Math.PI / 2, 0, 0);
      break;
    case 3:
      euler.set(0, 0, Math.PI / 2);
      break;
    case 4:
      euler.set(0, 0, -Math.PI / 2);
      break;
    default:
      euler.set(0, 0, 0);
  }
  const qFace = new THREE.Quaternion().setFromEuler(euler);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
  return qYaw.multiply(qFace);
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.22, -0.22],
    [0.22, 0.22],
  ],
  3: [
    [-0.22, -0.22],
    [0, 0],
    [0.22, 0.22],
  ],
  4: [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ],
  5: [
    [-0.22, -0.22],
    [0.22, -0.22],
    [0, 0],
    [-0.22, 0.22],
    [0.22, 0.22],
  ],
  6: [
    [-0.22, -0.24],
    [0.22, -0.24],
    [-0.22, 0],
    [0.22, 0],
    [-0.22, 0.24],
    [0.22, 0.24],
  ],
};

interface SingleDieAnim {
  obj: THREE.Group;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  midQuat1: THREE.Quaternion;
  midQuat2: THREE.Quaternion;
  endQuat: THREE.Quaternion;
}

interface ImpactSpark {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const SPARK_POOL_SIZE = 32;

export class DiceActor3D {
  public readonly group = new THREE.Group();
  private readonly bodyGeo: RoundedBoxGeometry;
  private readonly bodyMat: THREE.Material;
  private readonly pipSmallGeo: THREE.CircleGeometry;
  private readonly pipBigGeo: THREE.CircleGeometry;
  private readonly pipRimSmallGeo: THREE.CircleGeometry;
  private readonly pipRimBigGeo: THREE.CircleGeometry;
  private readonly pipDarkMat: THREE.MeshStandardMaterial;
  private readonly pipRedMat: THREE.MeshStandardMaterial;
  private readonly pipRimMat: THREE.MeshBasicMaterial;

  private readonly sparkGeo: THREE.OctahedronGeometry;
  private readonly sparks: ImpactSpark[] = [];

  private readonly diceGroups: THREE.Group[] = [];
  private readonly restOffsets: number[] = [];

  private readonly doubleHalo: THREE.Mesh;
  private readonly doubleHaloMat: THREE.MeshBasicMaterial;
  private haloProgress = -1;

  private readonly chargeRing: THREE.Mesh;
  private readonly chargeRingMat: THREE.MeshBasicMaterial;
  private isCharging = false;
  private chargeLevel = 0;
  private isRolling = false;
  private idlePhase = 0;
  private lowPowerMode = false;
  private activeRollCancel: (() => void) | null = null;

  constructor(diceCount: 1 | 2, lowPowerMode = false) {
    this.lowPowerMode = lowPowerMode;
    this.bodyGeo = new RoundedBoxGeometry(
      DIE_SIZE,
      DIE_SIZE,
      DIE_SIZE,
      lowPowerMode ? 2 : 5,
      DIE_SIZE * 0.165,
    );
    this.bodyMat = lowPowerMode
      ? new THREE.MeshStandardMaterial({
          color: '#FCF7EA',
          roughness: 0.28,
          metalness: 0.04,
        })
      : new THREE.MeshPhysicalMaterial({
          color: '#FCF7EA',
          roughness: 0.2,
          metalness: 0.03,
          clearcoat: 0.72,
          clearcoatRoughness: 0.15,
        });

    this.pipSmallGeo = new THREE.CircleGeometry(0.088, 20);
    this.pipBigGeo = new THREE.CircleGeometry(0.135, 24);
    this.pipRimSmallGeo = new THREE.CircleGeometry(0.102, 20);
    this.pipRimBigGeo = new THREE.CircleGeometry(0.152, 24);

    this.pipDarkMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.45,
      metalness: 0.1,
    });
    this.pipRedMat = new THREE.MeshStandardMaterial({
      color: '#C81E1E',
      roughness: 0.35,
      metalness: 0.08,
    });
    this.pipRimMat = new THREE.MeshBasicMaterial({
      color: '#D6C8A8',
      transparent: true,
      opacity: 0.65,
    });

    this.sparkGeo = new THREE.OctahedronGeometry(0.065, 0);

    this.restOffsets = diceCount === 2 ? [-0.98, 0.98] : [0];
    for (let i = 0; i < diceCount; i += 1) {
      const die = this.buildBevelledDie();
      die.position.set(this.restOffsets[i], HALF_DIE + 0.02, DICE_ZONE_Z);
      die.quaternion.copy(targetQuaternionForFace(1, i === 0 ? -0.22 : 0.25));
      this.group.add(die);
      this.diceGroups.push(die);
    }

    // Vòng hào quang Đổ Đôi
    const haloGeo = new THREE.RingGeometry(1.18, 1.92, 42);
    haloGeo.rotateX(-Math.PI / 2);
    this.doubleHaloMat = new THREE.MeshBasicMaterial({
      color: '#FCD34D',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.doubleHalo = new THREE.Mesh(haloGeo, this.doubleHaloMat);
    this.doubleHalo.position.set(0, 0.03, DICE_ZONE_Z);
    this.group.add(this.doubleHalo);

    // Vòng năng lượng khi người chơi nhấn giữ nạp lực trên sân giữa
    const chargeGeo = new THREE.RingGeometry(1.12, 1.62, 42);
    chargeGeo.rotateX(-Math.PI / 2);
    this.chargeRingMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.chargeRing = new THREE.Mesh(chargeGeo, this.chargeRingMat);
    this.chargeRing.position.set(0, 0.04, DICE_ZONE_Z);
    this.group.add(this.chargeRing);

    for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#FDE047',
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.sparks.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  private buildBevelledDie(): THREE.Group {
    const die = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    die.add(body);

    const faces: { value: number; pos: [number, number, number]; rot: [number, number, number] }[] = [
      { value: 1, pos: [0, HALF_DIE + 0.003, 0], rot: [-Math.PI / 2, 0, 0] },
      { value: 6, pos: [0, -HALF_DIE - 0.003, 0], rot: [Math.PI / 2, 0, 0] },
      { value: 2, pos: [0, 0, HALF_DIE + 0.003], rot: [0, 0, 0] },
      { value: 5, pos: [0, 0, -HALF_DIE - 0.003], rot: [0, Math.PI, 0] },
      { value: 3, pos: [HALF_DIE + 0.003, 0, 0], rot: [0, Math.PI / 2, 0] },
      { value: 4, pos: [-HALF_DIE - 0.003, 0, 0], rot: [0, -Math.PI / 2, 0] },
    ];

    for (const face of faces) {
      const faceGrp = new THREE.Group();
      faceGrp.position.set(face.pos[0], face.pos[1], face.pos[2]);
      faceGrp.rotation.set(face.rot[0], face.rot[1], face.rot[2]);
      const isOne = face.value === 1;
      const pipGeo = isOne ? this.pipBigGeo : this.pipSmallGeo;
      const rimGeo = isOne ? this.pipRimBigGeo : this.pipRimSmallGeo;
      const pipMat = isOne ? this.pipRedMat : this.pipDarkMat;

      for (const [px, py] of PIP_LAYOUTS[face.value]) {
        const rim = new THREE.Mesh(rimGeo, this.pipRimMat);
        rim.position.set(px, py, -0.0006);
        faceGrp.add(rim);

        const dot = new THREE.Mesh(pipGeo, pipMat);
        dot.position.set(px, py, 0.0005);
        faceGrp.add(dot);
      }
      die.add(faceGrp);
    }

    return die;
  }

  private spawnImpactSparks(origin: THREE.Vector3, count: number, colorHex: string): void {
    for (let i = 0; i < count; i += 1) {
      let sp = this.sparks.find((item) => !item.active);
      if (!sp && this.sparks.length > 0) {
        // Khi pool đầy, tái sử dụng hạt sắp tắt nhất để không cấp phát thêm Material/Mesh
        sp = this.sparks.reduce((oldest, curr) =>
          curr.life / curr.maxLife > oldest.life / oldest.maxLife ? curr : oldest,
        );
      }
      if (!sp) return;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 1.4 + Math.random() * 2.1;
      sp.mat.color.set(colorHex);
      sp.mat.opacity = 0.95;
      sp.mesh.position.set(origin.x, 0.08, origin.z);
      sp.mesh.rotation.set(0, 0, 0);
      sp.mesh.scale.setScalar(1);
      sp.mesh.visible = true;
      sp.vel.set(Math.cos(angle) * speed, 1.5 + Math.random() * 1.8, Math.sin(angle) * speed);
      sp.life = 0;
      sp.maxLife = 0.34 + Math.random() * 0.22;
      sp.active = true;
    }
  }

  public setLowPowerMode(enabled: boolean): void {
    this.lowPowerMode = enabled;
  }

  /** Trả về true chỉ khi xúc xắc đang tung, đang giữ nạp lực hoặc còn tia sáng/vòng hào quang (giúp tắt vòng lặp WebGL khi đứng im) */
  public isActive(): boolean {
    return this.isRolling || this.isCharging || this.haloProgress >= 0 || this.sparks.some((s) => s.active);
  }

  public setCharging(active: boolean, charge01: number): void {
    this.isCharging = active;
    this.chargeLevel = Math.max(0, Math.min(1, charge01));
    if (!active && !this.isRolling) {
      this.chargeRingMat.opacity = 0;
      this.diceGroups.forEach((d, idx) => {
        d.position.set(this.restOffsets[idx], HALF_DIE + 0.02, DICE_ZONE_Z);
      });
    }
  }

  public setImmediateValues(values: number[]): void {
    this.isCharging = false;
    this.chargeLevel = 0;
    this.chargeRingMat.opacity = 0;
    this.diceGroups.forEach((d, i) => {
      const v = values[i] ?? 1;
      d.position.set(this.restOffsets[i], HALF_DIE + 0.02, DICE_ZONE_Z);
      d.quaternion.copy(targetQuaternionForFace(v, i === 0 ? -0.18 : 0.22));
    });
  }

  public animateRoll(values: number[], isDouble: boolean, power01 = 0.6): Promise<void> {
    if (this.activeRollCancel) {
      this.activeRollCancel();
      this.activeRollCancel = null;
    }
    this.isCharging = false;
    this.chargeLevel = 0;
    this.chargeRingMat.opacity = 0;
    this.isRolling = true;

    const power = Math.max(0.35, Math.min(1, power01));
    gameAudio.playDiceShake(power);

    const count = this.diceGroups.length;
    const anims: SingleDieAnim[] = [];
    const baseSpread = count === 2 ? 1.02 + power * 0.22 : 0;

    for (let i = 0; i < count; i += 1) {
      const obj = this.diceGroups[i];
      const v = values[i] ?? 1;
      const side = count === 2 ? (i === 0 ? -1 : 1) : 0;
      const randEndX = side * baseSpread + cryptoRandomInt(-24, 24) / 100;
      const randEndZ = DICE_ZONE_Z + cryptoRandomInt(-32, 32) / 100;
      const randStartX = randEndX - side * (0.9 + power * 0.6);
      const randStartZ = randEndZ + 1.45 + power * 0.65;

      const startQuat = obj.quaternion.clone();
      const midQuat1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (cryptoRandomInt(2, 5) * Math.PI) / 2,
          (cryptoRandomInt(2, 6) * Math.PI) / 2,
          (cryptoRandomInt(2, 5) * Math.PI) / 2,
        ),
      );
      const midQuat2 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (cryptoRandomInt(3, 6) * Math.PI) / 2,
          (cryptoRandomInt(2, 5) * Math.PI) / 2,
          (cryptoRandomInt(3, 6) * Math.PI) / 2,
        ),
      );
      const endYaw = (cryptoRandomInt(-42, 42) * Math.PI) / 180;
      const endQuat = targetQuaternionForFace(v, endYaw);

      anims.push({
        obj,
        startPos: new THREE.Vector3(randStartX, 2.3 + power * 1.1, randStartZ),
        endPos: new THREE.Vector3(randEndX, HALF_DIE + 0.02, randEndZ),
        startQuat,
        midQuat1,
        midQuat2,
        endQuat,
      });
    }

    const durationMs = Math.round(840 + power * 230);
    const bounceTimes = [0.40, 0.70, 0.89];
    let nextBounceIdx = 0;

    return new Promise((resolve) => {
      const startTime = performance.now();
      let rafId = 0;
      let settled = false;

      const finish = (playEffects: boolean) => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(rafId);
        clearTimeout(safetyTimer);
        if (this.activeRollCancel === cancelAndResolve) {
          this.activeRollCancel = null;
        }
        for (const a of anims) {
          a.obj.position.copy(a.endPos);
          a.obj.quaternion.copy(a.endQuat);
        }
        this.isRolling = false;
        if (playEffects && isDouble) {
          gameAudio.playDoubleSparkle();
          this.haloProgress = 0;
          this.spawnImpactSparks(new THREE.Vector3(0, 0.1, DICE_ZONE_Z), 22, '#FBBF24');
        }
        resolve();
      };

      const cancelAndResolve = () => finish(false);
      this.activeRollCancel = cancelAndResolve;
      // Bảo vệ tuyệt đối: nếu trình duyệt tạm ngưng RAF (tab nền / tiết kiệm pin), tự chốt điểm sau hạn mức an toàn
      const safetyTimer = setTimeout(() => finish(true), durationMs + 500);

      const step = (now: number) => {
        if (settled) return;
        const raw = (now - startTime) / durationMs;
        const t = Math.min(1, Math.max(0, raw));

        if (nextBounceIdx < bounceTimes.length && t >= bounceTimes[nextBounceIdx]) {
          gameAudio.playDiceBounce(nextBounceIdx, power);
          const sparkCount = this.lowPowerMode
            ? nextBounceIdx === 0
              ? 4
              : 2
            : nextBounceIdx === 0
              ? 9
              : nextBounceIdx === 1
                ? 5
                : 3;
          for (const a of anims) {
            this.spawnImpactSparks(a.obj.position, sparkCount, nextBounceIdx === 0 ? '#FEF08A' : '#BAE6FD');
          }
          nextBounceIdx += 1;
        }

        const peak1 = 2.0 + power * 1.15;
        const peak2 = 0.72 + power * 0.32;
        const peak3 = 0.24 + power * 0.1;

        let yOffset = 0;
        if (t < 0.40) {
          const p = t / 0.40;
          yOffset = (1 - p * p) * peak1;
        } else if (t < 0.70) {
          const p = (t - 0.40) / 0.30;
          yOffset = Math.sin(p * Math.PI) * peak2;
        } else if (t < 0.89) {
          const p = (t - 0.70) / 0.19;
          yOffset = Math.sin(p * Math.PI) * peak3;
        } else {
          yOffset = 0;
        }

        const easeMove = 1 - Math.pow(1 - Math.min(1, t / 0.91), 2.35);

        for (const a of anims) {
          a.obj.position.lerpVectors(a.startPos, a.endPos, easeMove);
          a.obj.position.y = HALF_DIE + 0.02 + yOffset;

          if (t < 0.34) {
            a.obj.quaternion.slerpQuaternions(a.startQuat, a.midQuat1, t / 0.34);
          } else if (t < 0.66) {
            a.obj.quaternion.slerpQuaternions(a.midQuat1, a.midQuat2, (t - 0.34) / 0.32);
          } else {
            const p = Math.min(1, (t - 0.66) / 0.26);
            a.obj.quaternion.slerpQuaternions(a.midQuat2, a.endQuat, 1 - Math.pow(1 - p, 2.2));
          }
        }

        if (t < 1) {
          rafId = requestAnimationFrame(step);
          return;
        }

        finish(true);
      };

      rafId = requestAnimationFrame(step);
    });
  }

  public update(dt: number): void {
    this.idlePhase += dt;

    // Diễn hoạt lơ lửng rung lắc nạp lực khi người chơi nhấn giữ sân giữa
    if (this.isCharging && !this.isRolling) {
      const c = this.chargeLevel;
      const shakeAmp = 0.04 + c * 0.12;
      const rotSpeed = 4.5 + c * 15;
      const hoverY = HALF_DIE + 0.42 + c * 0.88;

      this.diceGroups.forEach((die, idx) => {
        const sign = idx === 0 ? -1 : 1;
        die.position.x =
          this.restOffsets[idx] * (0.86 - c * 0.14) + Math.sin(this.idlePhase * (28 + c * 22) + idx * 2) * shakeAmp;
        die.position.y = hoverY + Math.cos(this.idlePhase * 18 + idx) * 0.07;
        die.position.z =
          DICE_ZONE_Z + Math.cos(this.idlePhase * (24 + c * 20) + sign) * shakeAmp;
        die.rotation.x += rotSpeed * dt;
        die.rotation.y += rotSpeed * 1.25 * dt;
        die.rotation.z += rotSpeed * 0.7 * dt * sign;
      });

      this.chargeRingMat.opacity = 0.35 + c * 0.55;
      this.chargeRingMat.color.set(c > 0.72 ? '#F59E0B' : '#38BDF8');
      const s = 0.85 + c * 0.65 + Math.sin(this.idlePhase * 14) * 0.05;
      this.chargeRing.scale.set(s, s, s);
      this.chargeRing.rotation.y += (2 + c * 5) * dt;
    }

    // Vòng hào quang Đổ Đôi
    if (this.haloProgress >= 0) {
      this.haloProgress += dt * 1.45;
      if (this.haloProgress >= 1) {
        this.haloProgress = -1;
        this.doubleHaloMat.opacity = 0;
        this.doubleHalo.scale.set(1, 1, 1);
      } else {
        const s = 0.8 + this.haloProgress * 1.9;
        this.doubleHalo.scale.set(s, s, s);
        this.doubleHaloMat.opacity = (1 - this.haloProgress) * 0.92;
      }
    }

    // Hạt tia sáng va chạm 3D (dùng pool tái sử dụng, không cấp phát/xóa Material mỗi lần nảy)
    for (let i = 0; i < this.sparks.length; i += 1) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      sp.vel.y -= 7.2 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.mesh.rotation.x += 8 * dt;
      sp.mesh.rotation.y += 10 * dt;
      const ratio = 1 - sp.life / sp.maxLife;
      sp.mesh.scale.setScalar(ratio);
      sp.mat.opacity = ratio;
    }
  }

  public dispose(): void {
    if (this.activeRollCancel) {
      this.activeRollCancel();
      this.activeRollCancel = null;
    }
    for (const sp of this.sparks) {
      this.group.remove(sp.mesh);
      sp.mat.dispose();
    }
    this.sparks.length = 0;
    this.bodyGeo.dispose();
    this.bodyMat.dispose();
    this.pipSmallGeo.dispose();
    this.pipBigGeo.dispose();
    this.pipRimSmallGeo.dispose();
    this.pipRimBigGeo.dispose();
    this.pipDarkMat.dispose();
    this.pipRedMat.dispose();
    this.pipRimMat.dispose();
    this.sparkGeo.dispose();
    this.doubleHalo.geometry.dispose();
    this.doubleHaloMat.dispose();
    this.chargeRing.geometry.dispose();
    this.chargeRingMat.dispose();
  }
}
