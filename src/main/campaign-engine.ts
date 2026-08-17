import { adventure, type MapId, type SceneId } from '../shared/adventure';
import type { ActionIntent, ActionOutcome, CampaignOutcome, ForestOutcome, GameMessage, GameState, HarborOutcome } from '../shared/contracts';

export type CampaignResolution = {
  nextState: GameState;
  outcome: ActionOutcome;
  approvedFacts: string[];
};

const addUnique = <T extends string>(values: T[], value: T): T[] => values.includes(value) ? values : [...values, value];
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const has = (text: string, pattern: RegExp) => pattern.test(text);

function baseNext(state: GameState): GameState {
  return {
    ...state,
    inventory: [...state.inventory],
    clues: [...state.clues],
    testimonies: [...state.testimonies],
    flags: [...state.flags],
    completedMaps: [...state.completedMaps],
    resources: { ...state.resources },
    turn: state.turn + 1,
  };
}

function moveTo(state: GameState, sceneId: SceneId, progress: number): GameState {
  return { ...state, sceneId, progress: Math.max(state.progress, progress) };
}

function result(nextState: GameState, outcome: ActionOutcome, ...approvedFacts: string[]): CampaignResolution {
  return { nextState, outcome, approvedFacts };
}

function completeHarbor(state: GameState, outcome: HarborOutcome, facts: string[]): CampaignResolution {
  return result({
    ...state,
    harborOutcome: outcome,
    completedMaps: addUnique(state.completedMaps, 'harbor'),
    regionCompleted: true,
    completed: false,
    progress: 6,
  }, 'complete', ...facts);
}

function completeForest(state: GameState, outcome: ForestOutcome, facts: string[]): CampaignResolution {
  return result({
    ...state,
    forestOutcome: outcome,
    completedMaps: addUnique(state.completedMaps, 'forest'),
    regionCompleted: true,
    completed: false,
    progress: 6,
  }, 'complete', ...facts);
}

function completeCampaign(state: GameState, outcome: CampaignOutcome, facts: string[]): CampaignResolution {
  return result({
    ...state,
    campaignOutcome: outcome,
    completedMaps: addUnique(state.completedMaps, 'court'),
    regionCompleted: true,
    completed: true,
    progress: 6,
  }, 'complete', ...facts);
}

function resolveCustoms(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /船册|总账|征集记录|合法登记|登记身份/)) {
    next.flags = addUnique(next.flags, 'harbor_registered');
    next.resources.harborAuthority = clamp(next.resources.harborAuthority + 1, -3, 4);
    next = moveTo(next, 'market', 1);
    return result(next, 'progress', '玩家以灰烬塔船册完成合法登记。', '潮关放行，玩家进入失名集市。');
  }
  if (has(text, /潮工|工会|混入|担保|运货队/)) {
    next.flags = addUnique(next.flags, 'harbor_union_entry');
    next.resources.unionTrust = clamp(next.resources.unionTrust + 1, -3, 4);
    next.resources.harborTension = clamp(next.resources.harborTension + 1, 0, 5);
    next = moveTo(next, 'market', 1);
    return result(next, 'costly_success', '潮工为玩家提供临时担保。', '玩家绕过正式审查，但港区警觉略有上升。');
  }
  if (has(text, /余烬|灯火|亲历|记忆验证/)) {
    next.flags = addUnique(next.flags, 'harbor_ember_entry');
    next.resources.publicSupport = clamp(next.resources.publicSupport + 1, -3, 4);
    next.resources.harborAuthority = clamp(next.resources.harborAuthority - 1, -3, 4);
    next = moveTo(next, 'market', 1);
    return result(next, 'progress', '余烬灯证明玩家亲历灰烬塔事件。', '围观者的声援迫使验忆所放行。');
  }
  if (intent.type === 'inspect') return result(next, 'progress', '验忆所接受船册、潮工担保或余烬亲历作为三类入港凭据。');
  return result(next, 'blocked', '潮关拒绝无凭据通行。', '玩家需要明确选择船册登记、潮工担保或余烬验证。');
}

function resolveMarket(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /票据|印记|采购|编号|追查|摊位/)) {
    const fresh = !next.clues.includes('harbor_stamp');
    next.clues = addUnique(next.clues, 'harbor_stamp');
    next.resources.ledgerEvidence = clamp(next.resources.ledgerEvidence + (fresh ? 1 : 0), 0, 5);
    return result(next, fresh ? 'progress' : 'flavor', adventure.clues.harbor_stamp);
  }
  if (has(text, /失名者|找回名字|帮助|身份/)) {
    next.testimonies = addUnique(next.testimonies, 'harbor_worker');
    next.resources.publicSupport = clamp(next.resources.publicSupport + 1, -3, 4);
    next.resources.unionTrust = clamp(next.resources.unionTrust + 1, -3, 4);
    return result(next, 'progress', adventure.testimonies.harbor_worker, '失名者愿意在之后公开作证。');
  }
  if (has(text, /商人|交易|收买|仓库路线/)) {
    next.flags = addUnique(next.flags, 'merchant_vault_route');
    next.resources.merchantTrust = clamp(next.resources.merchantTrust + 1, -3, 4);
    return result(next, 'costly_success', '商人交出一条通向征忆库的装卸路线。', '这笔交易令潮工对玩家保持戒心。');
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('harbor_stamp') && !next.testimonies.includes('harbor_worker') && !next.flags.includes('merchant_vault_route')) {
      return result(next, 'blocked', '玩家尚未在市场取得可追查的线索或关系。');
    }
    return result(moveTo(next, 'tideward', 2), 'progress', '玩家沿采购印记和失名者流向抵达潮痕街区。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '集市同时交易货物、身份和被拆分的生活片段。');
}

