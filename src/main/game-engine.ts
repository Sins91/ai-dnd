import { adventure, getMapIdForScene, type MapId, type SceneId } from '../shared/adventure';
import type {
  ActionIntent, ActionOutcome, GameCheckpoint, GameMessage, GameState, NarrativeMode, PlayerOath, TowerOutcome,
} from '../shared/contracts';
import { isCopiedObjective } from '../shared/objectives';
import { resolveCampaignAction, startCampaignMap as beginCampaignMap } from './campaign-engine';

export type Resolution = {
  nextState: GameState;
  outcome: ActionOutcome;
  approvedFacts: string[];
};

const nowMessage = (
  role: GameMessage['role'], text: string, narrativeMode?: NarrativeMode, outcome?: ActionOutcome, sceneId?: SceneId,
): GameMessage => ({
  id: crypto.randomUUID(), role, text, createdAt: Date.now(),
  ...(narrativeMode ? { narrativeMode } : {}),
  ...(outcome ? { outcome } : {}),
  ...(sceneId ? { sceneId } : {}),
});

function changed<T>(before: T, after: T): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function selectNarrativeMode(state: GameState, resolution: Resolution): NarrativeMode {
  if (state.sceneId !== resolution.nextState.sceneId || resolution.outcome === 'complete') return 'background-rich';
  if (resolution.outcome === 'failed') return 'failure-restart';
  const important = changed(state.clues, resolution.nextState.clues)
    || changed(state.testimonies, resolution.nextState.testimonies)
    || changed(state.resources, resolution.nextState.resources)
    || changed(state.flags, resolution.nextState.flags)
    || state.oath !== resolution.nextState.oath
    || resolution.outcome === 'costly_success'
    || resolution.outcome === 'failed_forward';
  return important ? 'important-action' : 'brief-action';
}

function snapshotCheckpoint(state: GameState): GameCheckpoint {
  return {
    mapId: state.mapId,
    sceneId: state.sceneId,
    turn: state.turn,
    progress: state.progress,
    inventory: [...state.inventory],
    clues: [...state.clues],
    testimonies: [...state.testimonies],
    flags: [...state.flags],
    resources: { ...state.resources },
    oath: state.oath,
    brokenOath: state.brokenOath,
    echoDisposition: state.echoDisposition,
    archivistWeakened: state.archivistWeakened,
    towerOutcome: state.towerOutcome,
    harborOutcome: state.harborOutcome,
    forestOutcome: state.forestOutcome,
    campaignOutcome: state.campaignOutcome,
    completedMaps: [...state.completedMaps],
    regionCompleted: state.regionCompleted,
    messages: state.messages.map((message) => ({ ...message })),
    messageCount: state.messages.length,
  };
}

export function ensureGameCheckpoint(state: GameState): GameState {
  return state.checkpoint ? state : { ...state, failed: false, checkpoint: snapshotCheckpoint(state) };
}

export function markCurrentCheckpoint(state: GameState): GameState {
  const normalized = { ...state, failed: false, failure: undefined };
  return { ...normalized, checkpoint: snapshotCheckpoint(normalized) };
}

export function restartFromCheckpoint(state: GameState): GameState {
  const normalized = ensureGameCheckpoint(state);
  const checkpoint = normalized.checkpoint!;
  const messages = checkpoint.messages
    ? checkpoint.messages.map((message) => ({ ...message }))
    : normalized.messages.slice(0, checkpoint.messageCount ?? 0);
  return {
    ...normalized,
    mapId: checkpoint.mapId,
    sceneId: checkpoint.sceneId,
    turn: checkpoint.turn,
    progress: checkpoint.progress,
    inventory: [...checkpoint.inventory],
    clues: [...checkpoint.clues],
    testimonies: [...checkpoint.testimonies],
    flags: [...checkpoint.flags],
    resources: { ...checkpoint.resources },
    oath: checkpoint.oath,
    brokenOath: checkpoint.brokenOath,
    echoDisposition: checkpoint.echoDisposition,
    archivistWeakened: checkpoint.archivistWeakened,
    towerOutcome: checkpoint.towerOutcome,
    harborOutcome: checkpoint.harborOutcome,
    forestOutcome: checkpoint.forestOutcome,
    campaignOutcome: checkpoint.campaignOutcome,
    completedMaps: [...checkpoint.completedMaps],
    regionCompleted: checkpoint.regionCompleted,
    messages,
    completed: false,
    failed: false,
    failure: undefined,
    checkpoint: { ...checkpoint, messages: messages.map((message) => ({ ...message })), messageCount: messages.length },
  };
}

