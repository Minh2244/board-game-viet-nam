import * as THREE from 'three';
import { COLOR_GROUPS } from '../data/boardData';
import { formatShortVnd } from '../engine/rules';
import type { BoardTile, EdgeIndex, PlayerState } from '../engine/types';

const ATLAS_COLS = 8;
const ATLAS_ROWS = 7;
const CELL_SIZE = 384;
export const ATLAS_WIDTH = ATLAS_COLS * CELL_SIZE; // 3072
export const ATLAS_HEIGHT = ATLAS_ROWS * CELL_SIZE; // 2688

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class TileTextureAtlas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;

  constructor(tiles: readonly BoardTile[], players: readonly PlayerState[]) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_WIDTH;
    this.canvas.height = ATLAS_HEIGHT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot initialize 2D context for TileTextureAtlas');
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    this.redrawAll(tiles, players);
  }

  public getCellUVs(tileIndex: number): { u0: number; v0: number; u1: number; v1: number } {
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    const padX = 2.5 / ATLAS_WIDTH;
    const padY = 2.5 / ATLAS_HEIGHT;
    const u0 = col / ATLAS_COLS + padX;
    const u1 = (col + 1) / ATLAS_COLS - padX;
    const v1 = 1 - row / ATLAS_ROWS - padY;
    const v0 = 1 - (row + 1) / ATLAS_ROWS + padY;
    return { u0, v0, u1, v1 };
  }

  public redrawAll(tiles: readonly BoardTile[], players: readonly PlayerState[]): void {
    this.ctx.fillStyle = '#E2D9C3';
    this.ctx.fillRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
    for (const tile of tiles) {
      this.drawTileCell(tile, tiles, players);
    }
    this.texture.needsUpdate = true;
  }

  public redrawTile(tileIndex: number, tiles: readonly BoardTile[], players: readonly PlayerState[]): void {
    const tile = tiles[tileIndex];
    if (!tile) return;
    this.drawTileCell(tile, tiles, players);
    this.texture.needsUpdate = true;
  }

  private drawWrappedText(
    text: string,
    cx: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    maxLines = 3,
  ): void {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (this.ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    const clipped = lines.slice(0, maxLines);
    const totalOffset = ((clipped.length - 1) * lineHeight) / 2;
    clipped.forEach((line, idx) => {
      this.ctx.fillText(line, cx, startY - totalOffset + idx * lineHeight);
    });
  }

  private drawTileCell(
    tile: BoardTile,
    allTiles: readonly BoardTile[],
    players: readonly PlayerState[],
  ): void {
    const col = tile.index % ATLAS_COLS;
    const row = Math.floor(tile.index / ATLAS_COLS);
    const cellX = col * CELL_SIZE;
    const cellY = row * CELL_SIZE;
    const c = this.ctx;

    // Quy đổi không gian ảo tỉ lệ thật 1:1 theo hình học mới 0.80 × 2.20 (không bị méo chữ)
    const isHorizontalSide = tile.edge === 1 || tile.edge === 3;
    const isVerticalSide = tile.edge === 0 || tile.edge === 2;
    const vw = isHorizontalSide ? 511 : isVerticalSide ? 186 : 384;
    const vh = isHorizontalSide ? 186 : isVerticalSide ? 511 : 384;

    c.save();
    c.beginPath();
    c.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
    c.clip();

    c.translate(cellX, cellY);
    c.scale(CELL_SIZE / vw, CELL_SIZE / vh);

    // Xác định chủ sở hữu (đất, bến xe, thủy điện)
    let owner: PlayerState | undefined;
    if (tile.kind === 'AUCTION_STATION' && tile.auctionState?.status === 'CLOSED') {
      owner = players.find((p) => p.id === tile.auctionState?.finalOwnerId);
    } else if (tile.ownerId) {
      owner = players.find((p) => p.id === tile.ownerId);
    }

    // Nền kem ngà sáng rõ (khi có chủ sở hữu sẽ nhuộm ánh màu chủ nhẹ nhàng dễ nhìn)
    c.fillStyle = owner ? '#FFFFFF' : '#FFFDF7';
    c.fillRect(0, 0, vw, vh);
    if (owner) {
      c.fillStyle = hexToRgba(owner.landHex, 0.14);
      c.fillRect(0, 0, vw, vh);
    }

    if (tile.edge === null) {
      this.drawCornerTile(c, tile, vw, vh);
    } else if (isVerticalSide) {
      this.drawVerticalEdgeTile(c, tile, allTiles, owner, tile.edge, vw, vh);
    } else if (tile.edge !== null) {
      this.drawHorizontalEdgeTile(c, tile, allTiles, owner, tile.edge, vw, vh);
    }

    // Khung viền đậm sắc nét quanh ô; nếu đã có chủ sở hữu tô viền dày theo màu tụ
    if (owner) {
      c.strokeStyle = owner.landHex;
      c.lineWidth = 10;
      c.strokeRect(5, 5, vw - 10, vh - 10);
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 2;
      c.strokeRect(10, 10, vw - 20, vh - 20);
    } else {
      c.strokeStyle = '#334155';
      c.lineWidth = 4;
      c.strokeRect(2, 2, vw - 4, vh - 4);
    }

    c.restore();
  }

  /** Vẽ 4 ô góc bàn cờ (1:1 upright) */
  private drawCornerTile(
    c: CanvasRenderingContext2D,
    tile: BoardTile,
    vw: number,
    vh: number,
  ): void {
    let bg = '#DCFCE7';
    let band = '#15803D';
    let icon = '🏁';
    let title = 'KHỞI HÀNH';
    let sub = 'Qua +3M đ';
    if (tile.kind === 'VISIT_JAIL') {
      bg = '#E2E8F0';
      band = '#334155';
      icon = '⛓️';
      title = 'NHÀ TÙ';
      sub = 'Thăm 500K / Giam';
    } else if (tile.kind === 'FREE_PARKING') {
      bg = '#FEF9C3';
      band = '#B45309';
      icon = '🅿️';
      title = 'BÃI ĐỖ XE';
      sub = 'Nghỉ chân an toàn';
    } else if (tile.kind === 'GO_TO_JAIL') {
      bg = '#FEE2E2';
      band = '#DC2626';
      icon = '🚨';
      title = 'BỊ BẮT TÙ';
      sub = 'Vào thẳng ô 13';
    }
    c.fillStyle = bg;
    c.fillRect(0, 0, vw, vh);

    c.fillStyle = band;
    c.fillRect(0, 0, vw, 74);
    c.fillStyle = '#FFFFFF';
    c.font = '900 34px "Be Vietnam Pro", "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(title, vw / 2, 38);

    c.font = '800 96px "Be Vietnam Pro", "Segoe UI", sans-serif';
    c.fillText(icon, vw / 2, 198);

    c.fillStyle = '#0F172A';
    c.font = '900 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
    c.fillText(sub, vw / 2, vh - 46);
  }

  /** Vẽ ô cạnh Đáy (0) và Đỉnh (2) — Dải màu hướng vào tâm bàn cờ, toàn bộ chữ đứng thuận mắt */
  private drawVerticalEdgeTile(
    c: CanvasRenderingContext2D,
    tile: BoardTile,
    allTiles: readonly BoardTile[],
    owner: PlayerState | undefined,
    edge: EdgeIndex,
    vw: number,
    vh: number,
  ): void {
    const bandH = 78;
    const isTopEdge = edge === 2;
    const bandY = isTopEdge ? vh - bandH : 0;
    const bodyTop = isTopEdge ? 0 : bandH;
    const footerH = 74;
    const footerY = isTopEdge ? vh - bandH - footerH : vh - footerH;
    const nameCenterY = isTopEdge ? (vh - bandH - footerH) / 2 : bandH + (vh - bandH - footerH) / 2;

    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (tile.kind === 'PROPERTY' && tile.colorGroup) {
      const groupColor = COLOR_GROUPS[tile.colorGroup]?.hex ?? '#059669';
      c.fillStyle = groupColor;
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(0, isTopEdge ? bandY : bandY + bandH - 4, vw, 4);

      c.fillStyle = '#FFFFFF';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(`NHÓM ${tile.colorGroup}`, vw / 2, bandY + bandH / 2);

      // Tên thành phố to đậm tối đa
      c.fillStyle = '#0F172A';
      c.font = '900 29px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name, vw / 2, nameCenterY, vw - 12, 34, 4);

      // Chân hiển thị giá hoặc màu + cấp sở hữu
      this.drawFooterPlate(c, tile, owner, 0, footerY, vw, footerH);
    } else if (tile.kind === 'AUCTION_STATION') {
      c.fillStyle = owner ? owner.landHex : '#1E293B';
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = '#FDE047';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('ĐẤU GIÁ', vw / 2, bandY + bandH / 2);

      c.fillStyle = '#0F172A';
      c.font = '800 38px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('🚌', vw / 2, bodyTop + 72);
      c.font = '900 25px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name.replace('Bến Xe ', 'BX '), vw / 2, nameCenterY + 34, vw - 12, 29, 3);

      const auc = tile.auctionState;
      c.fillStyle = owner ? owner.landHex : auc?.status === 'ACTIVE' ? '#D97706' : '#CBD5E1';
      c.fillRect(0, footerY, vw, footerH);
      c.fillStyle = owner || auc?.status === 'ACTIVE' ? '#FFFFFF' : '#0F172A';
      c.font = '900 26px "Be Vietnam Pro", "Segoe UI", sans-serif';
      const label =
        auc?.status === 'CLOSED'
          ? formatShortVnd(auc.finalPrice)
          : auc?.status === 'ACTIVE'
            ? formatShortVnd(auc.currentBid)
            : 'MỞ 2M đ';
      c.fillText(label, vw / 2, footerY + footerH / 2);
    } else if (tile.kind === 'AIRPORT') {
      c.fillStyle = '#0284C7';
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = '#FFFFFF';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('SÂN BAY', vw / 2, bandY + bandH / 2);

      c.font = '800 40px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('✈️', vw / 2, bodyTop + 68);
      c.fillStyle = '#0F172A';
      c.font = '900 24px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name.replace('Sân Bay ', ''), vw / 2, nameCenterY + 26, vw - 12, 28, 3);

      const destTile = tile.currentDestinationTileIndex !== undefined ? allTiles[tile.currentDestinationTileIndex] : undefined;
      c.fillStyle = '#BAE6FD';
      c.fillRect(0, footerY, vw, footerH);
      c.fillStyle = '#0C4A6E';
      c.font = '900 20px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(`→ ${destTile?.name ?? 'Bay'}`, vw / 2, footerY + footerH / 2, vw - 10, 22, 2);
    } else if (tile.kind === 'UTILITY') {
      c.fillStyle = owner ? owner.landHex : '#0EA5E9';
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = '#FFFFFF';
      c.font = '900 22px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('THỦY ĐIỆN', vw / 2, bandY + bandH / 2);

      c.font = '800 40px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('⚡', vw / 2, bodyTop + 68);
      c.fillStyle = '#0F172A';
      c.font = '900 25px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name.replace('Thủy Điện ', ''), vw / 2, nameCenterY + 28, vw - 12, 29, 3);

      c.fillStyle = owner ? owner.landHex : '#BAE6FD';
      c.fillRect(0, footerY, vw, footerH);
      c.fillStyle = owner ? '#FFFFFF' : '#0369A1';
      c.font = '900 26px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(owner ? owner.name.slice(0, 8) : '2M đ', vw / 2, footerY + footerH / 2);
    } else if (tile.kind === 'CHANCE' || tile.kind === 'FATE') {
      const isChance = tile.kind === 'CHANCE';
      c.fillStyle = isChance ? '#DBEAFE' : '#FFEDD5';
      c.fillRect(0, 0, vw, vh);
      c.fillStyle = isChance ? '#1D4ED8' : '#C2410C';
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = '#FFFFFF';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isChance ? 'CƠ HỘI' : 'KHÍ VẬN', vw / 2, bandY + bandH / 2);

      c.fillStyle = isChance ? '#2563EB' : '#EA580C';
      c.font = '900 96px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isChance ? '?' : '!', vw / 2, nameCenterY);

      c.fillStyle = '#334155';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('Rút thẻ', vw / 2, footerY + footerH / 2);
    } else if (tile.kind === 'HERITAGE' || tile.kind === 'TAX') {
      const isTax = tile.kind === 'TAX';
      c.fillStyle = isTax ? '#FEE2E2' : '#FEF3C7';
      c.fillRect(0, 0, vw, vh);
      c.fillStyle = isTax ? '#B91C1C' : '#B45309';
      c.fillRect(0, bandY, vw, bandH);
      c.fillStyle = '#FFFFFF';
      c.font = '900 22px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isTax ? 'THUẾ BĐS' : 'DI SẢN QG', vw / 2, bandY + bandH / 2);
      c.font = '800 44px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isTax ? '🧾' : '🏯', vw / 2, bodyTop + 78);
      c.fillStyle = '#1E293B';
      c.font = '900 23px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(isTax ? '200K/nhà' : 'Hoàng Thành', vw / 2, nameCenterY + 34, vw - 12, 27, 2);
      c.fillStyle = isTax ? '#991B1B' : '#15803D';
      c.font = '900 26px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isTax ? 'Min 50K' : '+1M đ', vw / 2, footerY + footerH / 2);
    }
  }

  /** Vẽ ô cạnh Trái (1) và Phải (3) — Chữ nằm ngang to đậm 100% thuận mắt! */
  private drawHorizontalEdgeTile(
    c: CanvasRenderingContext2D,
    tile: BoardTile,
    allTiles: readonly BoardTile[],
    owner: PlayerState | undefined,
    edge: EdgeIndex,
    vw: number,
    vh: number,
  ): void {
    const bandW = 84;
    const isLeftEdge = edge === 1;
    const bandX = isLeftEdge ? vw - bandW : 0;
    const bodyX = isLeftEdge ? 0 : bandW;
    const bodyW = vw - bandW;
    const bodyCX = bodyX + bodyW / 2;

    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (tile.kind === 'PROPERTY' && tile.colorGroup) {
      const groupColor = COLOR_GROUPS[tile.colorGroup]?.hex ?? '#059669';
      c.fillStyle = groupColor;
      c.fillRect(bandX, 0, bandW, vh);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(isLeftEdge ? bandX : bandX + bandW - 4, 0, 4, vh);

      c.fillStyle = '#FFFFFF';
      c.font = '900 24px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(`N.${tile.colorGroup}`, bandX + bandW / 2, vh / 2);

      // Tên đất cực kỳ rộng rãi, chữ to đậm rõ ràng
      c.fillStyle = '#0F172A';
      c.font = '900 32px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name, bodyCX, 62, bodyW - 22, 34, 2);

      // Thanh giá / màu chủ sở hữu nằm ngay dưới tên đất
      this.drawFooterPlate(c, tile, owner, bodyX + 12, vh - 60, bodyW - 24, 48, true);
    } else if (tile.kind === 'CHANCE' || tile.kind === 'FATE') {
      const isChance = tile.kind === 'CHANCE';
      c.fillStyle = isChance ? '#DBEAFE' : '#FFEDD5';
      c.fillRect(0, 0, vw, vh);
      c.fillStyle = isChance ? '#1D4ED8' : '#C2410C';
      c.fillRect(bandX, 0, bandW, vh);
      c.fillStyle = '#FFFFFF';
      c.font = '900 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isChance ? '?' : '!', bandX + bandW / 2, vh / 2);

      c.fillStyle = isChance ? '#1D4ED8' : '#C2410C';
      c.font = '900 36px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isChance ? 'CƠ HỘI' : 'KHÍ VẬN', bodyCX, 72);
      c.fillStyle = '#334155';
      c.font = '900 24px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText('Rút 1 thẻ', bodyCX, 128);
    } else if (tile.kind === 'HERITAGE' || tile.kind === 'TAX') {
      const isTax = tile.kind === 'TAX';
      c.fillStyle = isTax ? '#FEE2E2' : '#FEF3C7';
      c.fillRect(0, 0, vw, vh);
      c.fillStyle = isTax ? '#B91C1C' : '#B45309';
      c.fillRect(bandX, 0, bandW, vh);
      c.fillStyle = '#FFFFFF';
      c.font = '900 30px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isTax ? '🧾' : '🏯', bandX + bandW / 2, vh / 2);

      c.fillStyle = '#0F172A';
      c.font = '900 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name, bodyCX, 62, bodyW - 22, 30, 2);

      c.fillStyle = isTax ? '#991B1B' : '#15803D';
      c.font = '900 26px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(isTax ? '200K/nhà · Min 50K' : '+1M đ Di Sản', bodyCX, vh - 42);
    } else if (tile.kind === 'AUCTION_STATION' || tile.kind === 'AIRPORT' || tile.kind === 'UTILITY') {
      c.fillStyle = owner ? owner.landHex : tile.kind === 'AIRPORT' ? '#0284C7' : '#334155';
      c.fillRect(bandX, 0, bandW, vh);
      c.fillStyle = '#FFFFFF';
      c.font = '800 32px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(tile.kind === 'AIRPORT' ? '✈️' : tile.kind === 'UTILITY' ? '⚡' : '🚌', bandX + bandW / 2, vh / 2);

      c.fillStyle = '#0F172A';
      c.font = '900 28px "Be Vietnam Pro", "Segoe UI", sans-serif';
      this.drawWrappedText(tile.name, bodyCX, 64, bodyW - 22, 30, 2);
      const subText =
        tile.kind === 'AIRPORT'
          ? `→ ${allTiles[tile.currentDestinationTileIndex ?? 1]?.name ?? 'Bay'}`
          : owner
            ? owner.name
            : '2M đ';
      c.fillStyle = owner ? owner.landHex : '#0369A1';
      c.font = '900 25px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(subText, bodyCX, vh - 40);
    }
  }

  private drawFooterPlate(
    c: CanvasRenderingContext2D,
    tile: BoardTile,
    owner: PlayerState | undefined,
    fx: number,
    fy: number,
    fw: number,
    fh: number,
    rounded = false,
  ): void {
    c.save();
    if (rounded) {
      c.beginPath();
      c.roundRect(fx, fy, fw, fh, 10);
      c.clip();
    }

    if (owner) {
      c.fillStyle = owner.landHex;
      c.fillRect(fx, fy, fw, fh);
      c.fillStyle = '#FFFFFF';
      c.font = '900 25px "Be Vietnam Pro", "Segoe UI", sans-serif';
      const label =
        tile.buildingLevel === 5
          ? 'KHÁCH SẠN ★'
          : tile.buildingLevel > 0
            ? `NHÀ CẤP ${tile.buildingLevel}`
            : `ĐẤT ${owner.name.slice(0, 7)}`;
      c.fillText(label, fx + fw / 2, fy + fh / 2);
    } else {
      c.fillStyle = '#EDE6D1';
      c.fillRect(fx, fy, fw, fh);
      c.fillStyle = '#0F766E';
      c.font = '900 29px "Be Vietnam Pro", "Segoe UI", sans-serif';
      c.fillText(formatShortVnd(tile.basePrice ?? 1_000_000), fx + fw / 2, fy + fh / 2);
    }
    c.restore();
  }
}

