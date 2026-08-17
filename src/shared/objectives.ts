import type { GameState } from './contracts';

export function getCurrentObjective(game: GameState): string {
  if (game.completed) return '四地图战役的最终命运已经确定。';
  if (game.regionCompleted) return '当前地图已经完成，请选择下一张已解锁地图。';
  const campaignObjectives: Partial<Record<GameState['sceneId'], string>> = {
    customs: '取得潮关认可，在合法登记、潮工担保或余烬亲历中选择入港方式。',
    market: '追查记忆采购印记，并建立一条通往港口权力核心的证据或关系链。',
    tideward: '处理回流记忆引发的身份冲突，让街区获得可执行的临时结果。',
    council: '用公开证据、潮工联盟或商会关系取得中央征忆库的访问权。',
    vault: '在水位淹没库区前，决定优先保全总账、证人记忆和运行记录。',
    docks: '明确决定沉钟港走向监管、改革、自治或毁灭。',
    nameless_border: '让遗名边界承认你的身份与进入方式。',
    ember_garden: '取得“见证”年轮印，并决定如何补充或转化余烬。',
    beast_path: '在不被忘川兽群吞没身份的前提下取得“归还”年轮印。',
    ring_sanctuary: '解读见证、归还与留白的关系，取得自然替代封印。',
    blackroot_rift: '处理黑根抽取机并取得通往回声王庭的根路坐标。',
    mother_tree: '明确决定无名林海走向恢复、契约、封闭或收割。',
    empty_bridge: '决定以地区代表团、个人或中央继任者身份进入王庭。',
    thousand_gates: '提交跨地区凭证、修复根路或承担强开千门的代价。',
    memory_court: '以可验证方式确认中央长期扩大征忆并隐瞒责任。',
    echo_repository: '决定优先保全哪些中央索引，或将其分散托管。',
    court_fault: '为三地后果找到承担者，稳定通往记忆核心的断层。',
    memory_core: '决定整个记忆网络走向维持、继任、摧毁、重构或联邦化。',
  };
  if (campaignObjectives[game.sceneId]) return campaignObjectives[game.sceneId]!;
  if (game.sceneId === 'gate') {
    return game.clues.includes('door_sigils')
      ? '封印次序已经查明，但黑石门仍未开启。'
      : '黑石门没有可见门缝，封印的运作方式尚不明确。';
  }
  if (game.sceneId === 'hall') {
    return game.clues.includes('archivist_warning') || game.clues.includes('star_map')
      ? '档案井的方位已经明确，长厅中的通路仍待开启。'
      : '通往塔内深处的路线仍被长厅中的秘密遮蔽。';
  }
  if (game.sceneId === 'archive') {
    return game.flags.includes('archive_route')
      ? '证词已经取得，上层路线仍需在星图中完成定位。'
      : '真实证词仍被深井、失衡机构与危险黑水隔开。';
  }
  if (game.sceneId === 'corridor') {
    return game.flags.includes('corridor_route')
      ? '真实阶梯已经显现，受困回声的命运尚未决定。'
      : '钟声制造的道路彼此矛盾，真实阶梯仍被幻象遮蔽。';
  }
  if (game.sceneId === 'stairs') return '崩裂阶梯无法直接通行，已有资源与关系将决定可承担的代价。';
  return game.clues.includes('seal_principle')
    ? '灰烬塔的命运等待一个明确且可承担后果的决定。'
    : '黑焰的约束、处理方向与相应代价尚未查明。';
}

function normalizeObjectiveText(text: string): string {
  return text.toLowerCase().replace(/[\s，。；：、“”‘’！？,.!?:;'"（）()·—-]/g, '');
}

export function isCopiedObjective(game: GameState, playerText: string): boolean {
  const submitted = normalizeObjectiveText(playerText);
  return submitted.length > 0 && submitted === normalizeObjectiveText(getCurrentObjective(game));
}