function hasNegatedFatalAction(text: string): boolean {
  return /(?:不|别|避免|拒绝|停止|放弃).{0,8}(?:自杀|跳下|跃下|触摸|抓住|抱住|走进|跳入|吞下|服毒|自焚)/.test(text);
}

export function resolveFatalAction(state: GameState, playerText: string): Resolution | null {
  const text = playerText.replace(/\s+/g, '');
  if (!text || hasNegatedFatalAction(text)) return null;
  const explicitSuicide = /自杀|结束自己的生命|割开.{0,4}(?:喉|咽喉|手腕)|刺向自己的.{0,4}(?:心脏|咽喉)|(?:服下|喝下|吞下).{0,6}(?:毒|毒药)|点燃自己|自焚/.test(text);
  const fatalFall = /(?:跳|跃)(?:下|进|入).{0,8}(?:悬崖|断崖|深渊)|从.{0,8}(?:悬崖|断崖|塔顶).{0,8}(?:跳|跃)下/.test(text);
  const entersBlackFlame = state.sceneId === 'summit' && (
    /(?:触摸|抓住|抱住|走进|冲进|钻进|踏入|跳入|扑向|扑进|伸入|吞下).{0,8}(?:黑焰|黑色火焰)/.test(text)
    || /(?:黑焰|黑色火焰).{0,8}(?:触摸|抓住|抱住|走进|冲进|钻进|踏入|跳入|扑向|扑进|伸入|吞下)/.test(text)
  );
  if (!explicitSuicide && !fatalFall && !entersBlackFlame) return null;
  const reason = entersBlackFlame
    ? '玩家在明确危险中主动接触黑焰，生命被冰冷火焰吞没。'
    : fatalFall ? '玩家主动跃入无法生还的高度，坠落致死。' : '玩家主动实施了明确致命的自毁行为。';
  const checkpointName = adventure.scenes[state.sceneId].name;
  return {
    nextState: {
      ...state, failed: true, failure: { action: playerText.trim().slice(0, 160), reason, checkpointName }, turn: state.turn + 1,
    },
    outcome: 'failed',
    approvedFacts: [reason, `游戏失败；确认后将返回“${checkpointName}”流程点。`],
  };
}

export function createInitialGame(): GameState {
  const game: GameState = {
    contentVersion: 3,
    id: crypto.randomUUID(),
    mapId: 'tower',
    sceneId: 'gate',
    turn: 0,
    progress: 0,
    inventory: ['ember_lantern'],
    clues: [],
    testimonies: [],
    flags: [],
    resources: {
      ember: 4, emberMax: 6, archivistTrust: 0, echoCorruption: 0, towerAlert: 0,
      publicSupport: 0, harborAuthority: 0, unionTrust: 0, merchantTrust: 0, harborTension: 0, ledgerEvidence: 0,
      forestRecognition: 0, cycleBalance: 0, rootPollution: 0, ringMarks: 0,
      courtStability: 1, publicEvidence: 0, allianceSeats: 0, centralAuthority: 0, transitionBurden: 0,
    },
    oath: 'none',
    brokenOath: false,
    echoDisposition: 'undecided',
    archivistWeakened: false,
    completedMaps: [],
    regionCompleted: false,
    completed: false,
    messages: [nowMessage('narrator', openingNarration(), 'background-rich', undefined, 'gate')],
  };
  return markCurrentCheckpoint(game);
}

function openingNarration(): string {
  return `${adventure.prologue}\n\n—— 封印之门 ——\n\n${adventure.scenes.gate.description}\n\n余烬灯在你手中轻轻一震。你可以自由描述接下来想做的事。`;
}