function resolveTideward(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /旧物|习惯|多源|交叉|核验|邻居/)) {
    next.testimonies = addUnique(next.testimonies, 'returned_identity');
    next.clues = addUnique(next.clues, 'famine_contract');
    next.flags = addUnique(next.flags, 'tideward_resolved');
    next.resources.publicSupport = clamp(next.resources.publicSupport + 1, -3, 4);
    next.resources.harborTension = clamp(next.resources.harborTension - 1, 0, 5);
    return result(next, 'progress', adventure.testimonies.returned_identity, adventure.clues.famine_contract);
  }
  if (has(text, /共同身份|共同生活|暂缓裁定|延后裁定/)) {
    next.flags = addUnique(next.flags, 'tideward_resolved');
    next.resources.unionTrust = clamp(next.resources.unionTrust + 1, -3, 4);
    next.resources.harborAuthority = clamp(next.resources.harborAuthority - 1, -3, 4);
    return result(next, 'progress', '街区接受临时共同身份，不再强迫回流者立刻证明唯一所有权。');
  }
  if (has(text, /封锁|巡逻|强制裁定|驱散/)) {
    next.flags = addUnique(next.flags, 'tideward_resolved');
    next.resources.harborAuthority = clamp(next.resources.harborAuthority + 1, -3, 4);
    next.resources.publicSupport = clamp(next.resources.publicSupport - 1, -3, 4);
    next.resources.harborTension = clamp(next.resources.harborTension + 1, 0, 5);
    return result(next, 'costly_success', '巡逻队暂时压住身份争执。', '街区服从，但不再信任这次裁定。');
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('tideward_resolved')) return result(next, 'blocked', '身份冲突仍在扩大，议事厅不会受理一份未经处理的街区报告。');
    return result(moveTo(next, 'council', 3), 'progress', '玩家带着街区处理结果进入沉钟议事厅。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '契约、生活习惯与邻里证词可以共同检验回流身份。');
}

function resolveCouncil(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /公开证据|票据|契约|证词|质询/)) {
    if (next.resources.ledgerEvidence < 1 && next.testimonies.length < 1) return result(next, 'blocked', '公开质询需要至少一项账册线索或证词。');
    next.flags = addUnique(next.flags, 'vault_access');
    next.resources.publicSupport = clamp(next.resources.publicSupport + 1, -3, 4);
    return result(next, 'progress', '公开证据迫使议事厅签发征忆库核查令。');
  }
  if (has(text, /潮工|工会|罢工|群众/)) {
    if (next.resources.unionTrust < 1) return result(next, 'blocked', '潮工尚未信任玩家，无法形成有效施压。');
    next.flags = addUnique(next.flags, 'vault_access');
    next.resources.allianceSeats = clamp(next.resources.allianceSeats + 1, 0, 5);
    return result(next, 'progress', '潮工代表以停运压力换得征忆库入口。');
  }
  if (has(text, /商会|商人|物流|装卸路线/)) {
    if (next.resources.merchantTrust < 1 && !next.flags.includes('merchant_vault_route')) return result(next, 'blocked', '玩家没有足够的商会关系。');
    next.flags = addUnique(next.flags, 'vault_access');
    next.resources.harborAuthority = clamp(next.resources.harborAuthority + 1, -3, 4);
    return result(next, 'costly_success', '商会打开征忆库的物流入口。', '这条路线保留了商会对后续处置的议价权。');
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('vault_access')) return result(next, 'blocked', '议事厅尚未承认玩家有权进入中央征忆库。');
    return result(moveTo(next, 'vault', 4), 'progress', '沉钟落下一声，征忆库的水下闸门开启。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '议事厅可被公开证据、潮工联盟或商会物流三种力量撬动。');
}

