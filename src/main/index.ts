import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, type IpcMainInvokeEvent } from 'electron';
import appIcon from '../../resources/app-icon.ico?asset';
import { providerConfigSchema, type StreamEvent, type SubmitActionPayload } from '../shared/contracts';
import { adventure, type MapId } from '../shared/adventure';
import { defaultNarrativeRules, narrativeRulesSchema } from '../shared/narrative-rules';
import { LocalDatabase } from './database';
import { CredentialStore } from './credential-store';
import {
  appendTurn, classifyLocally, createInitialGame, markCurrentCheckpoint,
  resolveAction, resolveFatalAction, restartFromCheckpoint, selectNarrativeMode, startCampaignMap,
} from './game-engine';
import {
  classifyWithAi, fallbackNarration, formatNarrationParagraphs, narrateWithAi, testModelConnection,
} from './ai-service';
import { fetchDeepSeekBalance } from './billing-service';

let database: LocalDatabase;
let credentials: CredentialStore;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.local-ai-rpg.ashen-tower');
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  if (!url.startsWith('file://') && !url.startsWith('http://localhost:')) {
    throw new Error('拒绝来自未知页面的请求。');
  }
}

async function refreshGameBilling(game: import('../shared/contracts').GameState, resetBaseline = false) {
  let active = game;
  try {
    const settings = database.getSettings();
    const apiKey = (await credentials.read()) ?? '';
    if (settings.provider !== 'deepseek' || !apiKey) {
      if (!game.billing) return game;
      active = database.getActiveGame();
      if (active.id !== game.id) return active;
      const updated = { ...active, billing: undefined };
      database.saveGame(updated);
      return updated;
    }

    const balance = await fetchDeepSeekBalance(settings, apiKey);
    active = database.getActiveGame();
    if (active.id !== game.id) return active;
    const previousBilling = resetBaseline ? undefined : active.billing;
    const startingBalance = previousBilling?.currency === balance.currency
      && previousBilling.startingBalance !== null
      ? previousBilling.startingBalance
      : balance.totalBalance;
    const updated = {
      ...active,
      billing: {
        status: 'available' as const,
        currency: balance.currency,
        startingBalance,
        currentBalance: balance.totalBalance,
        updatedAt: Date.now(),
      },
    };
    database.saveGame(updated);
    return updated;
  } catch {
    active = database.getActiveGame();
    if (active.id !== game.id) return active;
    const updated = {
      ...active,
      billing: {
        status: 'unavailable' as const,
        currency: active.billing?.currency ?? null,
        startingBalance: active.billing?.startingBalance ?? null,
        currentBalance: active.billing?.currentBalance ?? null,
        updatedAt: active.billing?.updatedAt ?? null,
      },
    };
    database.saveGame(updated);
    return updated;
  }
}
async function getBootstrap() {
  return {
    settings: database.getSettings(), narrativeRules: database.getNarrativeRules(),
    credentialConfigured: await credentials.hasSecret(), game: database.getActiveGame(),
  };
}

function sendStream(window: BrowserWindow, event: StreamEvent): void {
  if (!window.isDestroyed()) window.webContents.send('game:stream', event);
}

function isHeaderSafeApiKey(value: string): boolean {
  return /^[\x21-\x7E]+$/.test(value);
}

function modelErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ByteString|greater than 255|character at index/i.test(message)) {
    return 'API Key 包含中文、全角字符或其他非法字符。请只粘贴服务商生成的 Key 本身。';
  }
  if (/authentication|api key|401/i.test(message)) {
    return '模型 API Key 无效，请在“模型设置”中重新填写正确的 DeepSeek API Key。';
  }
  if (/insufficient|balance|402|quota/i.test(message)) {
    return '模型账户余额或额度不足，请检查 DeepSeek 账户。';
  }
  if (/fetch|network|timeout|econn/i.test(message)) {
    return '无法连接模型服务，请检查网络和 API 地址。';
  }
  return '模型调用失败：' + message;
}

async function processTurn(window: BrowserWindow, requestId: string, text: string): Promise<void> {
  const previous = database.getActiveGame();
  const settings = database.getSettings();
  const narrativeRules = database.getNarrativeRules();
  try {
    const apiKey = (await credentials.read()) ?? '';
    const useModel = settings.provider === 'local'
      ? Boolean(settings.modelId && settings.baseURL)
      : Boolean(apiKey && settings.modelId);
    const fatalResolution = resolveFatalAction(previous, text);
    const intent = fatalResolution || !useModel
      ? classifyLocally(text)
      : await classifyWithAi(text, previous, settings, apiKey);
    const resolution = fatalResolution ?? resolveAction(previous, intent, text);
    database.appendEvent(previous.id, 'ACTION_RESOLVED', { text, intent, outcome: resolution.outcome });
    let narratorText = '';
    if (useModel) {
      try {
        for await (const chunk of narrateWithAi(text, previous, intent, resolution, settings, apiKey, narrativeRules)) {
          narratorText += chunk;
          sendStream(window, { requestId, type: 'chunk', text: chunk });
        }
      } catch (error) { throw new Error(modelErrorMessage(error)); }
    }
    if (!narratorText) {
      narratorText = fallbackNarration(resolution);
      sendStream(window, { requestId, type: 'chunk', text: narratorText });
    }
    narratorText = formatNarrationParagraphs(narratorText, resolution);
    const narrativeMode = selectNarrativeMode(previous, resolution);
    let finalState = appendTurn(resolution.nextState, text, narratorText, narrativeMode, resolution.outcome);
    if (previous.sceneId !== finalState.sceneId && resolution.outcome !== 'failed') {
      finalState = markCurrentCheckpoint(finalState);
    }
    database.saveGame(finalState);
    sendStream(window, { requestId, type: 'complete', state: finalState });
    void refreshGameBilling(finalState).then((updated) => {
      if (updated.id === finalState.id && updated.billing) {
        sendStream(window, { requestId, type: 'billing', gameId: updated.id, billing: updated.billing });
      }
    });
  } catch (error) {
    sendStream(window, {
      requestId, type: 'error', message: error instanceof Error ? error.message : '处理行动时发生未知错误。',
    });
  }
}

