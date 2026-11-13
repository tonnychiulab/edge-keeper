import { describe, expect, it } from 'vitest';
import { createEdgeKeeperEngine } from '../src/engine/engine.ts';

describe('EdgeKeeper Headless Engine', () => {
  it('produces identical state for identical seeds and ticks', () => {
    const a = createEdgeKeeperEngine(777);
    const b = createEdgeKeeperEngine(777);
    a.start();
    b.start();

    for (let i = 0; i < 90; i++) {
      a.tick(0.05);
      b.tick(0.05);
    }

    expect(a.getState()).toEqual(b.getState());
  });

  it('blocks attack packets with 403 and penalizes false positives on legit traffic', () => {
    const engine = createEdgeKeeperEngine(101);
    engine.start();

    for (let i = 0; i < 80; i++) {
      engine.tick(0.05);
    }

    const attack = engine.getState().packets.find((p) => p.kind !== 'legit');
    expect(attack).toBeDefined();
    if (attack) {
      const events = engine.interceptAt(attack.x, attack.y);
      expect(events.sounds).toContain('waf_block');
      expect(engine.getState().stats.blockedAttacks).toBeGreaterThanOrEqual(1);
    }

    for (let i = 0; i < 80; i++) {
      if (engine.getState().packets.some((p) => p.kind === 'legit')) break;
      engine.tick(0.05);
    }

    const legit = engine.getState().packets.find((p) => p.kind === 'legit');
    expect(legit).toBeDefined();
    if (legit) {
      const beforeSla = engine.getState().slaIntegrity;
      const events = engine.interceptAt(legit.x, legit.y);
      expect(events.sounds).toContain('false_positive');
      expect(engine.getState().stats.falsePositives).toBe(1);
      expect(engine.getState().slaIntegrity).toBeLessThan(beforeSla);
    }
  });

  it('reveals and slows obfuscated packets when triggering Signature Scan', () => {
    const engine = createEdgeKeeperEngine(555);
    engine.start();

    let foundUnrevealed = false;
    for (let i = 0; i < 600; i++) {
      engine.tick(0.05);
      if (engine.getState().packets.some((p) => p.kind === 'obfuscated' && !p.revealed)) {
        foundUnrevealed = true;
        break;
      }
    }

    expect(foundUnrevealed).toBe(true);
    const beforeVx = engine.getState().packets.find((p) => p.kind === 'obfuscated' && !p.revealed)!.vx;
    const events = engine.triggerSignatureScan();
    expect(events.sounds).toContain('scan_pulse');

    const afterObf = engine.getState().packets.find((p) => p.kind === 'obfuscated');
    expect(afterObf?.revealed).toBe(true);
    expect(afterObf!.vx).toBeLessThan(beforeVx);
  });

  it('triggers Auto-Router 403 alert and saves SLA when rerouted to free lane', () => {
    const engine = createEdgeKeeperEngine(2026);
    engine.start();

    let alertLaneIndex = -1;
    for (let i = 0; i < 150; i++) {
      engine.tick(0.05);
      const alertLane = engine.getState().lanes.find((l) => l.alertActive);
      if (alertLane) {
        alertLaneIndex = alertLane.index;
        break;
      }
    }

    expect(alertLaneIndex).toBeGreaterThanOrEqual(0);
    const events = engine.rerouteGatewayLane(alertLaneIndex);
    expect(events.sounds).toContain('fallback_saved');
    expect(engine.getState().stats.fallbacksSaved).toBe(1);
    expect(engine.getState().lanes[alertLaneIndex].alertActive).toBe(false);
  });

  it('inflicts gateway timeout penalty when 403 alert is not rerouted in time', () => {
    const engine = createEdgeKeeperEngine(2026);
    engine.start();

    let timedOut = false;
    for (let i = 0; i < 240; i++) {
      const events = engine.tick(0.05);
      if (events.sounds.includes('gateway_timeout')) {
        timedOut = true;
        break;
      }
    }

    expect(timedOut).toBe(true);
    expect(engine.getState().stats.gatewayTimeouts).toBeGreaterThanOrEqual(1);
    expect(engine.getState().slaIntegrity).toBeLessThan(100);
  });

  it('busts Grade F rogue upstream via Authenticity Probe and activates Overclock auto-defense', () => {
    const engine = createEdgeKeeperEngine(9001);
    engine.start();

    let rogueIndex = -1;
    for (let i = 0; i < 240; i++) {
      engine.tick(0.05);
      const rogue = engine.getState().upstreams.find((u) => u.isRogue);
      if (rogue) {
        rogueIndex = rogue.index;
        break;
      }
    }

    expect(rogueIndex).toBeGreaterThanOrEqual(0);
    const events = engine.probeUpstream(rogueIndex);
    expect(events.sounds).toContain('rogue_busted');
    expect(engine.getState().stats.roguesBusted).toBe(1);
    expect(engine.getState().overclockTimer).toBeGreaterThan(0);
    expect(engine.getState().upstreams[rogueIndex].lastGrade).toBe('F');

    const slaDuringOverclock = engine.getState().slaIntegrity;
    for (let i = 0; i < 40; i++) {
      engine.tick(0.05);
    }
    expect(engine.getState().slaIntegrity).toBeGreaterThanOrEqual(slaDuringOverclock);
  });

  it('transitions to Game Over cleanly when SLA reaches 0 and stops further mutations', () => {
    const engine = createEdgeKeeperEngine(4032026);
    engine.start();

    for (let i = 0; i < 900; i++) {
      engine.tick(0.05);
      if (engine.getState().isGameOver) break;
    }

    const finalState = engine.getState();
    expect(finalState.isGameOver).toBe(true);
    expect(finalState.isRunning).toBe(false);
    expect(finalState.slaIntegrity).toBe(0);
    expect(finalState.deathReason).toBeTruthy();

    engine.tick(0.05);
    expect(engine.getState()).toEqual(finalState);
  });
});
