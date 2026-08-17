import { describe, expect, it } from 'vitest';
import type { GameState } from '../shared/contracts';
import { getCurrentObjective } from '../shared/objectives';
import {
  appendTurn, classifyLocally, createInitialGame, markCurrentCheckpoint, migrateGameState,
  resolveAction, resolveFatalAction, restartFromCheckpoint, selectNarrativeMode, startCampaignMap,
} from './game-engine';

function act(state: GameState, text: string) {
  return resolveAction(state, classifyLocally(text), text);
}

function enterHall() {
  const inspected = act(createInitialGame(), '我举起余烬灯检查门上的符文');
  return act(inspected.nextState, '我按风、星、灰的次序点亮符文并进入').nextState;
}

function reachSummit(): GameState {
  const trusted = act(enterHall(), '我诚实告诉守忆人门外发生的事，并询问黑焰与路线').nextState;
  const archive = act(trusted, '我沿星图路线前往沉星档案井').nextState;
  const evidence = act(archive, '我涉入井底黑水，取回两份记忆证词').nextState;
  const corridor = act(evidence, '我带着证词前往上层回廊').nextState;
  const revealed = act(corridor, '我观察影子与北侧方向，用已知事实排除幻象').nextState;
  const echo = act(revealed, '我把受困回声带走').nextState;
  const stairs = act(echo, '我沿真实路线前往灰烬阶梯').nextState;
  return act(stairs, '我根据证词和残影沿建塔者旧路前往塔顶').nextState;
}