function resolveVault(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  const all = has(text, /全部|全都|同时保全|完整保全/);
  const ledgerAndWitness = has(text, /总账.*证人|证人.*总账/);
  const ledgerAndOperation = has(text, /总账.*运行|运行.*总账|总账.*设施|设施.*总账/);
  if (all && (next.clues.includes('natural_seal') || next.resources.ember >= 2)) {
    if (!next.clues.includes('natural_seal')) next.resources.ember -= 2;
    next.inventory = addUnique(next.inventory, 'master_ledger');
    next.clues = addUnique(next.clues, 'master_ledger');
    next.testimonies = addUnique(next.testimonies, 'harbor_worker');
    next.flags = addUnique(addUnique(next.flags, 'vault_witnesses_saved'), 'vault_operations_saved');
    next.resources.ledgerEvidence = 3;
    next.resources.harborTension = clamp(next.resources.harborTension + 1, 0, 5);
    return result(next, 'costly_success', '玩家保全总账、证人记忆与港口运行记录。', '紧急转存引发短时停摆。', adventure.clues.master_ledger);
  }
  if (ledgerAndWitness) {
    next.inventory = addUnique(next.inventory, 'master_ledger');
    next.clues = addUnique(next.clues, 'master_ledger');
    next.testimonies = addUnique(next.testimonies, 'harbor_worker');
    next.flags = addUnique(next.flags, 'vault_witnesses_saved');
    next.resources.ledgerEvidence = 3;
    next.resources.harborTension = clamp(next.resources.harborTension + 1, 0, 5);
    return result(next, 'costly_success', '总账和证人记忆被转移到安全浮仓。', '部分运行记录沉入水中。', adventure.clues.master_ledger);
  }
  if (ledgerAndOperation) {
    next.inventory = addUnique(next.inventory, 'master_ledger');
    next.clues = addUnique(next.clues, 'master_ledger');
    next.flags = addUnique(next.flags, 'vault_operations_saved');
    next.resources.ledgerEvidence = 3;
    next.resources.publicSupport = clamp(next.resources.publicSupport - 1, -3, 4);
    return result(next, 'costly_success', '总账与港口运行记录被完整保全。', '来不及转存的证人记忆消散。', adventure.clues.master_ledger);
  }
  if (intent.type === 'inspect') return result(next, 'progress', '水位上涨前通常只能优先保全总账与证人，或总账与运行记录；自然替代封印或两簇余烬可以保全全部。');
  if (intent.type === 'move') {
    if (!next.inventory.includes('master_ledger')) return result(next, 'blocked', '没有中央征忆总账，万钟码头的最终裁决缺少可验证基础。');
    return result(moveTo(next, 'docks', 5), 'progress', '玩家携中央征忆总账抵达万钟码头。');
  }
  return result(next, 'blocked', '水位仍在上涨。玩家必须明确选择要保全的记录组合。');
}

function resolveDocks(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  const next = baseNext(state);
  if (has(text, /改革|公开|归还|废除强征/)) {
    if (next.resources.ledgerEvidence < 2 || next.resources.publicSupport < 1) return result(next, 'blocked', '改革需要充分账证与至少一层公众支持。');
    return completeHarbor(next, 'reformed', ['中央总账被公开，强制征忆停止。', '港口建立可撤回、可追责的记忆归还制度。']);
  }
  if (has(text, /自治|潮工管理|工会接管/)) {
    if (next.resources.unionTrust < 1) return result(next, 'blocked', '港口自治需要潮工的真实授权。');
    return completeHarbor(next, 'autonomous', ['潮工委员会接管港口记忆流通。', '中央配额被地方共同决策取代。']);
  }
  if (has(text, /监管|维持秩序|保留制度|加强审计/)) {
    if (next.resources.harborAuthority < 0) return result(next, 'blocked', '港务权威已经不足以执行受监管的旧制度。');
    return completeHarbor(next, 'regulated', ['征忆制度被保留，但总账、配额和申诉渠道受到公开监管。']);
  }
  if (has(text, /摧毁|炸毁|焚毁|沉没港口/)) return completeHarbor(next, 'destroyed', ['征忆设施与万钟码头一同被摧毁。', '强征立即停止，港区也失去维持生活的记忆物流。']);
  return result(next, 'blocked', '玩家需要明确选择监管、改革、自治或摧毁港口制度。');
}

function resolveBorder(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /别名|借名|临时名字|接受名字/)) {
    next.resources.forestRecognition = clamp(next.resources.forestRecognition + 1, -3, 4);
    next.flags = addUnique(next.flags, 'borrowed_name');
    return result(moveTo(next, 'ember_garden', 1), 'progress', '玩家接受林海授予的临时别名，边界承认其来访身份。');
  }
  if (has(text, /行为|足迹|经历|不靠名字|证明自己/)) {
    next.flags = addUnique(next.flags, 'behavioral_identity');
    return result(moveTo(next, 'ember_garden', 1), 'progress', '玩家以携带的选择、证词与后果证明身份。');
  }
  if (has(text, /刻下|强行命名|真名刻|烧出名字/)) {
    next.resources.forestRecognition = clamp(next.resources.forestRecognition - 1, -3, 4);
    next.resources.rootPollution = clamp(next.resources.rootPollution + 1, 0, 5);
    next.flags = addUnique(next.flags, 'forced_name');
    return result(moveTo(next, 'ember_garden', 1), 'costly_success', '玩家强行在树皮上固定名字。', '边界放行，但根系将这次行为记为污染。');
  }
  return result(next, 'blocked', '遗名边界不接受单纯宣称。玩家要借用别名、以行为证明，或承担强行命名的代价。');
}