/** Vẽ mặt bàn trung tâm: Ngân Hàng Trung Tâm, Bản đồ Việt Nam, Trống Đồng & Khay Cơ Hội / Khí Vận / Xúc Xắc */
export function createCenterCourtTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;

  const grad = c.createRadialGradient(size / 2, size / 2, 50, size / 2, size / 2, size * 0.72);
  grad.addColorStop(0, '#F4F8EC');
  grad.addColorStop(1, '#E1ECD6');
  c.fillStyle = grad;
  c.fillRect(0, 0, size, size);

  // Trống Đồng Đông Sơn
  c.save();
  c.translate(size / 2, size / 2);
  c.strokeStyle = 'rgba(180, 142, 74, 0.22)';
  for (const r of [140, 220, 305, 380]) {
    c.lineWidth = r === 305 ? 6 : 2.5;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 16; i += 1) {
    const ang = (i / 16) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(ang) * 95, Math.sin(ang) * 95);
    c.lineTo(Math.cos(ang) * 220, Math.sin(ang) * 220);
    c.stroke();
  }
  c.restore();

  // Bản đồ Việt Nam hình chữ S mềm mại ở giữa
  c.save();
  c.fillStyle = '#E6C68E';
  c.strokeStyle = '#78562A';
  c.lineWidth = 4;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(476, 252);
  c.lineTo(526, 260);
  c.lineTo(564, 284);
  c.bezierCurveTo(560, 314, 538, 336, 514, 360);
  c.bezierCurveTo(508, 392, 544, 418, 570, 452);
  c.bezierCurveTo(594, 492, 598, 546, 584, 590);
  c.bezierCurveTo(574, 628, 548, 646, 532, 678);
  c.bezierCurveTo(522, 704, 500, 728, 486, 734);
  c.bezierCurveTo(474, 708, 478, 672, 498, 646);
  c.bezierCurveTo(514, 622, 540, 596, 536, 552);
  c.bezierCurveTo(532, 510, 504, 474, 492, 428);
  c.bezierCurveTo(480, 386, 474, 352, 438, 318);
  c.bezierCurveTo(424, 296, 436, 266, 476, 252);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();

  // Tiêu đề & Quầy Ngân Hàng Trung Tâm ở phía trên
  c.fillStyle = '#14532D';
  c.font = '900 38px "Be Vietnam Pro", "Segoe UI", sans-serif';
  c.textAlign = 'center';
  c.fillText('CỜ TỶ PHÚ VIỆT NAM', size / 2, 82);

  // Vòng Ngân Hàng Trung Tâm
  c.save();
  c.fillStyle = '#FEF3C7';
  c.strokeStyle = '#D97706';
  c.lineWidth = 5;
  c.beginPath();
  c.roundRect(size / 2 - 140, 114, 280, 74, 36);
  c.fill();
  c.stroke();
  c.fillStyle = '#92400E';
  c.font = '900 26px "Be Vietnam Pro", "Segoe UI", sans-serif';
  c.textBaseline = 'middle';
  c.fillText('🏦 NGÂN HÀNG', size / 2, 152);
  c.restore();

  // Ô chờ 2 xấp bài & Khay Xúc xắc dưới cùng
  c.strokeStyle = 'rgba(29, 78, 216, 0.35)';
  c.lineWidth = 4;
  c.strokeRect(94, 408, 224, 156);
  c.strokeStyle = 'rgba(234, 88, 12, 0.35)';
  c.strokeRect(706, 408, 224, 156);

  c.save();
  c.fillStyle = 'rgba(15, 23, 42, 0.06)';
  c.strokeStyle = 'rgba(100, 116, 139, 0.25)';
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(size / 2 - 175, 650, 350, 190, 28);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(71, 85, 105, 0.5)';
  c.font = '800 20px "Be Vietnam Pro", "Segoe UI", sans-serif';
  c.fillText('KHAY XÚC XẮC', size / 2, 820);
  c.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
