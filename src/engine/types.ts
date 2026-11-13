export type PacketKind = 'attack' | 'obfuscated' | 'legit';

export interface PacketEntity {
  readonly id: number;
  readonly kind: PacketKind;
  readonly category: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly radius: number;
  readonly revealed: boolean;
}

export interface GatewayLaneState {
  readonly index: number;
  readonly modelId: string;
  readonly displayName: string;
  readonly hotkey: '1' | '2' | '3';
  readonly alertActive: boolean;
  readonly deniedModel: string | null;
  readonly alertTimer: number;
  readonly alertMaxTimer: number;
  readonly savedFlashTimer: number;
}

export type UpstreamGrade = 'A' | 'F';

export interface UpstreamNodeState {
  readonly index: number;
  readonly name: string;
  readonly vendorHint: string;
  readonly isRogue: boolean;
  readonly deceptionReason: string | null;
  readonly rogueElapsed: number;
  readonly lastGrade: UpstreamGrade;
  readonly gradeFlashTimer: number;
}

export type PipelineSource = 'waf-checker' | 'auto-router' | 'casbin-gateway' | 'system';
export type LogSeverity = 'ok' | 'warn' | 'danger' | 'info';

export interface PipelineEvent {
  readonly id: number;
  readonly timestamp: number;
  readonly source: PipelineSource;
  readonly severity: LogSeverity;
  readonly messageKey: string;
  readonly detail: string;
}

export type SoundEvent =
  | 'waf_block'
  | 'false_positive'
  | 'waf_breach'
  | 'legit_pass'
  | 'scan_pulse'
  | 'fallback_saved'
  | 'gateway_timeout'
  | 'probe_clean'
  | 'rogue_busted'
  | 'game_over';

export interface FloatingTextEvent {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color: string;
}

export interface LaserBurstEvent {
  readonly id: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly color: string;
}

export interface GameStats {
  readonly blockedAttacks: number;
  readonly missedAttacks: number;
  readonly falsePositives: number;
  readonly legitPassed: number;
  readonly fallbacksSaved: number;
  readonly gatewayTimeouts: number;
  readonly roguesBusted: number;
}

export interface GameState {
  readonly seed: number;
  readonly isRunning: boolean;
  readonly isGameOver: boolean;
  readonly elapsedTime: number;
  readonly wave: number;
  readonly score: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly slaIntegrity: number; // 0 to 100
  readonly scanCooldown: number;
  readonly scanMaxCooldown: number;
  readonly probeCooldown: number;
  readonly probeMaxCooldown: number;
  readonly overclockTimer: number;
  readonly screenShake: number;
  readonly deathReason: string | null;
  readonly packets: ReadonlyArray<PacketEntity>;
  readonly lanes: ReadonlyArray<GatewayLaneState>;
  readonly upstreams: ReadonlyArray<UpstreamNodeState>;
  readonly logs: ReadonlyArray<PipelineEvent>;
  readonly stats: GameStats;
}

export interface EngineTickEvents {
  readonly sounds: ReadonlyArray<SoundEvent>;
  readonly floatingTexts: ReadonlyArray<FloatingTextEvent>;
  readonly lasers: ReadonlyArray<LaserBurstEvent>;
}

export interface EdgeKeeperEngine {
  start(): void;
  tick(dt: number): EngineTickEvents;
  interceptAt(x: number, y: number, blastRadius?: number): EngineTickEvents;
  triggerSignatureScan(): EngineTickEvents;
  rerouteGatewayLane(laneIndex: number): EngineTickEvents;
  probeUpstream(nodeIndex?: number): EngineTickEvents;
  getState(): Readonly<GameState>;
}