export function migrateGameState(raw: unknown): GameState {
  type StoredGame = Partial<Omit<GameState, 'contentVersion'>> & { contentVersion?: number };
  const value = raw as StoredGame | null;
  if (!value || ![2, 3].includes(value.contentVersion ?? 0) || !value.resources || !Array.isArray(value.testimonies)) {
    const fresh = createInitialGame();
    if (value?.billing) fresh.billing = value.billing;
    fresh.messages.unshift(nowMessage('system', '灰烬塔已升级为六场景正式内容，旧演示进度已转换为新的地图开局。'));
    return markCurrentCheckpoint(fresh);
  }
  const defaults = createInitialGame().resources;
  const wasTowerComplete = value.contentVersion === 2 && Boolean(value.completed && value.towerOutcome);
  const current: GameState = {
    ...(value as unknown as GameState),
    contentVersion: 3,
    mapId: value.mapId ?? getMapIdForScene(value.sceneId ?? 'gate'),
    resources: { ...defaults, ...value.resources },
    completedMaps: value.completedMaps ?? (wasTowerComplete ? ['tower'] : []),
    regionCompleted: value.regionCompleted ?? wasTowerComplete,
    completed: value.contentVersion === 2 ? false : Boolean(value.completed),
  };
  if (current.sceneId === 'gate' && current.turn === 0 && current.messages.length === 1
    && !current.messages[0].text.includes(adventure.prologue.slice(0, 16))) {
    const updated = { ...current, messages: [{ ...current.messages[0], text: openingNarration() }] };
    return markCurrentCheckpoint(updated);
  }
  return value.contentVersion === 2 ? markCurrentCheckpoint(current) : ensureGameCheckpoint(current);
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function addUniqueMap(values: MapId[], value: MapId): MapId[] {
  return values.includes(value) ? values : [...values, value];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function combinedText(intent: ActionIntent, playerText: string): string {
  return `${playerText} ${intent.target} ${intent.approach} ${intent.goal}`.toLowerCase().replace(/\s+/g, '');
}

function baseNext(state: GameState) {
  return {
    ...state,
    clues: [...state.clues],
    testimonies: [...state.testimonies],
    flags: [...state.flags],
    resources: { ...state.resources },
    turn: state.turn + 1,
  };
}

function moveTo(state: GameState, sceneId: SceneId, progress: number): GameState {
  return { ...state, sceneId, progress: Math.max(state.progress, progress) };
}

export function classifyLocally(text: string): ActionIntent {
  const normalized = text.toLowerCase();
  const risk = /强行|硬闯|不顾|冒险|直接跳|砸|摧毁/.test(normalized) ? 'reckless' as const
    : /小心|谨慎|慢慢|先观察/.test(normalized) ? 'cautious' as const : 'normal' as const;
  if (/查看|观察|检查|搜索|调查|倾听|辨认|inspect|search/.test(normalized)) {
    return { type: 'inspect', target: text, approach: text, goal: '获取可验证信息', risk };
  }
  if (/说|问|交谈|询问|威胁|劝说|承诺|拒绝|要求|talk|ask/.test(normalized)) {
    return { type: 'talk', target: text, approach: text, goal: '影响人物或取得信息', risk };
  }
  if (/使用|点亮|举起|打开.*灯|灯.*打开|灌注|注入|牵引|封存|use/.test(normalized)) {
    return { type: 'use_item', target: /灯|余烬/.test(normalized) ? 'ember_lantern' : text, approach: text, goal: text, risk };
  }
  if (/进入|前往|上楼|推门|穿过|离开|踏入|涉入|move|enter/.test(normalized)) {
    return { type: 'move', target: text, approach: text, goal: '移动或穿越', risk };
  }
  return { type: 'improvise', target: text, approach: text, goal: text, risk };
}

function resolveGate(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  const mimic = /模仿|回应|敲击|回敲|节奏/.test(text);
  const force = /强行|灌注|注入|烧开|炸开|砸开/.test(text);
  const orderedEntry = /(?:风.*星.*灰|按.*次序|依次).*?(?:点亮|开启|进入|穿过)|(?:进入|穿过).*?(?:符文|石门)/.test(text);
  if (mimic) {
    next.clues = addUnique(next.clues, 'echo_rhythm');
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.flags = addUnique(next.flags, 'gate_opened_by_echo');
    next = moveTo(next, 'hall', 1);
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['玩家模仿三次敲击，封印把回应误认成塔内信号。', '黑石门开启。', '回声侵蚀增加一层。'] };
  }
  if (force) {
    if (next.resources.ember < 2) return { nextState: next, outcome: 'blocked', approvedFacts: ['余烬灯的灯火不足以强行灌开三枚符文。', '调查刻痕仍可找到不消耗灯火的开启方法。'] };
    next.resources.ember -= 2;
    next.flags = addUnique(next.flags, 'gate_forced');
    next = moveTo(next, 'hall', 1);
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['玩家向三枚符文强行灌入余烬。', '黑石门开启。', '余烬灯火消耗两簇。'] };
  }
  if (orderedEntry && next.clues.includes('door_sigils')) {
    next.flags = addUnique(next.flags, 'gate_opened_by_sigils');
    next = moveTo(next, 'hall', 1);
    return { nextState: next, outcome: 'progress', approvedFacts: ['风、星、灰三枚符文依次亮起。', '黑石门无声开启，玩家进入守忆长厅。'] };
  }
  if (intent.type === 'inspect' || intent.type === 'use_item') {
    const gained = !next.clues.includes('door_sigils');
    next.clues = addUnique(next.clues, 'door_sigils');
    return { nextState: next, outcome: gained ? 'progress' : 'flavor', approvedFacts: gained
      ? ['余烬灯照出被雨水遮蔽的刻痕。', adventure.clues.door_sigils]
      : ['三枚符文的刻痕没有变化；已确认的次序仍然有效。'] };
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('door_sigils')) return { nextState: next, outcome: 'blocked', approvedFacts: ['黑石门没有门缝，也不能被普通推拉开启。', '灯光能够照出符文附近被雨水遮住的刻痕。'] };
    next.flags = addUnique(next.flags, 'gate_opened_by_sigils');
    next = moveTo(next, 'hall', 1);
    return { nextState: next, outcome: 'progress', approvedFacts: ['风、星、灰三枚符文依次亮起。', '黑石门无声开启，玩家进入守忆长厅。'] };
  }
  return { nextState: next, outcome: 'flavor', approvedFacts: ['行动引起一次迟来的回声，但没有改变封印。', '门上的符文仍值得调查。'] };
}