describe('正式灰烬塔规则引擎', () => {
  it('以不泄露谜底的背景故事过渡到封印之门', () => {
    const game = createInitialGame();
    const opening = game.messages[0].text;
    expect(opening).toContain('断崖以南的聚落开始遗失');
    expect(opening).toContain('没有署名的短笺');
    expect(opening).toContain('封印之门');
    expect(opening).not.toContain('记忆献祭制度');
    expect(opening).not.toContain('守忆人亲手');
  });

  it('在没有线索时阻挡石门，并通过观察路线无代价进入长厅', () => {
    const blocked = act(createInitialGame(), '我直接推门进入');
    expect(blocked.outcome).toBe('blocked');
    expect(blocked.nextState.sceneId).toBe('gate');

    const hall = enterHall();
    expect(hall.sceneId).toBe('hall');
    expect(hall.clues).toContain('door_sigils');
    expect(hall.resources.ember).toBe(4);
  });

  it('复制任务说明不会触发行动或推进关卡', () => {
    const initial = createInitialGame();
    const gateCopy = act(initial, getCurrentObjective(initial));
    expect(gateCopy.outcome).toBe('blocked');
    expect(gateCopy.nextState.sceneId).toBe('gate');
    expect(gateCopy.nextState.clues).toEqual([]);

    const archive = {
      ...initial,
      sceneId: 'archive' as const,
      progress: 2,
      clues: ['star_map'],
    };
    const archiveCopy = act(archive, getCurrentObjective(archive));
    expect(archiveCopy.outcome).toBe('blocked');
    expect(archiveCopy.nextState.sceneId).toBe('archive');
    expect(archiveCopy.nextState.testimonies).toEqual([]);
    expect(archiveCopy.nextState.resources.echoCorruption).toBe(0);
  });

  it('支持强行灌注和模仿回声两种有持续代价的开门方法', () => {
    const forced = act(createInitialGame(), '我强行向符文灌注灯火炸开石门');
    expect(forced.outcome).toBe('costly_success');
    expect(forced.nextState.sceneId).toBe('hall');
    expect(forced.nextState.resources.ember).toBe(2);

    const echoed = act(createInitialGame(), '我模仿门后的三次敲击回应封印');
    expect(echoed.nextState.sceneId).toBe('hall');
    expect(echoed.nextState.resources.echoCorruption).toBe(1);
    expect(echoed.nextState.clues).toContain('echo_rhythm');
  });

  it('让诚实交谈与威胁取得相同路线但形成不同信任', () => {
    const honest = act(enterHall(), '我诚实交谈并询问守忆人路线');
    const threat = act(enterHall(), '我威胁守忆人立刻交出路线');
    expect(honest.nextState.resources.archivistTrust).toBe(1);
    expect(threat.nextState.resources.archivistTrust).toBe(-1);
    expect(threat.outcome).toBe('costly_success');
    expect(honest.nextState.clues).toContain('star_map');
  });

  it('记录誓言并在违背维持誓言的区域结局中标记后果', () => {
    const promised = act(enterHall(), '我发誓会维持封印').nextState;
    expect(promised.oath).toBe('maintain');
    const summit = { ...reachSummit(), oath: 'maintain' as const };
    const released = act(summit, '我决定释放所有被囚记忆，打碎封印');
    expect(released.outcome).toBe('complete');
    expect(released.nextState.towerOutcome).toBe('released');
    expect(released.nextState.brokenOath).toBe(true);
  });

  it('档案井支持修复、灯火牵引与黑水取证三条路线', () => {
    const hall = act(enterHall(), '我检查星图与空白石碑').nextState;
    const archive = act(hall, '我前往沉星档案井').nextState;

    const repaired = act(archive, '我修复配重升降机构');
    expect(repaired.nextState.testimonies).toEqual(['mason']);
    expect(repaired.nextState.resources.ember).toBe(4);

    const drawn = act(archive, '我用余烬灯牵引玻璃记忆匣浮起');
    expect(drawn.nextState.testimonies).toEqual(['donor']);
    expect(drawn.nextState.resources.ember).toBe(3);

    const water = act(archive, '我进入井底黑水取回记忆匣');
    expect(water.nextState.testimonies).toHaveLength(2);
    expect(water.nextState.resources.echoCorruption).toBe(1);
  });

  it('裂钟回廊允许事实辨路、破坏钟阵和处置受困回声', () => {
    const corridor = { ...reachSummit(), sceneId: 'corridor' as const, completed: false, progress: 3, flags: [] };
    const reasoned = act(corridor, '我观察影子并用北侧事实排除幻象');
    expect(reasoned.nextState.flags).toContain('corridor_route');

    const broken = act(corridor, '我击碎核心铜钟并固定钟舌');
    expect(broken.nextState.resources.towerAlert).toBe(1);

    const carried = act(reasoned.nextState, '我把受困回声收入余烬灯中');
    expect(carried.nextState.echoDisposition).toBe('lantern');
    expect(carried.nextState.resources.emberMax).toBe(5);
    expect(carried.nextState.testimonies).toContain('trapped_echo');
  });

  it('守忆人拒绝承担时采用失败推进并暴露可冒险穿越的旧路', () => {
    const stairs = { ...reachSummit(), sceneId: 'stairs' as const, completed: false, progress: 4, resources: { ...reachSummit().resources, archivistTrust: -1 } };
    const refused = act(stairs, '我要求守忆人承担责任并为我稳定阶梯');
    expect(refused.outcome).toBe('failed_forward');
    expect(refused.nextState.flags).toContain('stairs_residual_route');
    const crossed = act(refused.nextState, '我沿暴露的旧路继续前往塔顶');
    expect(crossed.nextState.sceneId).toBe('summit');
    expect(crossed.nextState.resources.echoCorruption).toBe(stairs.resources.echoCorruption + 1);
  });

  it('完整证词、信任、灯火与低侵蚀共同解锁重构结局', () => {
    const summit = reachSummit();
    expect(summit.sceneId).toBe('summit');
    expect(summit.testimonies).toHaveLength(3);
    expect(summit.resources.archivistTrust).toBe(1);
    const result = act(summit, '我公开三份证词，要求守忆人承认责任，用两簇灯火重构不再献祭的新封印');
    expect(result.outcome).toBe('complete');
    expect(result.nextState.towerOutcome).toBe('reconstructed');
    expect(result.nextState.resources.ember).toBe(2);
    expect(result.nextState.clues).toContain('harbor_ledger');
    expect(result.nextState.clues).toContain('forest_origin');
  });

  it('条件不足时明确阻挡重构，但保留其他最终方案', () => {
    const summit = { ...reachSummit(), testimonies: ['mason'], resources: { ...reachSummit().resources, ember: 1, archivistTrust: 0 } };
    const result = act(summit, '我要重构一个不再献祭记忆的新封印');
    expect(result.outcome).toBe('blocked');
    expect(result.approvedFacts.join('')).toContain('仍缺少');
    expect(result.nextState.completed).toBe(false);
  });

  it('维持、释放和继任均为可执行区域结局，裂钟警觉会增加维持成本', () => {
    const summit = reachSummit();
    const maintained = act({ ...summit, resources: { ...summit.resources, ember: 2, towerAlert: 1 } }, '我决定维持旧封印');
    expect(maintained.nextState.towerOutcome).toBe('maintained');
    expect(maintained.nextState.resources.ember).toBe(0);

    const released = act(summit, '我释放被囚记忆并打碎封印');
    expect(released.nextState.towerOutcome).toBe('released');

    const inherited = act(summit, '我明确接受权柄，继任守忆人并管理灰烬塔');
    expect(inherited.nextState.towerOutcome).toBe('inherited');
  });

  it('重要资源变化使用重要叙事，切换场景和结局使用丰富叙事', () => {
    const game = createInitialGame();
    const inspected = act(game, '我检查门上符文');
    const repeated = act(inspected.nextState, '我再次检查门上符文');
    const moved = act(inspected.nextState, '我按次序点亮并进入');
    expect(selectNarrativeMode(game, inspected)).toBe('important-action');
    expect(selectNarrativeMode(inspected.nextState, repeated)).toBe('brief-action');
    expect(selectNarrativeMode(inspected.nextState, moved)).toBe('background-rich');
  });

  it('只在明确致命行动时失败，并忽略否定表达', () => {
    expect(resolveFatalAction(createInitialGame(), '我不跳下断崖，转身检查石门')).toBeNull();
    const death = resolveFatalAction(reachSummit(), '我明知危险仍伸手抓住黑焰');
    expect(death?.outcome).toBe('failed');
    expect(death?.nextState.failure?.checkpointName).toBe('无火之塔');
  });

  it('检查点完整恢复资源、证词、誓言和对话', () => {
    const hall = markCurrentCheckpoint({
      ...enterHall(), oath: 'seek_truth', resources: { ...enterHall().resources, archivistTrust: 1 },
      messages: [...enterHall().messages, { id: 'entry', role: 'narrator' as const, text: '进入长厅', createdAt: 2 }],
    });
    const explored = appendTurn({ ...hall, testimonies: ['mason'], resources: { ...hall.resources, ember: 2 }, turn: 4 }, '继续', '发生变化');
    const death = resolveFatalAction(explored, '我从断崖跳下')!;
    const restored = restartFromCheckpoint(appendTurn(death.nextState, '跳下', '死亡'));
    expect(restored.messages).toEqual(hall.messages);
    expect(restored.resources).toEqual(hall.resources);
    expect(restored.testimonies).toEqual(hall.testimonies);
    expect(restored.oath).toBe('seek_truth');
  });

  it('把旧三场景存档迁移为正式地图新开局并保留计费信息', () => {
    const migrated = migrateGameState({ id: 'old', sceneId: 'tower', billing: { status: 'unavailable', currency: null, startingBalance: null, currentBalance: null, updatedAt: null } });
    expect(migrated.contentVersion).toBe(3);
    expect(migrated.sceneId).toBe('gate');
    expect(migrated.billing?.status).toBe('unavailable');
    expect(migrated.messages[0].role).toBe('system');
  });

  it('完成灰烬塔后解锁港口与林海，并保留跨地图状态', () => {
    const towerComplete = act(reachSummit(), '我释放被囚记忆并打碎封印').nextState;
    expect(towerComplete.completed).toBe(false);
    expect(towerComplete.regionCompleted).toBe(true);
    expect(towerComplete.completedMaps).toContain('tower');
    const harbor = startCampaignMap(towerComplete, 'harbor');
    expect(harbor.mapId).toBe('harbor');
    expect(harbor.sceneId).toBe('customs');
    expect(harbor.regionCompleted).toBe(false);
    expect(harbor.clues).toContain('harbor_ledger');
  });

  it('剩余地图仍使用确定性规则解析，而不是让叙事模型决定通关', () => {
    const state = {
      ...createInitialGame(), mapId: 'harbor' as const, sceneId: 'customs' as const,
      completedMaps: ['tower' as const], progress: 0,
    };
    const admitted = act(state, '我出示灰烬塔船册，要求合法登记身份');
    expect(admitted.outcome).toBe('progress');
    expect(admitted.nextState.sceneId).toBe('market');
    expect(admitted.nextState.resources.harborAuthority).toBe(1);
  });
});