function resolveGarden(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /清理|等待|照料|自然孢子|共生/)) {
    next.resources.ember = clamp(next.resources.ember + 2, 0, next.resources.emberMax);
    next.resources.forestRecognition = clamp(next.resources.forestRecognition + 1, -3, 4);
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'witness_mark');
    return result(next, 'progress', adventure.clues.witness_mark, '菌庭在不被催逼的情况下补充两簇余烬。');
  }
  if (has(text, /灯火引导|余烬引导|转化灯/)) {
    next.resources.ember = next.resources.emberMax;
    next.flags = addUnique(next.flags, 'lantern_transformed');
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'witness_mark');
    return result(next, 'costly_success', '菌丝把余烬灯改造成可呼吸的林海灯种。', '灯火充满，但原有封印结构被永久改变。');
  }
  if (has(text, /强行采集|割取|掠夺孢子|焚烧菌庭/)) {
    next.resources.ember = next.resources.emberMax;
    next.resources.forestRecognition = clamp(next.resources.forestRecognition - 1, -3, 4);
    next.resources.cycleBalance = clamp(next.resources.cycleBalance - 1, -4, 4);
    next.resources.rootPollution = clamp(next.resources.rootPollution + 1, 0, 5);
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'witness_mark');
    return result(next, 'costly_success', '玩家取得足量孢火。', '菌庭的生长循环被破坏，林海承认度下降。');
  }
  if (has(text, /前往|进入|离开|兽径/)) {
    if (next.resources.ringMarks < 1) return result(next, 'blocked', '没有“见证”年轮印，兽径不会保持稳定。');
    return result(moveTo(next, 'beast_path', 2), 'progress', '见证印在雾中照出忘川兽径。');
  }
  return result(next, 'flavor', '菌庭回应耐心、引导或采集方式，但不会自行替玩家选择。');
}

function resolveBeastPath(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /环境|脚印|气味|绕行|生态/)) {
    next.resources.cycleBalance = clamp(next.resources.cycleBalance + 1, -4, 4);
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'return_mark');
    return result(next, 'progress', adventure.clues.return_mark, '玩家没有惊动忘川兽群，归还印随足迹显现。');
  }
  if (has(text, /灯火|孢火|引开|照路/)) {
    if (next.resources.ember < 1) return result(next, 'blocked', '余烬不足以引开兽群。');
    next.resources.ember -= 1;
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'return_mark');
    return result(next, 'costly_success', '一簇灯火引开兽群。', adventure.clues.return_mark);
  }
  if (has(text, /交还记忆|放下一段|献出回声|归还证词/)) {
    if (next.testimonies.length < 1) return result(next, 'blocked', '玩家没有可被主动放下的见证记忆。');
    next.resources.echoCorruption = clamp(next.resources.echoCorruption - 1, 0, 3);
    next.resources.ringMarks = clamp(next.resources.ringMarks + 1, 0, 4);
    next.clues = addUnique(next.clues, 'return_mark');
    return result(next, 'costly_success', '玩家主动放下一段已见证的回声，兽径归还通行空间。', adventure.clues.return_mark);
  }
  if (has(text, /前往|进入|圣所|离开/)) {
    if (next.resources.ringMarks < 2) return result(next, 'blocked', '年轮圣所需要“见证”和“归还”两道印记。');
    return result(moveTo(next, 'ring_sanctuary', 3), 'progress', '两道年轮印重合，圣所入口从树影中浮现。');
  }
  return result(next, 'flavor', '兽群对环境判断、灯火引导和主动归还作出不同回应。');
}

function resolveSanctuary(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /组合|见证.*归还|归还.*见证|解读年轮|留白/)) {
    next.resources.ringMarks = 3;
    next.clues = addUnique(next.clues, 'space_mark');
    next.clues = addUnique(next.clues, 'natural_seal');
    next.inventory = addUnique(next.inventory, 'ring_mark');
    return result(next, 'progress', adventure.clues.space_mark, adventure.clues.natural_seal);
  }
  if (has(text, /港口证词|回流身份|潮工证词/) && state.completedMaps.includes('harbor')) {
    next.resources.ringMarks = 3;
    next.clues = addUnique(next.clues, 'space_mark');
    next.clues = addUnique(next.clues, 'natural_seal');
    next.inventory = addUnique(next.inventory, 'ring_mark');
    return result(next, 'progress', '港口证词证明关系可以延续，而完整记忆不必被永久占有。', adventure.clues.natural_seal);
  }
  if (has(text, /复制全部|保存全部|拒绝遗忘/)) {
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.resources.forestRecognition = clamp(next.resources.forestRecognition - 1, -3, 4);
    next.clues = addUnique(next.clues, 'space_mark');
    return result(next, 'costly_success', adventure.clues.space_mark, '玩家复制了年轮记录，却没有理解允许消散的必要性。');
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('space_mark')) return result(next, 'blocked', '圣所尚未显出“留白”印。');
    return result(moveTo(next, 'blackroot_rift', 4), 'progress', '留白印开启通往黑根裂谷的根门。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '圣所要求把见证、归还与留白看成同一循环。');
}