function oathFromText(text: string): PlayerOath | null {
  if (/承诺|发誓|答应/.test(text) && /维持|守塔|封印/.test(text)) return 'maintain';
  if (/查明|真相|调查清楚|再决定/.test(text) && /承诺|答应|会/.test(text)) return 'seek_truth';
  if (/拒绝|不承诺|不发誓/.test(text)) return 'refused';
  return null;
}

function resolveHall(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  const oath = oathFromText(text);
  if (oath) {
    next.oath = oath;
    if (oath === 'seek_truth') next.resources.archivistTrust = clamp(next.resources.archivistTrust + 1, -2, 2);
    if (oath === 'refused') next.resources.archivistTrust = clamp(next.resources.archivistTrust - 1, -2, 2);
    const fact = oath === 'maintain' ? '玩家承诺维持灰烬塔封印。'
      : oath === 'seek_truth' ? '玩家承诺查明真相后再作决定。' : '玩家明确拒绝在不知真相时作出承诺。';
    return { nextState: next, outcome: 'progress', approvedFacts: [fact, '守忆人记住了这项选择。'] };
  }
  if (intent.type === 'talk') {
    const coercive = /威胁|逼迫|欺骗|骗|恐吓|冒充/.test(text);
    next.clues = addUnique(next.clues, 'archivist_warning');
    next.clues = addUnique(next.clues, 'star_map');
    next.resources.archivistTrust = clamp(next.resources.archivistTrust + (coercive ? -1 : 1), -2, 2);
    return { nextState: next, outcome: coercive ? 'costly_success' : 'progress', approvedFacts: coercive
      ? ['守忆人在压力下交出档案井路线。', adventure.clues.archivist_warning, '守忆人信任下降。']
      : ['守忆人说明北侧道路先通往沉星档案井。', adventure.clues.archivist_warning, '守忆人信任上升。'] };
  }
  if (intent.type === 'inspect' || (intent.type !== 'move' && /石碑|星图|灰袍/.test(text))) {
    const gained = !next.clues.includes('erased_names');
    next.clues = addUnique(next.clues, 'erased_names');
    next.clues = addUnique(next.clues, 'star_map');
    return { nextState: next, outcome: gained ? 'progress' : 'flavor', approvedFacts: gained
      ? ['石碑背面的凿痕与守忆人袖口的石粉一致。', adventure.clues.erased_names, adventure.clues.star_map]
      : ['星图和石碑没有出现新的变化；档案井路线已经明确。'] };
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('star_map') && !next.clues.includes('archivist_warning')) {
      return { nextState: next, outcome: 'blocked', approvedFacts: ['移动石碑遮住北侧通路。', '调查星图或与守忆人交谈可以确定安全路线。'] };
    }
    next = moveTo(next, 'archive', 2);
    return { nextState: next, outcome: 'progress', approvedFacts: ['移动石碑让出向下的圆形井道。', '玩家抵达沉星档案井。'] };
  }
  return { nextState: next, outcome: 'flavor', approvedFacts: ['守忆人注视着行动，没有替玩家作出判断。', '大厅的关键状态没有改变。'] };
}

