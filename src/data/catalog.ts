export interface AttackSample {
  readonly category: string;
  readonly label: string;
  readonly obfuscatedLabel: string;
}

export interface AgentTrafficSample {
  readonly agent: string;
  readonly action: string;
}

export interface GatewayLaneDef {
  readonly id: string;
  readonly modelId: string;
  readonly displayName: string;
  readonly hotkey: '1' | '2' | '3';
}

export interface UpstreamDef {
  readonly id: string;
  readonly name: string;
  readonly vendorHint: string;
}

export const ATTACK_SAMPLES: ReadonlyArray<AttackSample> = [
  { category: 'SQLi', label: "' OR 1=1--", obfuscatedLabel: '%2527%20OR%201%3D1--' },
  { category: 'XSS', label: '<script>alert(1)</script>', obfuscatedLabel: '\\u003cscript\\u003ealert(1)' },
  { category: 'LFI', label: '../../etc/passwd', obfuscatedLabel: '..%252f..%252fetc/passwd' },
  { category: 'SSTI', label: '{{7*7}}', obfuscatedLabel: '${{7*7}}' },
  { category: 'CMDi', label: '; cat /etc/shadow', obfuscatedLabel: '%3Bcat$IFS/etc/shadow' },
  { category: 'SSRF', label: 'http://169.254.169.254', obfuscatedLabel: 'http://0x7f.0.0.1/meta' },
  { category: 'Smuggle', label: 'CL.TE Transfer-Encoding', obfuscatedLabel: 'TE: chunked\\r\\nCL: 0' },
  { category: 'NoSQL', label: '{"$ne": null}', obfuscatedLabel: 'user[$ne]=null' }
];

export const AGENT_TRAFFIC_SAMPLES: ReadonlyArray<AgentTrafficSample> = [
  { agent: 'Claude Code', action: 'git diff review' },
  { agent: 'Cursor', action: 'inline completion' },
  { agent: 'Codex CLI', action: 'run unit tests' },
  { agent: 'Gemini CLI', action: 'plan architecture' },
  { agent: 'Windsurf', action: 'refactor module' },
  { agent: 'Aider', action: 'apply patch' }
];

export const GATEWAY_LANES: ReadonlyArray<GatewayLaneDef> = [
  { id: 'lane-1', modelId: '@cf/meta/llama-3.2-3b-instruct', displayName: 'Llama 3.2 3B (Free)', hotkey: '1' },
  { id: 'lane-2', modelId: '@cf/qwen/qwen3-30b-a3b-fp8', displayName: 'Qwen 3 30B MoE (Free)', hotkey: '2' },
  { id: 'lane-3', modelId: '@cf/meta/llama-3.2-1b-instruct', displayName: 'Llama 3.2 1B (Free)', hotkey: '3' }
];

export const PAID_DENIED_MODELS: ReadonlyArray<string> = [
  'kimi-k3-flagship',
  'claude-opus-paid',
  'gpt-pro-enterprise'
];

export const UPSTREAM_NODES: ReadonlyArray<UpstreamDef> = [
  { id: 'node-alpha', name: 'Relay-Alpha', vendorHint: 'Anthropic / Direct' },
  { id: 'node-beta', name: 'Relay-Beta', vendorHint: 'Reseller Pool #04' },
  { id: 'node-gamma', name: 'Relay-Gamma', vendorHint: 'OpenAI / Proxy' }
];

export const ROGUE_DECEPTIONS: ReadonlyArray<string> = [
  'Swapped to 1B cheap model',
  'Faked prompt cache hit',
  'Silently dropped thinking param',
  'Truncated context window'
];