function resolveRift(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /逆转|修复|替代封印|自然循环/)) {
    if (!next.clues.includes('natural_seal')) return result(next, 'blocked', '逆转抽取机需要完整的自然替代封印原理。');
    next.resources.rootPollution = clamp(next.resources.rootPollution - 2, 0, 5);
    next.resources.cycleBalance = clamp(next.resources.cycleBalance + 1, -4, 4);
    next.flags = addUnique(next.flags, 'rift_repaired');
    next.clues = addUnique(next.clues, 'court_coordinates');
    return result(next, 'progress', '黑根抽取机被改造成向林海返还残余记忆的装置。', adventure.clues.court_coordinates);
  }
  if (has(text, /切断|关闭|破坏机器|拔除管线/)) {
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.resources.cycleBalance = clamp(next.resources.cycleBalance - 1, -4, 4);
    next.flags = addUnique(next.flags, 'rift_cut');
    next.clues = addUnique(next.clues, 'court_coordinates');
    return result(next, 'costly_success', '抽取管线被切断。', '积存回声反冲，部分根系坏死。', adventure.clues.court_coordinates);
  }
  if (has(text, /收割|抽取根火|占有黑根|带走力量/)) {
    next.resources.emberMax += 2;
    next.resources.ember = next.resources.emberMax;
    next.resources.forestRecognition = clamp(next.resources.forestRecognition - 2, -3, 4);
    next.resources.rootPollution = clamp(next.resources.rootPollution + 1, 0, 5);
    next.flags = addUnique(next.flags, 'rootfire_harvested');
    next.clues = addUnique(next.clues, 'court_coordinates');
    return result(next, 'costly_success', '玩家抽取黑根火，余烬容量永久增加。', '林海将玩家认定为新的采集者。', adventure.clues.court_coordinates);
  }
  if (has(text, /港口支援|潮工设备|总账坐标/) && state.completedMaps.includes('harbor')) {
    next.resources.forestRecognition = clamp(next.resources.forestRecognition + 1, -3, 4);
    next.flags = addUnique(next.flags, 'rift_repaired');
    next.clues = addUnique(next.clues, 'court_coordinates');
    return result(next, 'progress', '港口设备将抽取方向反转，黑根开始缓慢复苏。', adventure.clues.court_coordinates);
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('court_coordinates')) return result(next, 'blocked', '玩家尚未从抽取机中取得王庭坐标。');
    return result(moveTo(next, 'mother_tree', 5), 'progress', '根路坐标与母树心室重合。');
  }
  return result(next, 'blocked', '玩家需要明确修复、切断或收割黑根抽取机。');
}

function resolveMotherTree(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  const next = baseNext(state);
  if (has(text, /恢复循环|归还林海|修复母树/)) {
    if (!next.clues.includes('natural_seal') || next.resources.cycleBalance < 0) return result(next, 'blocked', '恢复循环需要自然替代封印，且此前不能让循环严重失衡。');
    next.testimonies = addUnique(next.testimonies, 'forest_cycle');
    return completeForest(next, 'restored', ['母树恢复自然遗忘与返还的循环。', adventure.testimonies.forest_cycle]);
  }
  if (has(text, /订立契约|港林契约|共同守护|允许采集/)) {
    if (next.resources.forestRecognition < 1 || (!state.completedMaps.includes('harbor') && next.resources.publicSupport < 1)) return result(next, 'blocked', '契约需要林海承认，并由港口共同体或足够公众支持见证。');
    next.testimonies = addUnique(next.testimonies, 'forest_cycle');
    return completeForest(next, 'covenant', ['林海与人类聚落订立可撤回、有限度的共生契约。', adventure.testimonies.forest_cycle]);
  }
  if (has(text, /封闭|拒绝采集|隔绝林海|永久关闭/)) return completeForest(next, 'sealed', ['母树封闭所有外来根路。', '林海获得安全，也暂时切断了与其他地区的互助。']);
  if (has(text, /收割|掌控母树|利用根火/)) {
    if (!next.flags.includes('rootfire_harvested')) return result(next, 'blocked', '只有已在裂谷抽取根火，才能把母树改造成采集核心。');
    return completeForest(next, 'harvested', ['母树被改造成可控的根火供应核心。', '自然遗忘循环由新的采集秩序取代。']);
  }
  return result(next, 'blocked', '玩家需要明确选择恢复、契约、封闭或收割林海。');
}