function resolveArchive(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  const blackWater = /黑水|井底|涉水|跳入水|进入水/.test(text);
  const repair = /修复|配重|升降|齿轮|机构/.test(text);
  const lantern = /牵引|浮起|玻璃匣|记忆匣/.test(text) && /灯|余烬|照/.test(text);
  if (blackWater) {
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.testimonies = addUnique(addUnique(next.testimonies, 'mason'), 'donor');
    next.clues = addUnique(next.clues, 'memory_fuel');
    next.flags = addUnique(next.flags, 'archive_route');
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['玩家进入不反光的黑水，取回两只完整记忆匣。', adventure.testimonies.mason, adventure.testimonies.donor, '回声侵蚀增加一层。'] };
  }
  if (repair) {
    next.testimonies = addUnique(next.testimonies, 'mason');
    next.clues = addUnique(next.clues, 'memory_fuel');
    next.flags = addUnique(next.flags, 'archive_route');
    return { nextState: next, outcome: 'progress', approvedFacts: ['配重轮恢复平衡，升降台抵达中央星图。', adventure.testimonies.mason, adventure.clues.memory_fuel] };
  }
  if (lantern) {
    if (next.resources.ember < 1) return { nextState: next, outcome: 'blocked', approvedFacts: ['余烬灯已经没有足够灯火牵引记忆匣。', '井壁配重机构仍可修复，黑水中也存在可冒险取得的档案。'] };
    next.resources.ember -= 1;
    next.testimonies = addUnique(next.testimonies, 'donor');
    next.clues = addUnique(next.clues, 'memory_fuel');
    next.flags = addUnique(next.flags, 'archive_route');
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['余烬灯从井壁牵引出一只记忆匣。', adventure.testimonies.donor, '余烬灯火消耗一簇。'] };
  }
  if (intent.type === 'inspect') {
    const gained = !next.clues.includes('archive_mechanism');
    next.clues = addUnique(next.clues, 'archive_mechanism');
    return { nextState: next, outcome: gained ? 'progress' : 'flavor', approvedFacts: gained
      ? ['配重轮的磨损方向、余烬对玻璃匣的牵引和黑水的危险都可以被确认。', adventure.clues.archive_mechanism]
      : ['三条取证路径没有变化：修复机构、消耗灯火牵引，或冒险进入黑水。'] };
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('archive_route') || next.testimonies.length === 0) return { nextState: next, outcome: 'blocked', approvedFacts: ['通往上层的星图仍缺少定位。', '取得至少一份记忆证词即可补全路线。'] };
    next.clues = addUnique(next.clues, 'star_map');
    next = moveTo(next, 'corridor', 3);
    return { nextState: next, outcome: 'progress', approvedFacts: ['记忆匣中的星位补全了北侧路线。', '玩家进入裂钟回廊。'] };
  }
  return { nextState: next, outcome: 'flavor', approvedFacts: ['井壁回声回应了行动，但没有新的档案脱离封存。'] };
}

