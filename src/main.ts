import './styles/main.css';
import { createArcadeSynth } from './audio/synth.ts';
import { ARENA_HEIGHT, ARENA_WIDTH, WAF_BARRIER_X, createEdgeKeeperEngine } from './engine/engine.ts';
import type { EngineTickEvents, GameState } from './engine/types.ts';
import { LANE_BOXES, UPSTREAM_BOXES, createCanvasRenderer, hitTestBox } from './renderer/canvas.ts';
import { LOCALES, type Locale, syncBrowserFavicon } from './ui/i18n.ts';

function parseSeedFromHash(): number {
  const match = window.location.hash.match(/seed=(\d+)/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return Math.floor(100000 + Math.random() * 900000);
}

const synth = createArcadeSynth();
const canvas = document.getElementById('arena') as HTMLCanvasElement;
const renderer = createCanvasRenderer(canvas);

let locale: Locale = 'zh-TW';
let currentSeed = parseSeedFromHash();
let engine = createEdgeKeeperEngine(currentSeed);
let lastFrame = performance.now();
let gameOverRendered = false;

const el = {
  heroTitle: document.getElementById('hero-title')!,
  heroSubtitle: document.getElementById('hero-subtitle')!,
  badgeProjects: document.getElementById('badge-projects')!,
  startTitle: document.getElementById('start-title')!,
  ruleWaf: document.getElementById('rule-waf')!,
  ruleRouter: document.getElementById('rule-router')!,
  ruleCasbin: document.getElementById('rule-casbin')!,
  btnStart: document.getElementById('btn-start') as HTMLButtonElement,
  btnRestart: document.getElementById('btn-restart') as HTMLButtonElement,
  btnCopy: document.getElementById('btn-copy') as HTMLButtonElement,
  btnScan: document.getElementById('btn-scan') as HTMLButtonElement,
  btnProbe: document.getElementById('btn-probe') as HTMLButtonElement,
  btnMute: document.getElementById('btn-mute') as HTMLButtonElement,
  btnLang: document.getElementById('btn-lang') as HTMLButtonElement,
  labelScore: document.getElementById('label-score')!,
  labelCombo: document.getElementById('label-combo')!,
  labelWave: document.getElementById('label-wave')!,
  labelSla: document.getElementById('label-sla')!,
  labelSeed: document.getElementById('label-seed')!,
  labelPipeline: document.getElementById('label-pipeline')!,
  valScore: document.getElementById('val-score')!,
  valCombo: document.getElementById('val-combo')!,
  valWave: document.getElementById('val-wave')!,
  valSla: document.getElementById('val-sla')!,
  valSeed: document.getElementById('val-seed')!,
  slaBar: document.getElementById('sla-bar')!,
  overclockBanner: document.getElementById('overclock-banner')!,
  startOverlay: document.getElementById('start-overlay')!,
  gameOverOverlay: document.getElementById('gameover-overlay')!,
  gameOverTitle: document.getElementById('gameover-title')!,
  gameOverCause: document.getElementById('gameover-cause')!,
  gameOverStats: document.getElementById('gameover-stats')!,
  pipelineLogs: document.getElementById('pipeline-logs')!,
  hintControls: document.getElementById('hint-controls')!
};

function dispatchEvents(events: EngineTickEvents): void {
  renderer.ingestEvents(events);
  for (const s of events.sounds) {
    synth.play(s);
  }
}

function applyLocaleText(): void {
  const dict = LOCALES[locale];
  document.documentElement.lang = locale;
  el.heroTitle.textContent = dict.heroTitle;
  el.heroSubtitle.textContent = dict.heroSubtitle;
  el.badgeProjects.textContent = dict.badgeProjects;
  el.startTitle.textContent = dict.heroTitle;
  el.ruleWaf.textContent = dict.rulesWaf;
  el.ruleRouter.textContent = dict.rulesRouter;
  el.ruleCasbin.textContent = dict.rulesCasbin;
  el.btnStart.textContent = dict.btnStart;
  el.btnRestart.textContent = dict.btnPlayAgain;
  el.btnCopy.textContent = dict.btnCopyReport;
  el.btnLang.textContent = dict.btnLang;
  el.btnMute.textContent = synth.isMuted() ? dict.btnMuteOn : dict.btnMuteOff;
  el.labelScore.textContent = dict.labelScore;
  el.labelCombo.textContent = dict.labelCombo;
  el.labelWave.textContent = dict.labelWave;
  el.labelSla.textContent = dict.labelSla;
  el.labelSeed.textContent = dict.labelSeed;
  el.labelPipeline.textContent = dict.labelPipeline;
  el.overclockBanner.textContent = dict.overclockBanner;
  el.hintControls.textContent = dict.hintControls;
  el.gameOverTitle.textContent = dict.gameOverTitle;
}

function toArenaCoords(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * ARENA_WIDTH,
    y: ((clientY - rect.top) / rect.height) * ARENA_HEIGHT
  };
}