function cooperativeOutcomes(state: GameState): number {
  let score = 0;
  if (state.towerOutcome === 'reconstructed') score += 1;
  if (state.harborOutcome === 'reformed' || state.harborOutcome === 'autonomous') score += 1;
  if (state.forestOutcome === 'restored' || state.forestOutcome === 'covenant') score += 1;
  return score;
}

function resolveEmptyBridge(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /代表团|盟友|共同进入|三地代表|邀请同行/)) {
    const seats = cooperativeOutcomes(next) + (next.resources.archivistTrust >= 1 ? 1 : 0);
    if (seats < 1) return result(next, 'blocked', '此前没有形成愿意共同出席王庭的地区盟友。');
    next.resources.allianceSeats = Math.max(next.resources.allianceSeats, seats);
    next.flags = addUnique(next.flags, 'court_delegation');
    return result(moveTo(next, 'thousand_gates', 1), 'progress', `${seats}席地区代表与玩家共同越过空席渡桥。`);
  }
  if (has(text, /独自|一个人|单独进入/)) {
    next.resources.transitionBurden += 1;
    next.flags = addUnique(next.flags, 'court_alone');
    return result(moveTo(next, 'thousand_gates', 1), 'costly_success', '玩家独自越过渡桥。', '之后的制度转型负担增加。');
  }
  if (has(text, /中央身份|继任者|守忆人权柄|官方授权/)) {
    next.resources.centralAuthority = clamp(next.resources.centralAuthority + 1, 0, 4);
    next.flags = addUnique(next.flags, 'court_authority_entry');
    return result(moveTo(next, 'thousand_gates', 1), 'costly_success', '王庭承认玩家的中央身份。', '入口打开，但玩家也被写入旧权力链条。');
  }
  return result(next, 'blocked', '空席渡桥要求玩家决定以代表团、个人或中央继任者身份进入。');
}

function resolveThousandGates(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  const credentials = 1 + (next.inventory.includes('master_ledger') ? 1 : 0) + (next.inventory.includes('ring_mark') ? 1 : 0);
  if (has(text, /三份凭证|全部凭证|塔印.*总账.*年轮|塔.*港.*林/)) {
    if (credentials < 3) return result(next, 'blocked', '完整开启千门需要灰烬塔结论、中央总账与年轮印三份凭证。');
    next.resources.centralAuthority = Math.max(next.resources.centralAuthority, 2);
    next.flags = addUnique(next.flags, 'three_credentials');
    return result(moveTo(next, 'memory_court', 2), 'progress', '三地凭证同时响应，千门承认玩家拥有跨地区质询权。');
  }
  if (has(text, /修复根路|自然坐标|替代通路/)) {
    if (!next.clues.includes('court_coordinates')) return result(next, 'blocked', '玩家没有自然根路坐标。');
    next.resources.transitionBurden += 1;
    next.flags = addUnique(next.flags, 'root_gate_entry');
    return result(moveTo(next, 'memory_court', 2), 'costly_success', '玩家以林海根路绕过部分中央验证。', '临时通道增加后续维护负担。');
  }
  if (has(text, /强行开启|破门|中央权柄/)) {
    next.resources.courtStability = clamp(next.resources.courtStability - 1, -3, 4);
    next.resources.centralAuthority = clamp(next.resources.centralAuthority + 1, 0, 4);
    next.flags = addUnique(next.flags, 'forced_court_gate');
    return result(moveTo(next, 'memory_court', 2), 'costly_success', '千门被中央权柄强行同步。', '王庭稳定度下降。');
  }
  return result(next, 'blocked', '玩家需要提交三地凭证、修复自然根路，或承担强开千门的代价。');
}

function resolveMemoryCourt(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /公开审理|公开总账|提交证词|追究责任/)) {
    if (next.resources.ledgerEvidence < 2 || next.resources.allianceSeats < 1) return result(next, 'blocked', '公开审理需要充分账证和至少一席地区代表。');
    next.resources.publicEvidence = 3;
    next.flags = addUnique(next.flags, 'court_liability_proven');
    next.clues = addUnique(next.clues, 'court_liability');
    return result(next, 'progress', adventure.clues.court_liability);
  }
  if (has(text, /内部审查|中央程序|权限调查/)) {
    if (next.resources.centralAuthority < 1) return result(next, 'blocked', '内部审查需要中央权限。');
    next.resources.publicEvidence = Math.max(next.resources.publicEvidence, 2);
    next.flags = addUnique(next.flags, 'court_liability_proven');
    next.clues = addUnique(next.clues, 'court_liability');
    return result(next, 'progress', '内部记录确认王庭长期隐瞒征忆扩张。', adventure.clues.court_liability);
  }
  if (has(text, /广播|向所有人播放|强制公开/)) {
    next.resources.publicEvidence = 3;
    next.resources.courtStability = clamp(next.resources.courtStability - 1, -3, 4);
    next.flags = addUnique(next.flags, 'court_liability_proven');
    next.clues = addUnique(next.clues, 'court_liability');
    return result(next, 'costly_success', '责任记录向全域广播。', '未经缓冲的记忆洪流降低王庭稳定度。', adventure.clues.court_liability);
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('court_liability_proven')) return result(next, 'blocked', '责任尚未被正式确认，中央回响库拒绝开放。');
    return result(moveTo(next, 'echo_repository', 3), 'progress', '九席合唱停止否认，中央回响库开启。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '法庭可以通过公开审理、内部权限或全域广播确认中央责任。');
}