function resolveCorridor(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  const chooseEcho = /回声/.test(text) && /带走|留下|收入|装入|灯里|灯中/.test(text);
  if (chooseEcho) {
    if (/留下|不带|拒绝/.test(text)) {
      next.echoDisposition = 'left';
      return { nextState: next, outcome: 'progress', approvedFacts: ['玩家让受困回声留在原处，不把它当作可占有的物品。'] };
    }
    if (/灯里|灯中|收入|装入/.test(text)) {
      next.echoDisposition = 'lantern';
      next.resources.emberMax = Math.max(2, next.resources.emberMax - 1);
      next.resources.ember = Math.min(next.resources.ember, next.resources.emberMax);
      next.testimonies = addUnique(next.testimonies, 'trapped_echo');
      return { nextState: next, outcome: 'costly_success', approvedFacts: ['余烬灯为受困回声提供稳定形态。', adventure.testimonies.trapped_echo, '余烬灯火上限永久减少一簇。'] };
    }
    next.echoDisposition = 'carried';
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.testimonies = addUnique(next.testimonies, 'trapped_echo');
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['玩家带走受困回声。', adventure.testimonies.trapped_echo, '回声侵蚀增加一层。'] };
  }
  if (/破坏|砸|击碎|固定钟|堵住钟|钟舌/.test(text)) {
    next.resources.towerAlert = clamp(next.resources.towerAlert + 1, 0, 2);
    next.flags = addUnique(next.flags, 'corridor_route');
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['核心铜钟停止摆动，北侧阶梯显现。', '塔顶黑焰被震动惊醒，塔顶警觉增加一层。'] };
  }
  if (intent.type === 'talk' && /守忆人|求助|回应|反向誓词/.test(text)) {
    if (next.resources.archivistTrust < 1) return { nextState: next, outcome: 'blocked', approvedFacts: ['守忆人没有回应呼唤。', '此前建立的信任不足以让他承担侵蚀；仍可依据方向、影子和未知信息规律辨路。'] };
    next.archivistWeakened = true;
    next.flags = addUnique(next.flags, 'corridor_route');
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['守忆人以不能被完整复制的反向誓词标出北侧阶梯。', '他替玩家承受了一次回声侵蚀，之后的协助能力下降。'] };
  }
  if (intent.type === 'inspect' || /影子|北侧|事实|辨别|排除/.test(text)) {
    const gained = !next.clues.includes('corridor_truth');
    next.clues = addUnique(next.clues, 'corridor_truth');
    next.flags = addUnique(next.flags, 'corridor_route');
    next.resources.echoCorruption = Math.max(0, next.resources.echoCorruption - 1);
    return { nextState: next, outcome: gained ? 'progress' : 'flavor', approvedFacts: gained
      ? [adventure.clues.corridor_truth, '玩家依据已确认事实识破道路幻象，回声侵蚀减轻一层。']
      : ['北侧无影道路仍是真实路线，没有新的出口出现。'] };
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('corridor_route')) return { nextState: next, outcome: 'blocked', approvedFacts: ['每次钟响都会让道路外观变化。', '方向、影子和声音是否包含未知事实可以用来辨别真实路线。'] };
    next = moveTo(next, 'stairs', 4);
    return { nextState: next, outcome: 'progress', approvedFacts: ['没有稳定影子的假路逐一闭合。', '玩家抵达灰烬阶梯。'] };
  }
  return { nextState: next, outcome: 'flavor', approvedFacts: ['裂钟重复了行动声，却没有提供任何新的真实信息。'] };
}

