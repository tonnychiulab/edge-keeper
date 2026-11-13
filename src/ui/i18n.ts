export type Locale = 'zh-TW' | 'en-US';

export interface LocaleDict {
  readonly browserTitleIdle: string;
  readonly browserTitleActive: (sla: number, score: number) => string;
  readonly browserTitleGameOver: (score: number) => string;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly badgeProjects: string;
  readonly btnStart: string;
  readonly btnPlayAgain: string;
  readonly btnCopyReport: string;
  readonly btnCopied: string;
  readonly btnMuteOn: string;
  readonly btnMuteOff: string;
  readonly btnLang: string;
  readonly btnScan: string;
  readonly btnProbe: string;
  readonly labelScore: string;
  readonly labelCombo: string;
  readonly labelWave: string;
  readonly labelSla: string;
  readonly labelSeed: string;
  readonly labelPipeline: string;
  readonly overclockBanner: string;
  readonly hintControls: string;
  readonly rulesWaf: string;
  readonly rulesRouter: string;
  readonly rulesCasbin: string;
  readonly gameOverTitle: string;
  readonly labelCause: string;
  readonly statBlocked: string;
  readonly statFallback: string;
  readonly statRogues: string;
  readonly statFalsePos: string;
  readonly statLegit: string;
  readonly statMaxCombo: string;
}

export const LOCALES: Record<Locale, LocaleDict> = {
  'zh-TW': {
    browserTitleIdle: 'EDGE KEEPER｜邊緣守門員：403 攻防戰',
    browserTitleActive: (sla, score) => `[SLA ${Math.ceil(sla)}%] ${score}｜EDGE KEEPER`,
    browserTitleGameOver: (score) => `[崩潰] ${score} 分｜EDGE KEEPER 邊緣守門員`,
    heroTitle: 'EDGE KEEPER // 邊緣守門員',
    heroSubtitle: 'waf-checker × cloudflare-auto-router × casbin-gateway 三防線街機實戰',
    badgeProjects: '三專案融合街機防禦系統',
    btnStart: '啟動邊緣防線 →',
    btnPlayAgain: '再守一波 →',
    btnCopyReport: '複製防禦戰報',
    btnCopied: '已複製戰報！',
    btnMuteOn: '音效：關',
    btnMuteOff: '音效：開',
    btnLang: 'EN',
    btnScan: '[Space] 特徵掃描',
    btnProbe: '[E] 驗明正身探針',
    labelScore: '防禦積分',
    labelCombo: '連擊',
    labelWave: '波次',
    labelSla: 'SLA 完整度',
    labelSeed: '隨機種子',
    labelPipeline: '即時決策流水線',
    overclockBanner: '零信任超頻啟動中 (2x 積分 + 自動 403 攔截)',
    hintControls: '點擊擊落紅/紫攻擊封包 · 放行藍綠 Agent 流量 · [1/2/3] 自動降級 · [Space] 特徵掃描 · [E] 驗明正身探針',
    rulesWaf: 'waf-checker 防線：點擊爆破 SQLi/XSS 等攻擊封包 (403 攔截)，切勿誤殺正常 AI Agent 請求！',
    rulesRouter: 'auto-router 閘道：付費模型出現 403 拒收紅燈時，立刻按 [1][2][3] 或點擊通道執行自動降級！',
    rulesCasbin: 'casbin-gateway 探針：上游節點出現偷換模型閃爍時，按 [E] 或點擊節點發射驗明正身探針抓出 Grade F！',
    gameOverTitle: 'SLA 完整度歸零：邊緣防線失守',
    labelCause: '崩潰主因',
    statBlocked: '403 成功攔截',
    statFallback: '自動降級救援',
    statRogues: '揪出 Grade F 假貨',
    statFalsePos: '誤殺合法請求',
    statLegit: '安全放行流量',
    statMaxCombo: '最高連擊'
  },
  'en-US': {
    browserTitleIdle: 'EDGE KEEPER | 403 Defense Arcade',
    browserTitleActive: (sla, score) => `[SLA ${Math.ceil(sla)}%] ${score} | EDGE KEEPER`,
    browserTitleGameOver: (score) => `[DOWN] ${score} pts | EDGE KEEPER`,
    heroTitle: 'EDGE KEEPER // 403 Defense',
    heroSubtitle: 'waf-checker × cloudflare-auto-router × casbin-gateway Arcade Defense',
    badgeProjects: '3-Repo Fusion Arcade System',
    btnStart: 'Boot Edge Defense →',
    btnPlayAgain: 'Defend Again →',
    btnCopyReport: 'Copy Battle Report',
    btnCopied: 'Report Copied!',
    btnMuteOn: 'SFX: OFF',
    btnMuteOff: 'SFX: ON',
    btnLang: '繁中',
    btnScan: '[Space] Signature Scan',
    btnProbe: '[E] Authenticity Probe',
    labelScore: 'SCORE',
    labelCombo: 'COMBO',
    labelWave: 'WAVE',
    labelSla: 'SLA INTEGRITY',
    labelSeed: 'SEED',
    labelPipeline: 'LIVE DECISION PIPELINE',
    overclockBanner: 'ZERO TRUST OVERCLOCK ACTIVE (2x SCORE + AUTO 403)',
    hintControls: 'Click red/purple threats · Let cyan Agents pass · [1/2/3] Auto-Fallback · [Space] Signature Scan · [E] Authenticity Probe',
    rulesWaf: 'waf-checker: Click to blast SQLi/XSS payloads (403 Blocked). Do NOT hit legit AI Agent traffic!',
    rulesRouter: 'auto-router: When a lane flashes 403 Paid Model Denied, hit [1][2][3] or click it for Auto-Fallback!',
    rulesCasbin: 'casbin-gateway: When an upstream sparks suspiciously, hit [E] or click it to bust Grade F resellers!',
    gameOverTitle: 'SLA INTEGRITY DEPLETED: EDGE BREACHED',
    labelCause: 'Primary Cause',
    statBlocked: '403 Blocked',
    statFallback: 'Auto-Fallbacks Saved',
    statRogues: 'Grade F Busted',
    statFalsePos: 'False Positives',
    statLegit: 'Legit Passed',
    statMaxCombo: 'Max Combo'
  }
};

const FAVICON_NORMAL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23080b12'/%3E%3Cpath d='M32 8L52 16V31C52 43.5 43.5 52.8 32 56C20.5 52.8 12 43.5 12 31V16L32 8Z' fill='none' stroke='%2300ff9d' stroke-width='4'/%3E%3Ctext x='32' y='38' text-anchor='middle' font-family='monospace' font-weight='bold' font-size='18' fill='%2300ff9d'%3E403%3C/text%3E%3C/svg%3E";

const FAVICON_ALERT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231a050d'/%3E%3Cpath d='M32 8L52 16V31C52 43.5 43.5 52.8 32 56C20.5 52.8 12 43.5 12 31V16L32 8Z' fill='none' stroke='%23ff3366' stroke-width='4'/%3E%3Ctext x='32' y='38' text-anchor='middle' font-family='monospace' font-weight='bold' font-size='18' fill='%23ff3366'%3E200%3C/text%3E%3C/svg%3E";

export function syncBrowserFavicon(isDanger: boolean): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  const target = isDanger ? FAVICON_ALERT : FAVICON_NORMAL;
  if (link.href !== target) {
    link.href = target;
  }
}
