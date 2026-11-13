import { ARENA_HEIGHT, ARENA_WIDTH, TURRET_X, TURRET_Y, WAF_BARRIER_X } from '../engine/engine.ts';
import type {
  EngineTickEvents,
  GameState,
  GatewayLaneState,
  PacketEntity,
  UpstreamNodeState
} from '../engine/types.ts';

export interface BoxBounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const LANE_BOXES: ReadonlyArray<BoxBounds> = [0, 1, 2].map((i) => ({
  x: 646,
  y: 58 + i * 82,
  w: 332,
  h: 70
}));

export const UPSTREAM_BOXES: ReadonlyArray<BoxBounds> = [0, 1, 2].map((i) => ({
  x: 646,
  y: 346 + i * 76,
  w: 332,
  h: 64
}));

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ActiveLaser {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  life: number;
}

interface ActiveFloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface CanvasRenderer {
  ingestEvents(events: EngineTickEvents): void;
  setPointer(x: number, y: number): void;
  triggerScanWave(): void;
  render(state: Readonly<GameState>, dt: number): void;
}

export function hitTestBox(x: number, y: number, boxes: ReadonlyArray<BoxBounds>): number {
  return boxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

/**
 * 60 FPS Cyber-Terminal Canvas 渲染器，繪製三層防線、粒子、雷射與即時警示。
 */
export function createCanvasRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const particles: Particle[] = [];
  const lasers: ActiveLaser[] = [];
  const floats: ActiveFloatText[] = [];
  let pointerX = 320;
  let pointerY = 300;
  let scanWaveProgress = -1;

  const spawnBurst = (x: number, y: number, color: string, count: number): void => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 60 + Math.random() * 190;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 3
      });
    }
  };

  const ingestEvents = (events: EngineTickEvents): void => {
    for (const laser of events.lasers) {
      lasers.push({ ...laser, life: 0.16 });
      spawnBurst(laser.toX, laser.toY, laser.color, 12);
    }
    for (const ft of events.floatingTexts) {
      floats.push({ x: ft.x, y: ft.y, text: ft.text, color: ft.color, life: 1.05 });
    }
  };

  const drawGrid = (time: number, overclock: boolean): void => {
    ctx.fillStyle = overclock ? '#0d101d' : '#080b12';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    ctx.strokeStyle = overclock ? 'rgba(250, 204, 21, 0.08)' : 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    const offset = (time * 24) % 40;
    for (let x = offset; x < WAF_BARRIER_X; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WAF_BARRIER_X, y);
      ctx.stroke();
    }

    // Section headers
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('ZONE 1 // WAF-CHECKER CORRIDOR (CLICK THREATS -> 403)', 18, 24);
    ctx.fillStyle = '#f38020';
    ctx.fillText('ZONE 2 // CLOUDFLARE AUTO-ROUTER [1 / 2 / 3]', 646, 38);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('ZONE 3 // CASBIN GATEWAY PROBE [E]', 646, 326);
  };

  const drawWafBarrier = (state: Readonly<GameState>): void => {
    const overclock = state.overclockTimer > 0;
    const barrierColor = overclock ? '#facc15' : '#00ff9d';

    ctx.save();
    ctx.strokeStyle = barrierColor;
    ctx.lineWidth = overclock ? 4 : 2.5;
    ctx.shadowColor = barrierColor;
    ctx.shadowBlur = overclock ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(WAF_BARRIER_X, 34);
    ctx.lineTo(WAF_BARRIER_X, ARENA_HEIGHT - 18);
    ctx.stroke();

    // Turret core node
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(TURRET_X, TURRET_Y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = barrierColor;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(overclock ? '2X' : 'WAF', TURRET_X, TURRET_Y + 4);
    ctx.restore();
  };

  const drawPacket = (p: PacketEntity, time: number): void => {
    ctx.save();
    const isLegit = p.kind === 'legit';
    const isObfuscated = p.kind === 'obfuscated' && !p.revealed;

    let stroke = '#ff3366';
    let fill = 'rgba(255, 51, 102, 0.18)';
    let textColor = '#fecdd3';

    if (isLegit) {
      stroke = '#38bdf8';
      fill = 'rgba(56, 189, 248, 0.16)';
      textColor = '#bae6fd';
    } else if (p.kind === 'obfuscated') {
      stroke = p.revealed ? '#e879f9' : '#67e8f9';
      fill = p.revealed ? 'rgba(232, 121, 249, 0.24)' : 'rgba(103, 232, 249, 0.12)';
      textColor = p.revealed ? '#f5d0fe' : '#a5f3fc';
    }

    const jitterX = isObfuscated ? Math.sin(time * 38 + p.id) * 2.2 : 0;
    const px = p.x + jitterX;

    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 2;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 10;

    if (isLegit) {
      ctx.beginPath();
      ctx.arc(px, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const r = p.radius;
      ctx.beginPath();
      ctx.moveTo(px, p.y - r);
      ctx.lineTo(px + r, p.y);
      ctx.lineTo(px, p.y + r);
      ctx.lineTo(px - r, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = stroke;
    ctx.textAlign = 'center';
    ctx.fillText(isObfuscated ? '??? // ENCODED' : p.category, px, p.y - p.radius - 6);

    ctx.font = '500 10px ui-monospace, monospace';
    ctx.fillStyle = textColor;
    const shortLabel = p.label.length > 22 ? `${p.label.slice(0, 21)}…` : p.label;
    ctx.fillText(shortLabel, px, p.y + p.radius + 13);
    ctx.restore();
  };

  const drawGatewayLanes = (lanes: ReadonlyArray<GatewayLaneState>, time: number): void => {
    lanes.forEach((lane, i) => {
      const box = LANE_BOXES[i];
      ctx.save();

      const pulse = lane.alertActive ? 0.5 + 0.5 * Math.sin(time * 16) : 0;
      const borderColor = lane.alertActive
        ? `rgba(243, 128, 32, ${0.7 + pulse * 0.3})`
        : lane.savedFlashTimer > 0
          ? '#00ff9d'
          : 'rgba(148, 163, 184, 0.35)';

      ctx.fillStyle = lane.alertActive
        ? 'rgba(243, 128, 32, 0.16)'
        : lane.savedFlashTimer > 0
          ? 'rgba(0, 255, 157, 0.14)'
          : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lane.alertActive ? 2.5 : 1.5;

      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 8);
      ctx.fill();
      ctx.stroke();

      // Hotkey pill
      ctx.fillStyle = lane.alertActive ? '#f38020' : '#1e293b';
      ctx.beginPath();
      ctx.roundRect(box.x + 10, box.y + 12, 26, 26, 6);
      ctx.fill();

      ctx.fillStyle = lane.alertActive ? '#080b12' : '#e2e8f0';
      ctx.font = '800 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lane.hotkey, box.x + 23, box.y + 30);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.fillText(lane.displayName, box.x + 46, box.y + 26);

      if (lane.alertActive) {
        ctx.fillStyle = '#fdba74';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.fillText(`403 DENIED: ${lane.deniedModel} — PRESS [${lane.hotkey}]!`, box.x + 46, box.y + 46);

        const ratio = Math.max(0, lane.alertTimer / lane.alertMaxTimer);
        ctx.fillStyle = 'rgba(255, 51, 102, 0.25)';
        ctx.fillRect(box.x + 10, box.y + 56, box.w - 20, 6);
        ctx.fillStyle = ratio < 0.35 ? '#ff3366' : '#f38020';
        ctx.fillRect(box.x + 10, box.y + 56, (box.w - 20) * ratio, 6);
      } else {
        ctx.fillStyle = lane.savedFlashTimer > 0 ? '#00ff9d' : '#64748b';
        ctx.font = '500 11px ui-monospace, monospace';
        ctx.fillText(
          lane.savedFlashTimer > 0 ? 'AUTO-FALLBACK SAVED (TIER: FREE)' : `${lane.modelId} • READY`,
          box.x + 46,
          box.y + 47
        );
      }

      ctx.restore();
    });
  };

  const drawUpstreams = (nodes: ReadonlyArray<UpstreamNodeState>, time: number): void => {
    nodes.forEach((node, i) => {
      const box = UPSTREAM_BOXES[i];
      ctx.save();

      const flash = node.isRogue ? 0.5 + 0.5 * Math.sin(time * 22) : 0;
      const borderColor = node.isRogue
        ? `rgba(255, 51, 102, ${0.55 + flash * 0.45})`
        : node.gradeFlashTimer > 0 && node.lastGrade === 'F'
          ? '#facc15'
          : 'rgba(56, 189, 248, 0.3)';

      ctx.fillStyle = node.isRogue
        ? 'rgba(255, 51, 102, 0.14)'
        : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = node.isRogue ? 2.2 : 1.5;

      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 8);
      ctx.fill();
      ctx.stroke();

      // Grade badge
      const showingRogueHint = node.isRogue && node.rogueElapsed > 0.7;
      const gradeLabel = showingRogueHint ? '?' : node.lastGrade;
      const badgeColor =
        showingRogueHint
          ? '#ff3366'
          : node.gradeFlashTimer > 0 && node.lastGrade === 'F'
            ? '#facc15'
            : '#00ff9d';

      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(box.x + box.w - 42, box.y + 12, 30, 38, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeColor;
      ctx.font = '800 16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gradeLabel, box.x + box.w - 27, box.y + 37);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.fillText(node.name, box.x + 14, box.y + 24);

      ctx.fillStyle = node.isRogue ? '#fda4af' : '#94a3b8';
      ctx.font = '500 11px ui-monospace, monospace';
      const sub = node.isRogue
        ? `SUSPECT: ${node.deceptionReason} [PROBE!]`
        : `${node.vendorHint} • AUTHENTIC`;
      ctx.fillText(sub, box.x + 14, box.y + 44);

      ctx.restore();
    });
  };

  const render = (state: Readonly<GameState>, dt: number): void => {
    ctx.save();
    if (state.screenShake > 0.5) {
      const dx = (Math.random() - 0.5) * state.screenShake;
      const dy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(dx, dy);
    }

    drawGrid(state.elapsedTime, state.overclockTimer > 0);
    drawWafBarrier(state);

    // Signature scan pulse wave
    if (scanWaveProgress >= 0) {
      scanWaveProgress += dt * 2.2;
      const waveX = Math.min(WAF_BARRIER_X, scanWaveProgress * WAF_BARRIER_X);
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(waveX, 32);
      ctx.lineTo(waveX, ARENA_HEIGHT - 16);
      ctx.stroke();
      if (scanWaveProgress >= 1) {
        scanWaveProgress = -1;
      }
    }

    for (const p of state.packets) {
      drawPacket(p, state.elapsedTime);
    }

    drawGatewayLanes(state.lanes, state.elapsedTime);
    drawUpstreams(state.upstreams, state.elapsedTime);

    // Crosshair in WAF zone
    if (state.isRunning && pointerX < WAF_BARRIER_X) {
      ctx.strokeStyle = 'rgba(0, 255, 157, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, 18, 0, Math.PI * 2);
      ctx.moveTo(pointerX - 24, pointerY);
      ctx.lineTo(pointerX + 24, pointerY);
      ctx.moveTo(pointerX, pointerY - 24);
      ctx.lineTo(pointerX, pointerY + 24);
      ctx.stroke();
    }

    // Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.life -= dt;
      if (l.life <= 0) {
        lasers.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = l.life / 0.16;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(l.fromX, l.fromY);
      ctx.lineTo(l.toX, l.toY);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.restore();
    }

    // Floating battle texts
    for (let i = floats.length - 1; i >= 0; i--) {
      const ft = floats[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        floats.splice(i, 1);
        continue;
      }
      ft.y -= 28 * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life * 1.4);
      ctx.fillStyle = ft.color;
      ctx.font = '800 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  };

  return {
    ingestEvents,
    setPointer: (x: number, y: number) => {
      pointerX = x;
      pointerY = y;
    },
    triggerScanWave: () => {
      scanWaveProgress = 0;
    },
    render
  };
}
