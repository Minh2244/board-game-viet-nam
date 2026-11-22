import * as THREE from 'three';
import type { EdgeIndex } from '../engine/types';

export const BOARD_SIZE = 14;
export const TILE_WIDTH = 0.80;
export const TILE_DEPTH = 2.20; // 2*2.20 + 12*0.80 = 14.00 (ô đất sâu rộng & dễ đọc hơn hẳn)
export const HALF_BOARD = BOARD_SIZE / 2; // 7.0

export interface TileTransform {
  index: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Hướng quay của từng ô khi cần xoay dãy nhà 3D dọc theo cạnh */
  edgeRotY: number;
  edge: EdgeIndex | null;
  isCorner: boolean;
  /** Vector pháp tuyến hướng thẳng từ tâm ô vào trung tâm bàn cờ (0,0) */
  innerNX: number;
  innerNZ: number;
}

export function getTileTransform(index: number): TileTransform {
  const cornerCenter = HALF_BOARD - TILE_DEPTH / 2; // 5.90

  if (index === 0) {
    return {
      index,
      x: cornerCenter,
      z: cornerCenter,
      width: TILE_DEPTH,
      depth: TILE_DEPTH,
      edgeRotY: 0,
      edge: null,
      isCorner: true,
      innerNX: -0.707,
      innerNZ: -0.707,
    };
  }
  if (index > 0 && index < 13) {
    const k = index;
    const x = HALF_BOARD - TILE_DEPTH - (k - 0.5) * TILE_WIDTH;
    return {
      index,
      x,
      z: cornerCenter,
      width: TILE_WIDTH,
      depth: TILE_DEPTH,
      edgeRotY: 0,
      edge: 0,
      isCorner: false,
      innerNX: 0,
      innerNZ: -1,
    };
  }
  if (index === 13) {
    return {
      index,
      x: -cornerCenter,
      z: cornerCenter,
      width: TILE_DEPTH,
      depth: TILE_DEPTH,
      edgeRotY: 0,
      edge: null,
      isCorner: true,
      innerNX: 0.707,
      innerNZ: -0.707,
    };
  }
  if (index > 13 && index < 26) {
    const k = index - 13;
    const z = HALF_BOARD - TILE_DEPTH - (k - 0.5) * TILE_WIDTH;
    // Góc nhìn Top-down: cạnh trái có chiều rộng ngang = TILE_DEPTH, chiều cao = TILE_WIDTH
    return {
      index,
      x: -cornerCenter,
      z,
      width: TILE_DEPTH,
      depth: TILE_WIDTH,
      edgeRotY: -Math.PI / 2,
      edge: 1,
      isCorner: false,
      innerNX: 1,
      innerNZ: 0,
    };
  }
  if (index === 26) {
    return {
      index,
      x: -cornerCenter,
      z: -cornerCenter,
      width: TILE_DEPTH,
      depth: TILE_DEPTH,
      edgeRotY: 0,
      edge: null,
      isCorner: true,
      innerNX: 0.707,
      innerNZ: 0.707,
    };
  }
  if (index > 26 && index < 39) {
    const k = index - 26;
    const x = -HALF_BOARD + TILE_DEPTH + (k - 0.5) * TILE_WIDTH;
    return {
      index,
      x,
      z: -cornerCenter,
      width: TILE_WIDTH,
      depth: TILE_DEPTH,
      edgeRotY: Math.PI,
      edge: 2,
      isCorner: false,
      innerNX: 0,
      innerNZ: 1,
    };
  }
  if (index === 39) {
    return {
      index,
      x: cornerCenter,
      z: -cornerCenter,
      width: TILE_DEPTH,
      depth: TILE_DEPTH,
      edgeRotY: 0,
      edge: null,
      isCorner: true,
      innerNX: -0.707,
      innerNZ: 0.707,
    };
  }
  const k = index - 39;
  const z = -HALF_BOARD + TILE_DEPTH + (k - 0.5) * TILE_WIDTH;
  return {
    index,
    x: cornerCenter,
    z,
    width: TILE_DEPTH,
    depth: TILE_WIDTH,
    edgeRotY: Math.PI / 2,
    edge: 3,
    isCorner: false,
    innerNX: -1,
    innerNZ: 0,
  };
}

/** Tọa độ xếp 1..6 huy hiệu Chibi trên cùng một ô mà không che nhau */
export function getPawnSlotPosition(
  tileIndex: number,
  slotIndex: number,
  totalOnTile: number,
  inJailFlag: boolean,
): THREE.Vector3 {
  const tf = getTileTransform(tileIndex);
  const baseX = tf.x - tf.innerNX * (tf.isCorner ? 0 : 0.14);
  const baseZ = tf.z - tf.innerNZ * (tf.isCorner ? 0 : 0.14);

  if (totalOnTile <= 1 && !(tileIndex === 13 && inJailFlag)) {
    return new THREE.Vector3(baseX, 0.03, baseZ);
  }

  if (tileIndex === 13) {
    const cols = 3;
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);
    const localX = inJailFlag ? 0.22 + (col - 1) * 0.36 : -0.4 + col * 0.42;
    const localZ = inJailFlag ? -0.28 + row * 0.38 : 0.48 + row * 0.36;
    return new THREE.Vector3(tf.x + localX, 0.03, tf.z + localZ);
  }

  const radius = totalOnTile === 2 ? 0.25 : 0.38;
  const angle = (slotIndex / Math.max(1, totalOnTile)) * Math.PI * 2 + 0.45;
  const wx = baseX + Math.cos(angle) * radius;
  const wz = baseZ + Math.sin(angle) * radius;
  return new THREE.Vector3(wx, 0.03, wz);
}
