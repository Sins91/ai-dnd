import type { MapId } from '../../shared/adventure';
import type { GameState } from '../../shared/contracts';

export type AutoplayDecision =
  | { type: 'action'; text: string }
  | { type: 'map'; mapId: MapId }
  | { type: 'restart-checkpoint' }
  | { type: 'done' };

function action(text: string): AutoplayDecision {
  return { type: 'action', text };
}

function chooseNextMap(state: GameState): MapId | null {
  if (!state.completedMaps.includes('forest')) return 'forest';
  if (!state.completedMaps.includes('harbor')) return 'harbor';
  if (!state.completedMaps.includes('court')) return 'court';
  return null;
}

function towerDecision(state: GameState): AutoplayDecision {
  switch (state.sceneId) {
    case 'gate':
      return state.clues.includes('door_sigils')
        ? action('我按照风、星、灰的顺序点亮符文，然后穿过开启的石门。')
        : action('我举起余烬灯，仔细检查黑石门上的符文和被雨水遮住的刻痕。');
    case 'hall':
      return state.clues.includes('star_map') || state.clues.includes('archivist_warning')
        ? action('我沿着星图确认的北侧路线，前往沉星档案井。')
        : action('我诚实说明门外发生的事，并询问守忆人黑焰、封印与档案井的路线。');
    case 'archive':
      return state.flags.includes('archive_route') && state.testimonies.length > 0
        ? action('我带着取得的记忆证词，根据星图前往上层的裂钟回廊。')
        : action('我修复档案井的配重升降机构，取回一份真实记忆证词并确认上层路线。');
    case 'corridor':
      if (!state.flags.includes('corridor_route')) return action('我观察影子、北侧方向和已知事实，排除裂钟制造的虚假道路。');
      if (state.echoDisposition === 'undecided') return action('我不占有受困回声，把它留下，然后记住真实路线。');
      return action('我沿已经确认的道路进入灰烬阶梯。');
    case 'stairs':
      return action('我根据取得的记忆证词和墙面残影，沿建塔者留下的旧路前往塔顶。');
    case 'summit':
      return state.testimonies.length >= 2 || state.clues.includes('seal_principle')
        ? action('我明确选择释放被囚记忆，切断记忆供给并打碎旧封印。')
        : action('我用余烬灯检查黑焰与封印结构，查明它受到的约束和运行原理。');
    default:
      return action('我谨慎调查当前场景中尚未确认的异常、出口和可验证线索。');
  }
}

function forestDecision(state: GameState): AutoplayDecision {
  switch (state.sceneId) {
    case 'nameless_border':
      return action('我接受林海授予的临时别名，并以这个借来的名字请求通行。');
    case 'ember_garden':
      return state.clues.includes('witness_mark')
        ? action('我带着见证年轮印离开菌庭，前往忘川兽径。')
        : action('我清理采集架并耐心照料菌庭，等待余烬自然成熟，不触碰连接具体记忆的菌核。');
    case 'beast_path':
      return state.clues.includes('return_mark')
        ? action('我让见证与归还两道年轮印重合，前往年轮圣所。')
        : action('我观察兽群的脚印、气味和迁徙方向，绕开猎影，让记忆种子安全归土。');
    case 'ring_sanctuary':
      return state.clues.includes('space_mark')
        ? action('我穿过已经开启的根门，进入黑根裂谷。')
        : action('我组合见证与归还两道年轮印，解读年轮中的留白和自然遗忘循环。');
    case 'blackroot_rift':
      return state.clues.includes('court_coordinates')
        ? action('我沿抽取机保存的王庭根路坐标，前往无名母树。')
        : state.clues.includes('natural_seal')
          ? action('我使用见证、归还与留白的自然封印原理，逆转黑根抽取机并修复根系。')
          : action('我检查黑根抽取机的管线、污染方向和保存的根路坐标。');
    case 'mother_tree':
      if (state.clues.includes('natural_seal') && state.resources.cycleBalance >= 0) return action('我选择恢复自然循环，把记忆归还林海并修复母树。');
      if (state.resources.forestRecognition >= 1 && (state.completedMaps.includes('harbor') || state.resources.publicSupport >= 1)) return action('我请求与林海订立可撤回的共生契约，共同见证并负责归还。');
      return action('我拒绝继续采集，请母树封闭外来根路，保护林海免受进一步伤害。');
    default:
      return action('我谨慎观察林海的自然循环，并寻找不会强迫记忆停留的前进方法。');
  }
}

function harborDecision(state: GameState): AutoplayDecision {
  switch (state.sceneId) {
    case 'customs':
      return action('我出示灰烬塔征忆船册，要求验忆所依法登记身份并允许入港。');
    case 'market':
      return state.clues.includes('harbor_stamp')
        ? action('我离开集市，进入潮痕街区。')
        : action('我调查市场票据、摊位编号和采购印记，追查它们与灰烬塔船册的联系。');
    case 'tideward':
      return state.flags.includes('tideward_resolved')
        ? action('我带着街区的处理结果和证词，前往沉钟议事厅。')
        : action('我用旧物、生活习惯、邻里证词和多方记录交叉核验回流身份。');
    case 'council':
      return state.flags.includes('vault_access')
        ? action('我进入海底中央征忆库。')
        : action('我公开市场票据、饥荒契约和受害者证词，质询议事厅并要求签发征忆库核查令。');
    case 'vault':
      return state.inventory.includes('master_ledger')
        ? action('我携带中央征忆总账离开水下库区，前往万钟码头公开裁决。')
        : state.clues.includes('natural_seal') || state.resources.ember >= 2
          ? action('我使用自然替代封印保全全部资料：中央总账、证人记忆与港口运行记录。')
          : action('我优先保全中央总账和证人记忆，把它们转移到安全浮仓。');
    case 'docks':
      if (state.resources.ledgerEvidence >= 2 && state.resources.publicSupport >= 1) return action('我公开中央总账，停止强制征忆，改革制度并建立可撤回、可追责的记忆归还机制。');
      if (state.resources.unionTrust >= 1) return action('我把记忆流通交给潮工共同体自治管理，终止中央配额。');
      if (state.resources.harborAuthority >= 0) return action('我保留港口运行，但公开监管总账、配额和申诉渠道。');
      return action('我摧毁征忆设施和中央配额网络，承担港口失去旧物流的后果。');
    default:
      return action('我调查当前港区的账册、证词和权力关系，寻找能够公开验证的推进方法。');
  }
}