function resolveRepository(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /分布式|分散索引|地区共同保管|全部索引/)) {
    if (next.resources.allianceSeats < 2) return result(next, 'blocked', '分布式索引需要至少两席地区代表共同托管。');
    next.flags = addUnique(addUnique(addUnique(next.flags, 'index_personal'), 'index_stability'), 'index_liability');
    next.resources.publicEvidence = Math.max(next.resources.publicEvidence, 3);
    next.clues = addUnique(next.clues, 'network_index');
    return result(next, 'progress', '个人归还、地区稳定与责任记录被分散交给多地共同托管。', adventure.clues.network_index);
  }
  if (has(text, /个人归还|归还个人记忆|个人索引/)) {
    next.flags = addUnique(next.flags, 'index_personal');
    next.resources.courtStability = clamp(next.resources.courtStability - 1, -3, 4);
    next.clues = addUnique(next.clues, 'network_index');
    return result(next, 'costly_success', '个人归还索引被优先保全。', '王庭短时稳定下降。');
  }
  if (has(text, /地区稳定|运行索引|稳定记录/)) {
    next.flags = addUnique(next.flags, 'index_stability');
    next.resources.publicSupport = clamp(next.resources.publicSupport - 1, -3, 4);
    next.clues = addUnique(next.clues, 'network_index');
    return result(next, 'costly_success', '地区运行索引被优先保全。', '部分个人归还请求继续等待。');
  }
  if (has(text, /责任记录|追责索引|隐瞒记录/)) {
    next.flags = addUnique(next.flags, 'index_liability');
    next.resources.publicEvidence = Math.max(next.resources.publicEvidence, 3);
    next.clues = addUnique(next.clues, 'network_index');
    return result(next, 'progress', '责任链索引被完整保存。', adventure.clues.network_index);
  }
  if (intent.type === 'move') {
    if (!next.clues.includes('network_index')) return result(next, 'blocked', '玩家尚未选择要保全的中央索引。');
    return result(moveTo(next, 'court_fault', 4), 'progress', '被选中的索引照亮王庭断层。');
  }
  return result(next, 'blocked', '玩家需要选择个人归还、地区稳定、责任记录或分布式保全。');
}

function resolveCourtFault(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  let next = baseNext(state);
  if (has(text, /分配|盟友|三地承担|共同修复|代表接管/)) {
    const coverage = Math.min(3, next.resources.allianceSeats + cooperativeOutcomes(next));
    if (coverage < 1) return result(next, 'blocked', '没有足够地区关系来分配断层职责。');
    next.resources.transitionBurden += Math.max(0, 3 - coverage);
    next.flags = addUnique(next.flags, 'faults_resolved');
    next.resources.courtStability = clamp(next.resources.courtStability + (coverage >= 3 ? 1 : 0), -3, 4);
    return result(next, coverage >= 3 ? 'progress' : 'costly_success', `${coverage}处断层由地区代表接管。`, coverage < 3 ? '未被接管的断层转化为制度转型负担。' : '三处断层均获得明确责任人。');
  }
  if (has(text, /亲自承担|由我承受|吸收断层|独自修复/)) {
    next.resources.echoCorruption = clamp(next.resources.echoCorruption + 1, 0, 3);
    next.resources.transitionBurden += 1;
    next.flags = addUnique(next.flags, 'faults_resolved');
    return result(next, 'costly_success', '玩家亲自承受断层中的冲突记忆。', '回声侵蚀和转型负担各增加。');
  }
  if (intent.type === 'move') {
    if (!next.flags.includes('faults_resolved')) return result(next, 'blocked', '断层尚未获得承担者，通往记忆核心的路径无法稳定。');
    return result(moveTo(next, 'memory_core', 5), 'progress', '断层暂时闭合，万忆中枢显现。');
  }
  return result(next, intent.type === 'inspect' ? 'progress' : 'flavor', '断层对应灰烬塔、沉钟港与无名林海未被承担的后果。');
}

