import { describe, expect, it } from 'vitest';
import type { GameState } from '../../shared/contracts';
import { classifyLocally, createInitialGame, resolveAction, startCampaignMap } from '../../main/game-engine';
import { getAutoplayDecision } from './autoplay-agent';

function advance(state: GameState): GameState {
  const decision = getAutoplayDecision(state);
  if (decision.type === 'action') return resolveAction(state, classifyLocally(decision.text), decision.text).nextState;
  if (decision.type === 'map') return startCampaignMap(state, decision.mapId);
  if (decision.type === 'restart-checkpoint') throw new Error('安全自动试玩路线不应触发致命失败');
  return state;
}

describe('自动试玩代理', () => {
  it('从当前场景状态选择下一条合法行动，而不是复制任务文案', () => {
    const initial = createInitialGame();
    expect(getAutoplayDecision(initial)).toEqual({
      type: 'action', text: '我举起余烬灯，仔细检查黑石门上的符文和被雨水遮住的刻痕。',
    });
    const inspected = advance(initial);
    expect(inspected.clues).toContain('door_sigils');
    expect(getAutoplayDecision(inspected)).toMatchObject({ type: 'action' });
  });

  it('从新游戏自动走完四张地图并得到有效世界结局', () => {
    let state = createInitialGame();
    for (let step = 0; step < 100 && !state.completed; step += 1) state = advance(state);
    if (!state.completed) throw new Error(JSON.stringify({ mapId: state.mapId, sceneId: state.sceneId, turn: state.turn, decision: getAutoplayDecision(state), flags: state.flags, clues: state.clues, resources: state.resources }));
    expect(state.completedMaps).toEqual(['tower', 'forest', 'harbor', 'court']);
    expect(state.campaignOutcome).toBe('federated');
  });

  it('可以从地图完成、失败和任意中途场景重新规划', () => {
    const regionComplete = { ...createInitialGame(), completedMaps: ['tower'] as const, regionCompleted: true } as GameState;
    expect(getAutoplayDecision(regionComplete)).toEqual({ type: 'map', mapId: 'forest' });

    const failed = { ...createInitialGame(), failed: true };
    expect(getAutoplayDecision(failed)).toEqual({ type: 'restart-checkpoint' });

    const market = { ...createInitialGame(), mapId: 'harbor' as const, sceneId: 'market' as const, completedMaps: ['tower'] as const } as GameState;
    expect(getAutoplayDecision(market)).toMatchObject({ type: 'action' });
  });
});