function courtDecision(state: GameState): AutoplayDecision {
  switch (state.sceneId) {
    case 'empty_bridge': {
      const potentialSeats = Number(state.towerOutcome === 'reconstructed')
        + Number(state.harborOutcome === 'reformed' || state.harborOutcome === 'autonomous')
        + Number(state.forestOutcome === 'restored' || state.forestOutcome === 'covenant')
        + Number(state.resources.archivistTrust >= 1);
      return potentialSeats > 0
        ? action('我邀请已有盟友和三地代表组成代表团，共同越过空席渡桥。')
        : action('我独自越过空席渡桥，并接受之后需要亲自承担转型负担。');
    }
    case 'thousand_gates': {
      const credentials = 1 + (state.inventory.includes('master_ledger') ? 1 : 0) + (state.inventory.includes('ring_mark') ? 1 : 0);
      if (credentials >= 3) return action('我提交灰烬塔印记、中央征忆总账和林海年轮印三份完整凭证，请求跨地区质询权。');
      if (state.clues.includes('court_coordinates')) return action('我使用林海的自然根路坐标修复通道，绕开部分中央验证进入王庭。');
      return action('我使用已有的中央权柄强行开启千门，并承担王庭稳定下降的代价。');
    }
    case 'memory_court':
      if (state.flags.includes('court_liability_proven')) return action('责任已经确认，我进入中央回响库。');
      if (state.resources.ledgerEvidence >= 2 && state.resources.allianceSeats >= 1) return action('我提交中央总账、受害者证词和地区代表授权，要求公开审理并追究中央责任。');
      if (state.resources.centralAuthority >= 1) return action('我启动中央内部审查程序，调取隐瞒记录并确认制度责任。');
      return action('我把总账与责任记录向所有地区广播，让事实无法再被封锁。');
    case 'echo_repository':
      if (state.clues.includes('network_index')) return action('我沿已经保全的索引进入王庭断层，处理三地同时出现的风险。');
      if (state.resources.allianceSeats >= 2) return action('我把个人归还、地区稳定与责任记录三类索引分散给各地区共同保管。');
      return action('我优先保全制度责任记录，确保强征历史和责任链不会再次被抹除。');
    case 'court_fault':
      return state.flags.includes('faults_resolved')
        ? action('三地断层已经获得承担者，我进入万忆中枢执行最终决定。')
        : state.resources.allianceSeats > 0
          ? action('我把黑焰、港口身份索引和林海根脉的修复责任分配给已有盟友与地区代表。')
          : action('我亲自承担断层中的冲突记忆，稳定通往万忆中枢的路径。');
    case 'memory_core': {
      const cooperative = Number(state.towerOutcome === 'reconstructed')
        + Number(state.harborOutcome === 'reformed' || state.harborOutcome === 'autonomous')
        + Number(state.forestOutcome === 'restored' || state.forestOutcome === 'covenant');
      if (cooperative >= 2 && state.resources.allianceSeats >= 2) return action('我建立多地共治、彼此互认且可以退出的记忆联邦。');
      const canReconstruct = (state.towerOutcome === 'reconstructed' || state.resources.archivistTrust >= 1)
        && state.resources.ledgerEvidence >= 2 && state.resources.publicEvidence >= 1
        && state.clues.includes('natural_seal') && state.resources.forestRecognition >= 0
        && state.resources.transitionBurden <= 2;
      if (canReconstruct) return action('我重构万忆中枢，建立公开、可撤回并允许自然遗忘的新制度。');
      if (state.resources.centralAuthority >= 2 || state.towerOutcome === 'inherited') return action('我接管回声王庭，成为新的中央记忆管理者并停止当前强征。');
      if (state.resources.courtStability >= 0) return action('我修补并维持中央网络，优先稳定当前灾害与身份系统。');
      return action('我彻底关闭万忆中枢，终结中央强征，并让各地区承担失去统一网络的代价。');
    }
    default:
      return action('我依据三地取得的真实凭证，调查王庭当前仍未承担的责任和风险。');
  }
}

export function getAutoplayDecision(state: GameState): AutoplayDecision {
  if (state.completed) return { type: 'done' };
  if (state.failed) return { type: 'restart-checkpoint' };
  if (state.regionCompleted) {
    const mapId = chooseNextMap(state);
    return mapId ? { type: 'map', mapId } : { type: 'done' };
  }
  if (state.mapId === 'tower') return towerDecision(state);
  if (state.mapId === 'forest') return forestDecision(state);
  if (state.mapId === 'harbor') return harborDecision(state);
  return courtDecision(state);
}