function resolveStairs(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  next.clues = addUnique(next.clues, 'archivist_responsibility');
  const stabilize = /稳定|修复|星图节点|灯火/.test(text) && /灯|余烬|节点/.test(text);
  const memoryRoute = /证词|残影|当年|路线|建塔者/.test(text);
  const demand = /守忆人|承担|赎罪|责任/.test(text) && (intent.type === 'talk' || /要求|命令/.test(text));
  if (stabilize) {
    if (next.resources.ember < 1) return { nextState: next, outcome: 'blocked', approvedFacts: ['余烬灯没有足够灯火稳定全部星图节点。', '记忆证词中的建塔路线仍可用于穿越。'] };
    next.resources.ember -= 1;
    next.flags = addUnique(next.flags, 'stairs_stabilized');
    next = moveTo(next, 'summit', 5);
    return { nextState: next, outcome: 'costly_success', approvedFacts: [adventure.clues.archivist_responsibility, '余烬灯稳定了崩裂阶梯。', '灯火消耗一簇，玩家抵达无火之塔。'] };
  }
  if (memoryRoute && next.testimonies.length > 0) {
    next.flags = addUnique(next.flags, 'stairs_memory_route');
    next = moveTo(next, 'summit', 5);
    return { nextState: next, outcome: 'progress', approvedFacts: [adventure.clues.archivist_responsibility, '记忆证词中的脚步与残影重合，玩家沿建塔者旧路抵达塔顶。'] };
  }
  if (demand) {
    if (next.resources.archivistTrust >= 1 && !next.archivistWeakened) {
      next.flags = addUnique(next.flags, 'archivist_accepts_responsibility');
      next = moveTo(next, 'summit', 5);
      return { nextState: next, outcome: 'progress', approvedFacts: [adventure.clues.archivist_responsibility, '守忆人承认责任并替玩家稳定阶梯。', '他将作为盟友面对最终封印。'] };
    }
    next.flags = addUnique(next.flags, 'stairs_residual_route');
    return { nextState: next, outcome: 'failed_forward', approvedFacts: [adventure.clues.archivist_responsibility, '守忆人拒绝或已无力承担阶梯反冲。', '他的封印残影仍暴露了一条可以冒险穿越的旧路。'] };
  }
  if (intent.type === 'inspect') {
    return { nextState: next, outcome: 'progress', approvedFacts: [adventure.clues.archivist_responsibility, '墙面残影同时证明了当年的灾难和后来被掩盖的责任。'] };
  }
  if (intent.type === 'move' && next.flags.includes('stairs_residual_route')) {
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next = moveTo(next, 'summit', 5);
    return { nextState: next, outcome: 'costly_success', approvedFacts: ['玩家沿不稳定的封印残影穿过断阶。', '回声侵蚀增加一层，玩家抵达无火之塔。'] };
  }
  if (intent.type === 'move') return { nextState: next, outcome: 'blocked', approvedFacts: ['阶梯正在崩裂，直接前进会被断层阻挡。', '可以用灯火稳定、依据记忆证词辨路，或要求守忆人承担责任。'] };
  return { nextState: next, outcome: 'flavor', approvedFacts: ['残影继续重复建塔往事，阶梯状态没有改变。'] };
}

function completeTower(state: GameState, outcome: TowerOutcome, facts: string[]): Resolution {
  const brokenOath = state.brokenOath || (state.oath === 'maintain' && outcome !== 'maintained');
  return {
    nextState: {
      ...state,
      towerOutcome: outcome,
      completedMaps: addUniqueMap(state.completedMaps, 'tower'),
      regionCompleted: true,
      completed: false,
      progress: 6,
      brokenOath,
    },
    outcome: 'complete',
    approvedFacts: facts,
  };
}

