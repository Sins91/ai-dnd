import { describe, expect, it } from 'vitest';
import type { GameState } from '../shared/contracts';
import { classifyLocally, createInitialGame } from './game-engine';
import { availableNextMaps, resolveCampaignAction, startCampaignMap } from './campaign-engine';

function act(state: GameState, text: string) {
  return resolveCampaignAction(state, classifyLocally(text), text.replace(/\s+/g, ''));
}

function regionalState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGame(), regionCompleted: false, ...overrides };
}

describe('四地图战役规则', () => {
  it('灰烬塔后允许自由选择港口或林海，王庭必须等待两者完成', () => {
    const tower = regionalState({ completedMaps: ['tower'], regionCompleted: true });
    expect(availableNextMaps(tower)).toEqual(['harbor', 'forest']);
    expect(() => startCampaignMap(tower, 'court')).toThrow();

    const harborDone = { ...tower, completedMaps: ['tower', 'harbor'] as const } as GameState;
    expect(availableNextMaps(harborDone)).toEqual(['forest']);
    const bothDone = { ...tower, completedMaps: ['tower', 'harbor', 'forest'] as const } as GameState;
    expect(availableNextMaps(bothDone)).toEqual(['court']);
  });

  it('沉钟港结局记录为地区完成，但不会提前结束战役', () => {
    const docks = regionalState({
      mapId: 'harbor', sceneId: 'docks', progress: 5, completedMaps: ['tower'],
      resources: { ...createInitialGame().resources, ledgerEvidence: 3, publicSupport: 2 },
    });
    const resolution = act(docks, '公开总账，改革制度并归还记忆');
    expect(resolution.outcome).toBe('complete');
    expect(resolution.nextState.harborOutcome).toBe('reformed');
    expect(resolution.nextState.completedMaps).toContain('harbor');
    expect(resolution.nextState.completed).toBe(false);
  });

  it('无名林海结局保留自然循环见证并解锁王庭', () => {
    const mother = regionalState({
      mapId: 'forest', sceneId: 'mother_tree', progress: 5, completedMaps: ['tower', 'harbor'],
      clues: ['natural_seal'], resources: { ...createInitialGame().resources, cycleBalance: 1 },
    });
    const resolution = act(mother, '恢复循环并修复母树');
    expect(resolution.nextState.forestOutcome).toBe('restored');
    expect(resolution.nextState.testimonies).toContain('forest_cycle');
    expect(availableNextMaps(resolution.nextState)).toEqual(['court']);
  });

  it('只有回声王庭总终局会把整场战役标记为完成', () => {
    const core = regionalState({
      mapId: 'court', sceneId: 'memory_core', progress: 5,
      towerOutcome: 'reconstructed', harborOutcome: 'reformed', forestOutcome: 'covenant',
      completedMaps: ['tower', 'harbor', 'forest'],
      resources: { ...createInitialGame().resources, allianceSeats: 3 },
    });
    const resolution = act(core, '建立多地共治的记忆联邦');
    expect(resolution.nextState.campaignOutcome).toBe('federated');
    expect(resolution.nextState.completedMaps).toContain('court');
    expect(resolution.nextState.completed).toBe(true);
  });
});