function resolveMemoryCore(state: GameState, _intent: ActionIntent, text: string): CampaignResolution {
  const next = baseNext(state);
  if (has(text, /联邦|分布式治理|多地共治|地区自治网络/)) {
    if (cooperativeOutcomes(next) < 2 || next.resources.allianceSeats < 2) return result(next, 'blocked', '联邦化需要至少两个合作型地区结局与两席有效代表。');
    return completeCampaign(next, 'federated', ['中央中枢被拆分为多地互认、可退出的记忆联邦。', '没有单一节点继续垄断记忆的归还与解释权。']);
  }
  if (has(text, /重构|新制度|公开归还|可撤回授权/)) {
    const valid = (next.towerOutcome === 'reconstructed' || next.resources.archivistTrust >= 1)
      && next.resources.ledgerEvidence >= 2 && next.resources.publicEvidence >= 1
      && next.clues.includes('natural_seal') && next.resources.forestRecognition >= 0
      && next.resources.transitionBurden <= 2;
    if (!valid) return result(next, 'blocked', '重构需要责任承担、港口账证、公开证据、自然替代封印、林海承认，并把转型负担控制在两层以内。');
    return completeCampaign(next, 'reconstructed', ['万忆中枢被重构为公开、可撤回、允许自然遗忘的新制度。']);
  }
  if (has(text, /继任|接管王庭|成为核心|中央统治/)) {
    if (next.resources.centralAuthority < 2 && next.towerOutcome !== 'inherited') return result(next, 'blocked', '继任王庭需要足够中央权限或此前已经继任灰烬塔。');
    return completeCampaign(next, 'inherited', ['玩家接管万忆中枢，成为新的中央记忆权威。', '系统继续运行，未来取决于新权威如何使用它。']);
  }
  if (has(text, /维持|保留王庭|稳定系统|修补旧制度/)) {
    if (next.resources.courtStability < 0) return result(next, 'blocked', '王庭稳定度过低，旧系统已无法维持。');
    return completeCampaign(next, 'maintained', ['王庭被修补并继续承担全域记忆调度。', '部分改革被保留，但中央结构没有改变。']);
  }
  if (has(text, /摧毁|关闭中枢|终结王庭|让核心熄灭/)) return completeCampaign(next, 'destroyed', ['万忆中枢被彻底关闭。', '中央强征终结，各地必须自行承担失去统一网络后的代价。']);
  return result(next, 'blocked', '玩家需要明确选择维持、继任、摧毁、重构或联邦化整个记忆网络。');
}

export function resolveCampaignAction(state: GameState, intent: ActionIntent, text: string): CampaignResolution {
  switch (state.sceneId) {
    case 'customs': return resolveCustoms(state, intent, text);
    case 'market': return resolveMarket(state, intent, text);
    case 'tideward': return resolveTideward(state, intent, text);
    case 'council': return resolveCouncil(state, intent, text);
    case 'vault': return resolveVault(state, intent, text);
    case 'docks': return resolveDocks(state, intent, text);
    case 'nameless_border': return resolveBorder(state, intent, text);
    case 'ember_garden': return resolveGarden(state, intent, text);
    case 'beast_path': return resolveBeastPath(state, intent, text);
    case 'ring_sanctuary': return resolveSanctuary(state, intent, text);
    case 'blackroot_rift': return resolveRift(state, intent, text);
    case 'mother_tree': return resolveMotherTree(state, intent, text);
    case 'empty_bridge': return resolveEmptyBridge(state, intent, text);
    case 'thousand_gates': return resolveThousandGates(state, intent, text);
    case 'memory_court': return resolveMemoryCourt(state, intent, text);
    case 'echo_repository': return resolveRepository(state, intent, text);
    case 'court_fault': return resolveCourtFault(state, intent, text);
    case 'memory_core': return resolveMemoryCore(state, intent, text);
    default: return result(baseNext(state), 'blocked', '当前场景没有可用的战役规则。');
  }
}

export function availableNextMaps(state: GameState): MapId[] {
  if (!state.completedMaps.includes('tower')) return [];
  if (!state.completedMaps.includes('harbor') || !state.completedMaps.includes('forest')) {
    return (['harbor', 'forest'] as MapId[]).filter((mapId) => !state.completedMaps.includes(mapId));
  }
  return state.completedMaps.includes('court') ? [] : ['court'];
}

function entryMessage(mapId: MapId): GameMessage {
  const map = adventure.maps[mapId];
  const scene = adventure.scenes[map.scenes[0]];
  return {
    id: crypto.randomUUID(), role: 'narrator', createdAt: Date.now(), narrativeMode: 'background-rich',
    sceneId: map.scenes[0], text: `—— ${map.name} ——\n\n${scene.description}\n\n此前地图留下的关系、证词与代价会继续影响这里。`,
  };
}

export function startCampaignMap(state: GameState, mapId: MapId): GameState {
  if (!state.regionCompleted || state.completed) throw new Error('当前还不能进入下一张地图。');
  if (!availableNextMaps(state).includes(mapId)) throw new Error('这张地图尚未解锁，或已经完成。');
  const firstScene = adventure.maps[mapId].scenes[0];
  return {
    ...state,
    mapId,
    sceneId: firstScene,
    progress: 0,
    regionCompleted: false,
    failed: false,
    failure: undefined,
    checkpoint: undefined,
    messages: [...state.messages, entryMessage(mapId)],
  };
}