function registerIpc(): void {
  ipcMain.handle('app:bootstrap', async (event) => { assertTrustedSender(event); return getBootstrap(); });
  ipcMain.handle('settings:save', async (event, rawSettings: unknown) => {
    assertTrustedSender(event);
    database.saveSettings(providerConfigSchema.parse(rawSettings));
    const game = { ...database.getActiveGame(), billing: undefined };
    database.saveGame(game);
    await refreshGameBilling(game, true);
    return getBootstrap();
  });
  ipcMain.handle('settings:test', async (event, rawSettings: unknown, rawSecret: unknown) => {
    assertTrustedSender(event);
    const startedAt = performance.now();
    try {
      const settings = providerConfigSchema.parse(rawSettings);
      const suppliedSecret = typeof rawSecret === 'string' ? rawSecret.trim() : '';
      const apiKey = suppliedSecret || (await credentials.read()) || '';
      if (settings.provider !== 'local' && !apiKey) {
        throw new Error('API Key 为空，请输入或先保存 Key。');
      }
      if (settings.provider !== 'local' && !isHeaderSafeApiKey(apiKey)) {
        throw new Error('API Key 包含中文、全角字符或空格，请只粘贴 Key 本身。');
      }
      await testModelConnection(settings, apiKey);
      return {
        ok: true,
        message: '模型连接成功',
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      return {
        ok: false,
        message: modelErrorMessage(error),
        latencyMs: Math.round(performance.now() - startedAt),
      };
    }
  });
  ipcMain.handle('credentials:save', async (event, secret: unknown) => {
    assertTrustedSender(event);
    if (typeof secret !== 'string' || secret.length > 1024) throw new Error('API Key 格式无效。');
    const normalizedSecret = secret.trim();
    if (!isHeaderSafeApiKey(normalizedSecret)) {
      throw new Error('API Key 包含中文、全角字符或空格，请只粘贴 Key 本身。');
    }
    await credentials.save(normalizedSecret); return { configured: true };
  });
  ipcMain.handle('narrative-rules:save', async (event, rawRules: unknown) => {
    assertTrustedSender(event);
    database.saveNarrativeRules(narrativeRulesSchema.parse(rawRules));
    return getBootstrap();
  });
  ipcMain.handle('narrative-rules:reset', async (event) => {
    assertTrustedSender(event);
    database.saveNarrativeRules(defaultNarrativeRules);
    return getBootstrap();
  });
  ipcMain.handle('credentials:clear', async (event) => {
    assertTrustedSender(event); await credentials.clear(); return { configured: false };
  });
  ipcMain.handle('game:new', async (event) => {
    assertTrustedSender(event); const game = createInitialGame(); database.saveGame(game);
    database.appendEvent(game.id, 'GAME_CREATED', {}); return game;
  });
  ipcMain.handle('game:start-map', async (event, rawMapId: unknown) => {
    assertTrustedSender(event);
    if (typeof rawMapId !== 'string' || !(rawMapId in adventure.maps)) throw new Error('未知地图。');
    const game = startCampaignMap(database.getActiveGame(), rawMapId as MapId);
    database.saveGame(game);
    database.appendEvent(game.id, 'MAP_STARTED', { mapId: rawMapId, sceneId: game.sceneId });
    return game;
  });
  ipcMain.handle('game:restart-checkpoint', async (event) => {
    assertTrustedSender(event);
    const current = database.getActiveGame();
    if (!current.failed) return current;
    const game = restartFromCheckpoint(current);
    database.saveGame(game);
    database.appendEvent(game.id, 'GAME_RESTARTED_FROM_CHECKPOINT', {
      sceneId: game.sceneId, turn: game.turn, progress: game.progress,
    });
    return game;
  });
  ipcMain.handle('billing:refresh', async (event) => {
    assertTrustedSender(event);
    return refreshGameBilling(database.getActiveGame());
  });
  ipcMain.handle('game:submit', async (event, payload: SubmitActionPayload) => {
    assertTrustedSender(event);
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text || text.length > 1200) throw new Error('行动描述应为 1 至 1200 个字符。');
    const requestId = crypto.randomUUID();
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('游戏窗口不可用。');
    void processTurn(window, requestId, text);
    return { requestId };
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640, backgroundColor: '#15130f', show: false,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  database = new LocalDatabase(join(app.getPath('userData'), 'game.db'));
  credentials = new CredentialStore(join(app.getPath('userData'), 'credentials.bin'));
  registerIpc(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => database?.close());
