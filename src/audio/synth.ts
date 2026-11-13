import type { SoundEvent } from '../engine/types.ts';

/**
 * 純 Web Audio API 合成音效引擎，無任何外部音檔依賴。
 */
export interface ArcadeSynth {
  play(event: SoundEvent): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  unlock(): void;
}

export function createArcadeSynth(): ArcadeSynth {
  let ctx: AudioContext | null = null;
  let muted = false;

  const ensureContext = (): AudioContext | null => {
    if (muted || typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  };

  const tone = (
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainVal: number,
    delay: number = 0
  ): void => {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  };

  const play = (event: SoundEvent): void => {
    switch (event) {
      case 'waf_block':
        tone(680, 1280, 0.09, 'triangle', 0.14);
        break;
      case 'legit_pass':
        tone(520, 780, 0.07, 'sine', 0.07);
        break;
      case 'false_positive':
        tone(220, 110, 0.18, 'sawtooth', 0.14);
        break;
      case 'waf_breach':
        tone(180, 55, 0.25, 'sawtooth', 0.18);
        break;
      case 'scan_pulse':
        tone(340, 1400, 0.22, 'sine', 0.12);
        tone(680, 1760, 0.18, 'triangle', 0.08, 0.04);
        break;
      case 'fallback_saved':
        tone(440, 660, 0.08, 'triangle', 0.12);
        tone(660, 880, 0.12, 'triangle', 0.12, 0.07);
        break;
      case 'gateway_timeout':
        tone(280, 90, 0.28, 'square', 0.15);
        break;
      case 'probe_clean':
        tone(880, 1046, 0.1, 'sine', 0.09);
        break;
      case 'rogue_busted':
        tone(523, 1046, 0.1, 'square', 0.12);
        tone(659, 1318, 0.12, 'square', 0.12, 0.08);
        tone(784, 1568, 0.18, 'triangle', 0.14, 0.16);
        break;
      case 'game_over':
        tone(300, 120, 0.22, 'sawtooth', 0.16);
        tone(200, 60, 0.42, 'sawtooth', 0.16, 0.2);
        break;
    }
  };

  return {
    play,
    setMuted: (value: boolean) => {
      muted = value;
    },
    isMuted: () => muted,
    unlock: () => {
      ensureContext();
    }
  };
}
