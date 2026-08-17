import { z } from 'zod';
import type { NarrativeRules } from './narrative-rules';
import type { MapId, SceneId } from './adventure';

export const providerConfigSchema = z.object({
  provider: z.enum(['deepseek', 'openai', 'openai-compatible', 'local']),
  modelId: z.string().trim().max(160),
  baseURL: z.string().trim().url().or(z.literal('')),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const actionIntentSchema = z.object({
  type: z.enum(['inspect', 'talk', 'move', 'use_item', 'improvise']),
  target: z.string().max(160).default(''),
  approach: z.string().max(320).default(''),
  goal: z.string().max(240).default(''),
  risk: z.enum(['cautious', 'normal', 'reckless']).default('normal'),
});

export type ActionIntent = z.infer<typeof actionIntentSchema>;

export type NarrativeMode = 'brief-action' | 'important-action' | 'failure-restart' | 'background-rich';
export type ActionOutcome = 'progress' | 'flavor' | 'blocked' | 'costly_success' | 'failed_forward' | 'failed' | 'complete';

export type GameMessage = {
  id: string;
  role: 'player' | 'narrator' | 'system';
  text: string;
  createdAt: number;
  narrativeMode?: NarrativeMode;
  outcome?: ActionOutcome;
  sceneId?: SceneId;
};

export type GameBilling = {
  status: 'available' | 'unavailable';
  currency: string | null;
  startingBalance: number | null;
  currentBalance: number | null;
  updatedAt: number | null;
};

export type TowerOutcome = 'maintained' | 'released' | 'inherited' | 'reconstructed';
export type HarborOutcome = 'regulated' | 'reformed' | 'autonomous' | 'destroyed';
export type ForestOutcome = 'restored' | 'covenant' | 'sealed' | 'harvested';
export type CampaignOutcome = 'maintained' | 'inherited' | 'destroyed' | 'reconstructed' | 'federated';
export type PlayerOath = 'none' | 'maintain' | 'seek_truth' | 'refused';
export type EchoDisposition = 'undecided' | 'carried' | 'left' | 'lantern';

export type TowerResources = {
  ember: number;
  emberMax: number;
  archivistTrust: number;
  echoCorruption: number;
  towerAlert: number;
  publicSupport: number;
  harborAuthority: number;
  unionTrust: number;
  merchantTrust: number;
  harborTension: number;
  ledgerEvidence: number;
  forestRecognition: number;
  cycleBalance: number;
  rootPollution: number;
  ringMarks: number;
  courtStability: number;
  publicEvidence: number;
  allianceSeats: number;
  centralAuthority: number;
  transitionBurden: number;
};

export type GameSnapshot = {
  mapId: MapId;
  sceneId: SceneId;
  turn: number;
  progress: number;
  inventory: string[];
  clues: string[];
  testimonies: string[];
  flags: string[];
  resources: TowerResources;
  oath: PlayerOath;
  brokenOath: boolean;
  echoDisposition: EchoDisposition;
  archivistWeakened: boolean;
  towerOutcome?: TowerOutcome;
  harborOutcome?: HarborOutcome;
  forestOutcome?: ForestOutcome;
  campaignOutcome?: CampaignOutcome;
  completedMaps: MapId[];
  regionCompleted: boolean;
  messages?: GameMessage[];
  messageCount?: number;
};

export type GameCheckpoint = GameSnapshot;

export type GameFailure = {
  action: string;
  reason: string;
  checkpointName: string;
};

export type GameState = GameSnapshot & {
  contentVersion: 3;
  id: string;
  messages: GameMessage[];
  completed: boolean;
  failed?: boolean;
  failure?: GameFailure;
  checkpoint?: GameCheckpoint;
  billing?: GameBilling;
};

export type BootstrapPayload = {
  settings: ProviderConfig;
  narrativeRules: NarrativeRules;
  credentialConfigured: boolean;
  game: GameState;
};

export type SubmitActionPayload = { text: string };

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

export type StreamEvent =
  | { requestId: string; type: 'chunk'; text: string }
  | { requestId: string; type: 'complete'; state: GameState }
  | { requestId: string; type: 'billing'; gameId: string; billing: GameBilling }
  | { requestId: string; type: 'error'; message: string };

export type LocalRpgApi = {
  getBootstrap(): Promise<BootstrapPayload>;
  saveSettings(settings: ProviderConfig): Promise<BootstrapPayload>;
  saveNarrativeRules(rules: NarrativeRules): Promise<BootstrapPayload>;
  resetNarrativeRules(): Promise<BootstrapPayload>;
  saveCredential(secret: string): Promise<{ configured: boolean }>;
  testConnection(settings: ProviderConfig, secret: string): Promise<ConnectionTestResult>;
  clearCredential(): Promise<{ configured: boolean }>;
  newGame(): Promise<GameState>;
  startMap(mapId: MapId): Promise<GameState>;
  restartFromCheckpoint(): Promise<GameState>;
  refreshBilling(): Promise<GameState>;
  submitAction(payload: SubmitActionPayload): Promise<{ requestId: string }>;
  onStream(listener: (event: StreamEvent) => void): () => void;
};
