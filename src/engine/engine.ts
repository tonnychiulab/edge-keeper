import {
  AGENT_TRAFFIC_SAMPLES,
  ATTACK_SAMPLES,
  GATEWAY_LANES,
  PAID_DENIED_MODELS,
  ROGUE_DECEPTIONS,
  UPSTREAM_NODES
} from '../data/catalog.ts';
import { createPRNG } from './prng.ts';
import type {
  EdgeKeeperEngine,
  EngineTickEvents,
  FloatingTextEvent,
  GameState,
  GatewayLaneState,
  LaserBurstEvent,
  LogSeverity,
  PacketEntity,
  PacketKind,
  PipelineEvent,
  PipelineSource,
  SoundEvent,
  UpstreamNodeState
} from './types.ts';

export const ARENA_WIDTH = 1000;
export const ARENA_HEIGHT = 600;
export const WAF_BARRIER_X = 610;
export const TURRET_X = 610;
export const TURRET_Y = 300;
export const DEFAULT_BLAST_RADIUS = 44;

const SCAN_COOLDOWN = 4.0;
const PROBE_COOLDOWN = 2.5;
const OVERCLOCK_DURATION = 4.5;
const MAX_LOGS = 8;

interface MutableStats {
  blockedAttacks: number;
  missedAttacks: number;
  falsePositives: number;
  legitPassed: number;
  fallbacksSaved: number;
  gatewayTimeouts: number;
  roguesBusted: number;
}

interface MutablePacket extends PacketEntity {
  x: number;
  revealed: boolean;
}

interface MutableLane extends GatewayLaneState {
  alertActive: boolean;
  deniedModel: string | null;
  alertTimer: number;
  alertMaxTimer: number;
  savedFlashTimer: number;
}

interface MutableUpstream extends UpstreamNodeState {
  isRogue: boolean;
  deceptionReason: string | null;
  rogueElapsed: number;
  lastGrade: 'A' | 'F';
  gradeFlashTimer: number;
}

/**
 * 建立無頭核心遊戲狀態機。與 DOM / Canvas / Audio 完全解耦，供瀏覽器與 Vitest 共用。
 */