function startNewRun(newSeed?: number): void {
  synth.unlock();
  currentSeed = newSeed ?? Math.floor(100000 + Math.random() * 900000);
  window.history.replaceState(null, '', `#seed=${currentSeed}`);
  engine = createEdgeKeeperEngine(currentSeed);
  engine.start();
  gameOverRendered = false;
  el.startOverlay.classList.add('hidden');
  el.gameOverOverlay.classList.add('hidden');
}

function renderGameOver(state: Readonly<GameState>): void {
  const dict = LOCALES[locale];
  el.gameOverCause.textContent = `${dict.labelCause}: ${state.deathReason ?? 'Unknown'}`;
  const items = [
    [dict.statBlocked, String(state.stats.blockedAttacks)],
    [dict.statFallback, String(state.stats.fallbacksSaved)],
    [dict.statRogues, String(state.stats.roguesBusted)],
    [dict.statFalsePos, String(state.stats.falsePositives)],
    [dict.statLegit, String(state.stats.legitPassed)],
    [dict.statMaxCombo, `${state.maxCombo}x`]
  ];
  el.gameOverStats.innerHTML = '';
  for (const [label, val] of items) {
    const box = document.createElement('div');
    box.className = 'stat-box';
    const l = document.createElement('div');
    l.className = 'hud-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'hud-value';
    v.textContent = val;
    box.append(l, v);
    el.gameOverStats.appendChild(box);
  }
  el.gameOverOverlay.classList.remove('hidden');
}

function updateHud(state: Readonly<GameState>): void {
  const dict = LOCALES[locale];
  el.valScore.textContent = String(state.score);
  el.valCombo.textContent = `${state.combo}x`;
  el.valWave.textContent = String(state.wave);
  el.valSla.textContent = `${Math.ceil(state.slaIntegrity)}%`;
  el.valSeed.textContent = `#${state.seed}`;

  el.slaBar.style.width = `${state.slaIntegrity}%`;
  el.slaBar.style.background =
    state.slaIntegrity > 60 ? '#00ff9d' : state.slaIntegrity > 30 ? '#f38020' : '#ff3366';

  el.overclockBanner.classList.toggle('hidden', state.overclockTimer <= 0);

  el.btnScan.disabled = !state.isRunning || state.scanCooldown > 0;
  el.btnScan.textContent =
    state.scanCooldown > 0 ? `${dict.btnScan} (${state.scanCooldown.toFixed(1)}s)` : dict.btnScan;

  el.btnProbe.disabled = !state.isRunning || state.probeCooldown > 0;
  el.btnProbe.textContent =
    state.probeCooldown > 0 ? `${dict.btnProbe} (${state.probeCooldown.toFixed(1)}s)` : dict.btnProbe;

  if (state.isGameOver) {
    document.title = dict.browserTitleGameOver(state.score);
    syncBrowserFavicon(true);
    if (!gameOverRendered) {
      gameOverRendered = true;
      renderGameOver(state);
    }
  } else if (state.isRunning) {
    document.title = dict.browserTitleActive(state.slaIntegrity, state.score);
    syncBrowserFavicon(state.slaIntegrity < 35);
  } else {
    document.title = dict.browserTitleIdle;
    syncBrowserFavicon(false);
  }

  // Update live pipeline logs
  el.pipelineLogs.innerHTML = '';
  for (const log of state.logs) {
    const li = document.createElement('li');
    li.className = `log-${log.severity}`;
    li.textContent = `[${log.timestamp.toFixed(1)}s] [${log.source}] ${log.detail}`;
    el.pipelineLogs.appendChild(li);
  }
}