function resolveSummit(state: GameState, intent: ActionIntent, text: string): Resolution {
  let next = baseNext(state);
  const alertSurcharge = next.resources.towerAlert > 0 ? 1 : 0;
  const reconstruct = /重构|重新设计|新封印|见证.*归还|不再.*献祭/.test(text);
  const release = /释放|打碎|摧毁封印|放出记忆|终止封印/.test(text);
  const inherit = /继任|接替|成为守忆人|我来管理|接受权柄/.test(text);
  const maintain = /维持|旧封印|继续封存|照旧封存/.test(text);
  if (reconstruct) {
    const missing: string[] = [];
    if (next.testimonies.length < 3) missing.push('三份记忆证词');
    if (next.resources.archivistTrust < 1) missing.push('守忆人的信任与承认');
    if (next.resources.ember < 2 + alertSurcharge) missing.push(alertSurcharge ? '至少三簇灯火（含压制塔顶警觉的一簇）' : '至少两簇灯火');
    if (next.resources.echoCorruption >= 3) missing.push('低于三层的回声侵蚀');
    if (missing.length > 0) return { nextState: next, outcome: 'blocked', approvedFacts: ['重构需要证词、责任、灯火与稳定心智共同成立。', `当前仍缺少：${missing.join('、')}。`, '玩家仍可选择维持、释放或主动继任。'] };
    next.resources.ember -= 2 + alertSurcharge;
    next.clues = addUnique(addUnique(next.clues, 'harbor_ledger'), 'forest_origin');
    return completeTower(next, 'reconstructed', ['三份证词公开了被抹去的姓名，守忆人承认责任。', alertSurcharge ? '额外一簇灯火压住了裂钟惊醒的黑焰。' : '塔顶黑焰尚未被提前惊醒。', '余烬灯把黑焰与被囚记忆分离，灰烬塔永久熄灭。', adventure.clues.harbor_ledger, adventure.clues.forest_origin]);
  }
  if (release) {
    if (next.testimonies.length < 2 && !next.clues.includes('seal_principle')) return { nextState: next, outcome: 'blocked', approvedFacts: ['直接打碎封印会释放无法预测的记忆洪流。', '至少两份证词或完整封印原理能够确认可承受的释放路径。'] };
    next.clues = addUnique(addUnique(next.clues, 'harbor_ledger'), 'forest_origin');
    return completeTower(next, 'released', ['玩家打碎记忆供给与黑焰之间的封印。', '被囚记忆开始回流，塔体随之崩裂。', adventure.clues.harbor_ledger, adventure.clues.forest_origin]);
  }
  if (inherit) {
    next.clues = addUnique(addUnique(next.clues, 'harbor_ledger'), 'forest_origin');
    return completeTower(next, 'inherited', ['玩家明确接受守忆人的权柄并接管灰烬塔。', '灾难被延后，记忆献祭制度仍等待之后的处理。', adventure.clues.harbor_ledger, adventure.clues.forest_origin]);
  }
  if (maintain) {
    if (next.resources.ember < 1 + alertSurcharge) return { nextState: next, outcome: 'blocked', approvedFacts: ['余烬灯已经没有足够灯火维持旧封印并压制塔顶警觉。', '玩家仍可依据证词释放封印、主动继任，或在条件具备时重构。'] };
    next.resources.ember -= 1 + alertSurcharge;
    next.clues = addUnique(addUnique(next.clues, 'harbor_ledger'), 'forest_origin');
    return completeTower(next, 'maintained', [alertSurcharge ? '裂钟提前惊醒黑焰，额外一簇灯火被用于压制反冲。' : '塔顶黑焰尚未被提前惊醒。', '余烬灯重新封存黑焰，灰烬塔恢复稳定。', '以记忆维持封印的旧机制仍然存在。', adventure.clues.harbor_ledger, adventure.clues.forest_origin]);
  }
  if (intent.type === 'inspect' || intent.type === 'use_item') {
    const gained = !next.clues.includes('seal_principle');
    next.clues = addUnique(next.clues, 'seal_principle');
    return { nextState: next, outcome: gained ? 'progress' : 'flavor', approvedFacts: gained
      ? [adventure.clues.seal_principle, '黑焰只能模仿玩家已经听过的声音，不能证明任何未知事实。']
      : ['四种处理方向没有变化；最终行动必须由玩家明确选择。'] };
  }
  return { nextState: next, outcome: 'blocked', approvedFacts: ['黑焰无法被普通武力或言语改变。', '玩家需要明确选择维持、释放、继任或重构封印。'] };
}

export function resolveAction(state: GameState, intent: ActionIntent, playerText = ''): Resolution {
  if (state.failed) return { nextState: state, outcome: 'blocked', approvedFacts: ['必须先确认失败并返回流程点，才能继续行动。'] };
  if (state.completed) return { nextState: state, outcome: 'blocked', approvedFacts: ['四地图战役已经结束，必须开始新游戏才能再次行动。'] };
  if (state.regionCompleted) return { nextState: state, outcome: 'blocked', approvedFacts: ['当前地图已经结束，请先选择下一张已解锁地图。'] };
  if (isCopiedObjective(state, playerText)) {
    return {
      nextState: baseNext(state),
      outcome: 'blocked',
      approvedFacts: ['任务栏描述的是当前目标与阻碍，不是一项已经执行的行动。', '请说明你具体要对什么采取行动，以及准备采用什么方法。'],
    };
  }
  const text = combinedText(intent, playerText);
  if (state.mapId !== 'tower') return resolveCampaignAction(state, intent, text);
  if (state.sceneId === 'gate') return resolveGate(state, intent, text);
  if (state.sceneId === 'hall') return resolveHall(state, intent, text);
  if (state.sceneId === 'archive') return resolveArchive(state, intent, text);
  if (state.sceneId === 'corridor') return resolveCorridor(state, intent, text);
  if (state.sceneId === 'stairs') return resolveStairs(state, intent, text);
  return resolveSummit(state, intent, text);
}

export function startCampaignMap(state: GameState, mapId: MapId): GameState {
  return markCurrentCheckpoint(beginCampaignMap(state, mapId));
}

export function appendTurn(
  state: GameState, playerText: string, narratorText: string, narrativeMode?: NarrativeMode, outcome?: ActionOutcome,
): GameState {
  return {
    ...state,
    messages: [
      ...state.messages,
      nowMessage('player', playerText),
      nowMessage('narrator', narratorText, narrativeMode, outcome, state.sceneId),
    ],
  };
}