export function createEdgeKeeperEngine(seed: number = 4032026): EdgeKeeperEngine {
  const rng = createPRNG(seed);

  let isRunning = false;
  let isGameOver = false;
  let elapsedTime = 0;
  let wave = 1;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let slaIntegrity = 100;
  let scanCooldown = 0;
  let probeCooldown = 0;
  let overclockTimer = 0;
  let screenShake = 0;
  let deathReason: string | null = null;

  let nextId = 1;
  let spawnTimer = 0.4;
  let gatewayEventTimer = 4.2;
  let rogueEventTimer = 7.5;

  const packets: MutablePacket[] = [];
  const logs: PipelineEvent[] = [];

  const lanes: MutableLane[] = GATEWAY_LANES.map((def, index) => ({
    index,
    modelId: def.modelId,
    displayName: def.displayName,
    hotkey: def.hotkey,
    alertActive: false,
    deniedModel: null,
    alertTimer: 0,
    alertMaxTimer: 4.5,
    savedFlashTimer: 0
  }));

  const upstreams: MutableUpstream[] = UPSTREAM_NODES.map((def, index) => ({
    index,
    name: def.name,
    vendorHint: def.vendorHint,
    isRogue: false,
    deceptionReason: null,
    rogueElapsed: 0,
    lastGrade: 'A',
    gradeFlashTimer: 0
  }));

  const stats: MutableStats = {
    blockedAttacks: 0,
    missedAttacks: 0,
    falsePositives: 0,
    legitPassed: 0,
    fallbacksSaved: 0,
    gatewayTimeouts: 0,
    roguesBusted: 0
  };

  let pendingSounds: SoundEvent[] = [];
  let pendingTexts: FloatingTextEvent[] = [];
  let pendingLasers: LaserBurstEvent[] = [];

  const pushLog = (
    source: PipelineSource,
    severity: LogSeverity,
    messageKey: string,
    detail: string
  ): void => {
    logs.unshift({
      id: nextId++,
      timestamp: elapsedTime,
      source,
      severity,
      messageKey,
      detail
    });
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS;
    }
  };

  const addFloat = (x: number, y: number, text: string, color: string): void => {
    pendingTexts.push({ id: nextId++, x, y, text, color });
  };

  const addLaser = (toX: number, toY: number, color: string): void => {
    pendingLasers.push({
      id: nextId++,
      fromX: TURRET_X,
      fromY: TURRET_Y,
      toX,
      toY,
      color
    });
  };

  const addScore = (base: number): number => {
    const multiplier = Math.min(8, 1 + Math.floor(combo / 5));
    const overclockBonus = overclockTimer > 0 ? 2 : 1;
    const gained = base * multiplier * overclockBonus;
    score += gained;
    return gained;
  };

  const bumpCombo = (): void => {
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;
  };

  const applyDamage = (amount: number, reason: string): void => {
    if (overclockTimer > 0) return;
    slaIntegrity = Math.max(0, slaIntegrity - amount);
    screenShake = Math.min(14, screenShake + 6);
    if (slaIntegrity <= 0 && !isGameOver) {
      isGameOver = true;
      isRunning = false;
      deathReason = reason;
      pendingSounds.push('game_over');
      pushLog('system', 'danger', 'sla_collapsed', reason);
    }
  };

  const flushEvents = (): EngineTickEvents => {
    const out: EngineTickEvents = {
      sounds: pendingSounds,
      floatingTexts: pendingTexts,
      lasers: pendingLasers
    };
    pendingSounds = [];
    pendingTexts = [];
    pendingLasers = [];
    return out;
  };

  const spawnPacket = (): void => {
    const roll = rng.next();
    let kind: PacketKind = 'attack';
    if (roll < 0.28) {
      kind = 'legit';
    } else if (roll < 0.45 && wave >= 2) {
      kind = 'obfuscated';
    }

    const baseSpeed = 95 + Math.min(150, (wave - 1) * 18);
    const y = rng.range(72, ARENA_HEIGHT - 72);

    if (kind === 'legit') {
      const sample = rng.pick(AGENT_TRAFFIC_SAMPLES);
      packets.push({
        id: nextId++,
        kind,
        category: sample.agent,
        label: `${sample.agent}: ${sample.action}`,
        x: 24,
        y,
        vx: baseSpeed * 0.92,
        radius: 17,
        revealed: true
      });
      return;
    }

    const attack = rng.pick(ATTACK_SAMPLES);
    packets.push({
      id: nextId++,
      kind,
      category: attack.category,
      label: kind === 'obfuscated' ? attack.obfuscatedLabel : attack.label,
      x: 24,
      y,
      vx: baseSpeed * (kind === 'obfuscated' ? 1.08 : rng.range(0.95, 1.18)),
      radius: kind === 'obfuscated' ? 18 : 20,
      revealed: kind !== 'obfuscated'
    });
  };

  const triggerGatewayAlert = (): void => {
    const idleLanes = lanes.filter((l) => !l.alertActive);
    if (idleLanes.length === 0) return;
    const target = rng.pick(idleLanes);
    const deniedModel = rng.pick(PAID_DENIED_MODELS);
    const windowSec = Math.max(2.9, 4.8 - (wave - 1) * 0.22);

    target.alertActive = true;
    target.deniedModel = deniedModel;
    target.alertTimer = windowSec;
    target.alertMaxTimer = windowSec;

    pushLog('auto-router', 'warn', 'gateway_403_alert', `403 ${deniedModel} -> [${target.hotkey}]`);
  };

  const triggerRogueUpstream = (): void => {
    const cleanNodes = upstreams.filter((u) => !u.isRogue);
    if (cleanNodes.length === 0 || upstreams.some((u) => u.isRogue)) return;
    const target = rng.pick(cleanNodes);
    const reason = rng.pick(ROGUE_DECEPTIONS);

    target.isRogue = true;
    target.deceptionReason = reason;
    target.rogueElapsed = 0;

    pushLog('casbin-gateway', 'warn', 'upstream_suspicious', `${target.name}: ${reason}`);
  };

  const start = (): void => {
    isRunning = true;
    isGameOver = false;
    pushLog('system', 'info', 'engine_online', `SEED #${seed}`);
  };

  const tick = (rawDt: number): EngineTickEvents => {
    const dt = Math.min(0.1, Math.max(0, rawDt));
    if (!isRunning || isGameOver || dt === 0) {
      return flushEvents();
    }

    elapsedTime += dt;
    wave = 1 + Math.floor(elapsedTime / 15);
    if (scanCooldown > 0) scanCooldown = Math.max(0, scanCooldown - dt);
    if (probeCooldown > 0) probeCooldown = Math.max(0, probeCooldown - dt);
    if (overclockTimer > 0) overclockTimer = Math.max(0, overclockTimer - dt);
    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 28);

    // Spawn waves
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPacket();
      const minInterval = Math.max(0.38, 1.25 - (wave - 1) * 0.1);
      spawnTimer = rng.range(minInterval, minInterval + 0.45);
    }

    // Trigger Auto-Router 403 alerts
    gatewayEventTimer -= dt;
    if (gatewayEventTimer <= 0) {
      triggerGatewayAlert();
      gatewayEventTimer = rng.range(Math.max(2.6, 5.2 - wave * 0.25), 6.4);
    }

    // Trigger Casbin rogue upstream
    rogueEventTimer -= dt;
    if (rogueEventTimer <= 0) {
      triggerRogueUpstream();
      rogueEventTimer = rng.range(7.0, 11.0);
    }

    // Move packets & handle WAF barrier collisions
    const speedFactor = overclockTimer > 0 ? 0.65 : 1;
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.x += p.vx * speedFactor * dt;

      if (p.x >= WAF_BARRIER_X) {
        packets.splice(i, 1);
        if (p.kind === 'legit') {
          stats.legitPassed += 1;
          bumpCombo();
          const gained = addScore(50);
          pendingSounds.push('legit_pass');
          addFloat(WAF_BARRIER_X - 24, p.y, `200 OK +${gained}`, '#38bdf8');
        } else if (overclockTimer > 0) {
          // Zero Trust Overclock auto-blocks incoming attacks
          stats.blockedAttacks += 1;
          bumpCombo();
          const gained = addScore(120);
          pendingSounds.push('waf_block');
          addLaser(p.x, p.y, '#facc15');
          addFloat(WAF_BARRIER_X - 28, p.y, `AUTO 403 +${gained}`, '#facc15');
        } else {
          stats.missedAttacks += 1;
          combo = 0;
          pendingSounds.push('waf_breach');
          addFloat(WAF_BARRIER_X - 24, p.y, `200 BYPASSED! -10%`, '#ff3366');
          pushLog('waf-checker', 'danger', 'waf_bypassed', `${p.category}: ${p.label}`);
          applyDamage(10, `WAF 200 Bypassed (${p.category})`);
        }
      }
    }

    // Update Auto-Router lanes
    for (const lane of lanes) {
      if (lane.savedFlashTimer > 0) {
        lane.savedFlashTimer = Math.max(0, lane.savedFlashTimer - dt);
      }
      if (!lane.alertActive) continue;

      lane.alertTimer -= dt;
      if (lane.alertTimer <= 0) {
        const failedModel = lane.deniedModel ?? 'paid-model';
        lane.alertActive = false;
        lane.deniedModel = null;
        lane.alertTimer = 0;
        stats.gatewayTimeouts += 1;
        combo = 0;
        pendingSounds.push('gateway_timeout');
        addFloat(790, 100 + lane.index * 75, `403 TIMEOUT! -12%`, '#ff3366');
        pushLog('auto-router', 'danger', 'gateway_timeout', `${failedModel} [Lane ${lane.hotkey}]`);
        applyDamage(12, `Auto-Router 403 Timeout (${failedModel})`);
      }
    }

    // Update Casbin upstream nodes
    for (const node of upstreams) {
      if (node.gradeFlashTimer > 0) {
        node.gradeFlashTimer = Math.max(0, node.gradeFlashTimer - dt);
      }
      if (!node.isRogue) continue;
      node.rogueElapsed += dt;
      if (node.rogueElapsed > 1.5 && overclockTimer <= 0) {
        applyDamage(1.8 * dt, `Rogue Reseller (${node.name}: ${node.deceptionReason})`);
      }
    }

    return flushEvents();
  };

  const interceptAt = (x: number, y: number, blastRadius: number = DEFAULT_BLAST_RADIUS): EngineTickEvents => {
    if (!isRunning || isGameOver) return flushEvents();

    let hitIndex = -1;
    let bestDist = Infinity;

    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist <= blastRadius + p.radius && dist < bestDist) {
        bestDist = dist;
        hitIndex = i;
      }
    }

    if (hitIndex === -1) {
      addLaser(x, y, 'rgba(56, 189, 248, 0.35)');
      return flushEvents();
    }

    const target = packets[hitIndex];
    packets.splice(hitIndex, 1);

    if (target.kind === 'legit') {
      stats.falsePositives += 1;
      combo = 0;
      pendingSounds.push('false_positive');
      addLaser(target.x, target.y, '#fb923c');
      addFloat(target.x, target.y - 10, 'FALSE POSITIVE! -6%', '#fb923c');
      pushLog('waf-checker', 'warn', 'false_positive', target.label);
      applyDamage(6, `WAF False Positive (${target.category})`);
    } else {
      stats.blockedAttacks += 1;
      bumpCombo();
      const basePoints = target.kind === 'obfuscated' ? 180 : 100;
      const gained = addScore(basePoints);
      pendingSounds.push('waf_block');
      addLaser(target.x, target.y, '#00ff9d');
      addFloat(target.x, target.y - 10, `403 BLOCKED +${gained}`, '#00ff9d');
      pushLog('waf-checker', 'ok', 'waf_blocked', `${target.category} (${target.label})`);
    }

    return flushEvents();
  };

  const triggerSignatureScan = (): EngineTickEvents => {
    if (!isRunning || isGameOver || scanCooldown > 0) return flushEvents();
    scanCooldown = SCAN_COOLDOWN;
    pendingSounds.push('scan_pulse');

    let revealedCount = 0;
    for (const p of packets) {
      if (!p.revealed) {
        p.revealed = true;
        revealedCount += 1;
        addFloat(p.x, p.y - 14, 'DECODED!', '#e879f9');
      }
    }

    if (revealedCount > 0) {
      const gained = addScore(revealedCount * 60);
      pushLog('waf-checker', 'info', 'signature_scan_hit', `${revealedCount} obfuscated (+${gained})`);
    } else {
      pushLog('waf-checker', 'info', 'signature_scan_clear', '0 obfuscated');
    }

    return flushEvents();
  };

  const rerouteGatewayLane = (laneIndex: number): EngineTickEvents => {
    if (!isRunning || isGameOver) return flushEvents();
    const lane = lanes[laneIndex];
    if (!lane || !lane.alertActive) return flushEvents();

    const denied = lane.deniedModel ?? 'paid-model';
    lane.alertActive = false;
    lane.deniedModel = null;
    lane.alertTimer = 0;
    lane.savedFlashTimer = 1.2;

    stats.fallbacksSaved += 1;
    bumpCombo();
    const gained = addScore(250);
    slaIntegrity = Math.min(100, slaIntegrity + 2);
    pendingSounds.push('fallback_saved');
    addFloat(800, 95 + lane.index * 75, `FALLBACK OK +${gained}`, '#f38020');
    pushLog('auto-router', 'ok', 'fallback_saved', `${denied} -> ${lane.modelId}`);

    return flushEvents();
  };

  const probeUpstream = (nodeIndex?: number): EngineTickEvents => {
    if (!isRunning || isGameOver || probeCooldown > 0) return flushEvents();
    probeCooldown = PROBE_COOLDOWN;

    const candidates =
      typeof nodeIndex === 'number' && upstreams[nodeIndex]
        ? [upstreams[nodeIndex]]
        : upstreams;

    const bustedNodes = candidates.filter((n) => n.isRogue);

    if (bustedNodes.length === 0) {
      for (const n of candidates) {
        n.lastGrade = 'A';
        n.gradeFlashTimer = 1.2;
      }
      pendingSounds.push('probe_clean');
      addFloat(800, 360, 'GRADE A - AUTHENTIC', '#38bdf8');
      pushLog('casbin-gateway', 'info', 'probe_grade_a', 'All probed nodes verified A');
      return flushEvents();
    }

    for (const rogue of bustedNodes) {
      const reason = rogue.deceptionReason ?? 'Bait-and-Switch';
      rogue.isRogue = false;
      rogue.deceptionReason = null;
      rogue.rogueElapsed = 0;
      rogue.lastGrade = 'F';
      rogue.gradeFlashTimer = 2.0;

      stats.roguesBusted += 1;
      bumpCombo();
      const gained = addScore(500);
      slaIntegrity = Math.min(100, slaIntegrity + 5);
      overclockTimer = OVERCLOCK_DURATION;
      screenShake = 8;

      pendingSounds.push('rogue_busted');
      addFloat(800, 375 + rogue.index * 68, `GRADE F BUSTED! +${gained}`, '#facc15');
      pushLog('casbin-gateway', 'ok', 'rogue_busted', `${rogue.name}: ${reason}`);
    }

    // Overclock shockwave clears hostile packets currently in WAF corridor
    for (let i = packets.length - 1; i >= 0; i--) {
      if (packets[i].kind !== 'legit') {
        const cleared = packets[i];
        packets.splice(i, 1);
        stats.blockedAttacks += 1;
        addLaser(cleared.x, cleared.y, '#facc15');
      }
    }

    return flushEvents();
  };

  const getState = (): Readonly<GameState> => ({
    seed,
    isRunning,
    isGameOver,
    elapsedTime,
    wave,
    score,
    combo,
    maxCombo,
    slaIntegrity,
    scanCooldown,
    scanMaxCooldown: SCAN_COOLDOWN,
    probeCooldown,
    probeMaxCooldown: PROBE_COOLDOWN,
    overclockTimer,
    screenShake,
    deathReason,
    packets: packets.map((p) => ({ ...p })),
    lanes: lanes.map((l) => ({ ...l })),
    upstreams: upstreams.map((u) => ({ ...u })),
    logs: logs.map((e) => ({ ...e })),
    stats: { ...stats }
  });

  return {
    start,
    tick,
    interceptAt,
    triggerSignatureScan,
    rerouteGatewayLane,
    probeUpstream,
    getState
  };
}
