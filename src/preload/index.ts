import { contextBridge, ipcRenderer } from 'electron';
import type { LocalRpgApi, ProviderConfig, StreamEvent, SubmitActionPayload } from '../shared/contracts';
import type { MapId } from '../shared/adventure';
import type { NarrativeRules } from '../shared/narrative-rules';

const api: LocalRpgApi = {
  getBootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  saveSettings: (settings: ProviderConfig) => ipcRenderer.invoke('settings:save', settings),
  saveNarrativeRules: (rules: NarrativeRules) => ipcRenderer.invoke('narrative-rules:save', rules),
  resetNarrativeRules: () => ipcRenderer.invoke('narrative-rules:reset'),
  saveCredential: (secret: string) => ipcRenderer.invoke('credentials:save', secret),
  testConnection: (settings: ProviderConfig, secret: string) => ipcRenderer.invoke('settings:test', settings, secret),
  clearCredential: () => ipcRenderer.invoke('credentials:clear'),
  newGame: () => ipcRenderer.invoke('game:new'),
  startMap: (mapId: MapId) => ipcRenderer.invoke('game:start-map', mapId),
  restartFromCheckpoint: () => ipcRenderer.invoke('game:restart-checkpoint'),
  refreshBilling: () => ipcRenderer.invoke('billing:refresh'),
  submitAction: (payload: SubmitActionPayload) => ipcRenderer.invoke('game:submit', payload),
  onStream: (listener: (event: StreamEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, streamEvent: StreamEvent) => listener(streamEvent);
    ipcRenderer.on('game:stream', wrapped);
    return () => ipcRenderer.removeListener('game:stream', wrapped);
  },
};

contextBridge.exposeInMainWorld('localRpg', api);