canvas.addEventListener('pointermove', (e) => {
  const { x, y } = toArenaCoords(e.clientX, e.clientY);
  renderer.setPointer(x, y);
});

canvas.addEventListener('pointerdown', (e) => {
  synth.unlock();
  const state = engine.getState();
  if (!state.isRunning || state.isGameOver) return;

  const { x, y } = toArenaCoords(e.clientX, e.clientY);
  if (x <= WAF_BARRIER_X + 20) {
    dispatchEvents(engine.interceptAt(x, y));
    return;
  }

  const laneIdx = hitTestBox(x, y, LANE_BOXES);
  if (laneIdx >= 0) {
    dispatchEvents(engine.rerouteGatewayLane(laneIdx));
    return;
  }

  const nodeIdx = hitTestBox(x, y, UPSTREAM_BOXES);
  if (nodeIdx >= 0) {
    dispatchEvents(engine.probeUpstream(nodeIdx));
  }
});

window.addEventListener('keydown', (e) => {
  const state = engine.getState();
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.isRunning) {
      renderer.triggerScanWave();
      dispatchEvents(engine.triggerSignatureScan());
    }
  } else if (e.key === '1' || e.key === '2' || e.key === '3') {
    dispatchEvents(engine.rerouteGatewayLane(Number(e.key) - 1));
  } else if (e.key === 'e' || e.key === 'E') {
    dispatchEvents(engine.probeUpstream());
  } else if (e.key === 'm' || e.key === 'M') {
    synth.setMuted(!synth.isMuted());
    applyLocaleText();
  }
});

el.btnStart.addEventListener('click', () => startNewRun(currentSeed));
el.btnRestart.addEventListener('click', () => startNewRun());
el.btnScan.addEventListener('click', () => {
  renderer.triggerScanWave();
  dispatchEvents(engine.triggerSignatureScan());
});
el.btnProbe.addEventListener('click', () => dispatchEvents(engine.probeUpstream()));
el.btnMute.addEventListener('click', () => {
  synth.setMuted(!synth.isMuted());
  applyLocaleText();
});
el.btnLang.addEventListener('click', () => {
  locale = locale === 'zh-TW' ? 'en-US' : 'zh-TW';
  applyLocaleText();
  updateHud(engine.getState());
});
el.btnCopy.addEventListener('click', async () => {
  const st = engine.getState();
  const report = [
    `EDGE KEEPER // 403 Defense Report (#seed=${st.seed})`,
    `Score: ${st.score} | Wave: ${st.wave} | Max Combo: ${st.maxCombo}x`,
    `403 Blocked: ${st.stats.blockedAttacks} | Auto-Fallbacks: ${st.stats.fallbacksSaved} | Grade F Busted: ${st.stats.roguesBusted}`,
    `False Positives: ${st.stats.falsePositives} | Cause: ${st.deathReason ?? 'Active'}`
  ].join('\n');
  try {
    await navigator.clipboard.writeText(report);
    el.btnCopy.textContent = LOCALES[locale].btnCopied;
    setTimeout(() => applyLocaleText(), 1500);
  } catch {
    // Clipboard unavailable in restricted contexts
  }
});

applyLocaleText();

function loop(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const tickEvents = engine.tick(dt);
  dispatchEvents(tickEvents);

  const state = engine.getState();
  renderer.render(state, dt);
  updateHud(state);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
