export const adventure = {
  title: '灰烬塔的回声',
  mapName: '地图一 · 灰烬塔',
  maps: {
    tower: { name: '地图一 · 灰烬塔', shortName: '灰烬塔', scenes: ['gate', 'hall', 'archive', 'corridor', 'stairs', 'summit'] },
    harbor: { name: '地图二 · 沉钟港', shortName: '沉钟港', scenes: ['customs', 'market', 'tideward', 'council', 'vault', 'docks'] },
    forest: { name: '地图三 · 无名林海', shortName: '无名林海', scenes: ['nameless_border', 'ember_garden', 'beast_path', 'ring_sanctuary', 'blackroot_rift', 'mother_tree'] },
    court: { name: '地图四 · 回声王庭', shortName: '回声王庭', scenes: ['empty_bridge', 'thousand_gates', 'memory_court', 'echo_repository', 'court_fault', 'memory_core'] },
  },
  prologue: [
    '近来，断崖以南的聚落开始遗失一些本不该同时消失的东西。有人忘记陪伴自己多年的歌，有人望着亲手修起的房屋却说不出门该向哪边开；市集账册上也出现成片空白，仿佛墨迹连同书写它的理由一起被取走。每次新的遗忘出现之前，夜里总有人听见北方传来一声极轻的钟响。',
    '随后，一封没有署名的短笺被送到你手中。纸上只有一句警告：“若塔顶最后的回声无人回应，下一次被带走的将不只是名字。”短笺外包着一盏冰冷的铜灯，灯腹保存着四簇暗红余烬。',
    '你循着废弃多年的巡塔道向北。越接近断崖，路旁石碑上的字迹越淡，同行过一段路的鸟鸣也在某个转弯后突然消失。黄昏沉入冷雨时，山道终于在一道黑色石影前断绝。',
  ].join('\n\n'),
  scenes: {
    gate: {
      name: '封印之门',
      description: '断崖尽头立着一扇没有门缝的黑石门，三枚银色符文正在冷雨下缓慢熄灭。',
      immutableFacts: ['门上存在风、星、灰三枚熄灭符文', '唯一道路通向门内', '余烬灯可以照出隐藏刻痕', '门后敲击不是一个真实人物的求救'],
    },
    hall: {
      name: '守忆长厅',
      description: '高厅两侧排列着被磨去姓名的石碑，一名披灰袍的守忆人坐在坍塌星图前。',
      immutableFacts: ['守忆人知道封印的代价但不会无条件说出', '星图指向塔顶', '空白石碑的姓名被人为磨除', '北侧道路先通往沉星档案井'],
    },
    archive: {
      name: '沉星档案井',
      description: '圆形深井沿壁嵌满封存声音的玻璃匣，井底黑水不映灯光，半张星图悬在中央。',
      immutableFacts: ['玻璃匣封存的是真实记忆', '黑水会加深回声侵蚀', '至少一份证词能够指明上层路线', '无法无代价救出全部记忆'],
    },
    corridor: {
      name: '裂钟回廊',
      description: '十二口裂钟悬在狭长回廊，每次钟响，墙面都会显出一条似乎不同的道路。',
      immutableFacts: ['真正阶梯位于北侧', '黑焰幻象无法投下稳定影子', '幻象只能重复已有信息', '塔顶不存在其他出口'],
    },
    stairs: {
      name: '灰烬阶梯',
      description: '通往塔顶的阶梯正在崩裂，墙面残影反复重演封印建立与姓名被抹去的时刻。',
      immutableFacts: ['守忆人参与建立记忆封印', '建塔时黑焰确实威胁周边聚落', '守忆人亲手磨去献忆者姓名', '守忆人不能替玩家决定最终方案'],
    },
    summit: {
      name: '无火之塔',
      description: '塔顶中央悬着冰冷黑焰，它用已经听过的声音低语，余烬灯在其面前沉重得像一颗心。',
      immutableFacts: ['黑焰吞食并重复记忆', '黑焰不能提供玩家尚未获得的真实秘密', '塔顶没有其他出口', '最终处理方式必须由玩家明确选择'],
    },
    customs: {
      name: '潮关验忆所',
      description: '入港铜钟悬在潮关上方，验忆官黎珀要求每位来客证明身份，灰烬塔的征忆船册在灯下泛出盐霜。',
      immutableFacts: ['铜钟只能核验记忆与档案是否一致', '玩家无需交出私人记忆', '灰烬塔船册可以作为入境凭证', '验证失败只会标记身份待定'],
    },
    market: {
      name: '失名集市',
      description: '摊位出售被封装的手艺、告别与童年，失名者依靠刻在手臂上的编号生活。',
      immutableFacts: ['并非所有交易都来自强迫', '行商只能复制剪裁或转移记忆', '复制品不能独立成为最终证据', '灰烬塔采购印记藏在交易票据中'],
    },
    tideward: {
      name: '潮痕街区',
      description: '回流记忆与旧身份在狭窄街巷中冲突，巡逻队正准备以记忆污染为由封锁居民。',
      immutableFacts: ['真实回流记忆不自动赋予财产权', '冲突双方都可能诚实', '封锁不能判定记忆归属', '饥荒契约可证明同意受到生存压力'],
    },
    council: {
      name: '沉钟议事厅',
      description: '港务署、潮工会与记忆行商在半沉议事厅对峙，潮声每次撞钟都会短暂抹去一个词。',
      immutableFacts: ['三个阵营都掌握部分事实并维护自身利益', '海底征忆库保存中央总账', '公开票据无法替代总账原件', '任何阵营都不能无条件代表正义'],
    },
    vault: {
      name: '海底征忆库',
      description: '数千只记忆瓶悬在潮压机关中，库房正在进水，总账、证人记忆与运行档案无法轻易全部保全。',
      immutableFacts: ['总账证明王庭逐年增加征忆指标', '记忆瓶属于具体个人', '常规方法最多保住三类档案中的两类', '余烬灯不能无代价无限扩容'],
    },
    docks: {
      name: '万钟码头',
      description: '中央征忆船即将靠岸，失名者、港务官、潮工与行商等待玩家公开总账并决定港口制度。',
      immutableFacts: ['公开改革需要证据与公众支持', '监管自治和摧毁都具有持续代价', '演说不能替代结局条件', '任何区域结局都不会锁死战役'],
    },
    nameless_border: {
      name: '遗名边界',
      description: '林海外缘的路标正在失去文字，一只尾生细枝的白兽要求来客暂借一个通行称谓。',
      immutableFacts: ['林海不会偷走玩家人格', '暂借称谓不删除身份状态', '玩家可用代号或行为代替名字', '强行刻名会阻碍自然流动'],
    },
    ember_garden: {
      name: '余烬菌庭',
      description: '倒木腹中生长着温暖余烬菌，人类采集架正持续抽走尚未成熟、仍连接具体记忆的菌核。',
      immutableFacts: ['成熟余烬不含人格或秘密', '未成熟菌核连接具体记忆', '灯火不能无限采集', '第一枚年轮印记录见证'],
    },
    beast_path: {
      name: '忘川兽径',
      description: '负载记忆种子的迁徙兽穿越泛白河床，黑根猎影试图在种子归土前将其吞噬。',
      immutableFacts: ['迁徙兽不是人类亡魂', '部分种子会自然消散', '猎影来自人为抽取污染', '归还不等于永久保存'],
    },
    ring_sanctuary: {
      name: '年轮圣所',
      description: '活树年轮保存同一事件在不同生命中的痕迹，完整叙事最终沉淀为关系、习惯与影响。',
      immutableFacts: ['遗忘不会消除事实责任', '黑焰来自只抽取不归还', '自然封印由见证归还留白组成', '自然规律不能代替人的同意'],
    },
    blackroot_rift: {
      name: '黑根裂谷',
      description: '最早的余烬抽取机仍连接母根与回声王庭，黑色树脂正沿逆向年轮扩散。',
      immutableFacts: ['抽取机是人为装置', '直接摧毁会导致污染回流', '机器保存王庭根路坐标', '污染不存在无代价清除'],
    },
    mother_tree: {
      name: '无名母树',
      description: '无数短暂声音共同构成母树意志，它要求玩家说明人类为何需要保存记忆，以及谁负责归还。',
      immutableFacts: ['母树没有单一人格', '华丽说辞不能替代实际状态', '林海可以合作封闭或拒绝', '暂借称谓必须有归还机会'],
    },
    empty_bridge: {
      name: '空席渡桥',
      description: '回声王庭悬在记忆暗海之上，桥侧空椅记录着真正愿意同行的代表与永远缺席的席位。',
      immutableFacts: ['缺席盟友不会临时出现', '证词不能完全替代承担责任的代表', '王庭早已因过度抽取而失稳', '玩家只能携带已有成果'],
    },
    thousand_gates: {
      name: '千门前庭',
      description: '上千扇无墙之门分别识别塔印、中央总账与年轮印，像一套把身份变成权限的冷酷界面。',
      immutableFacts: ['门只识别真实凭证', '任一种凭证足以推进', '三类凭证齐全才能访问完整重构界面', '错误凭证不会被消耗'],
    },
    memory_court: {
      name: '记忆法庭',
      description: '九个合唱席承认献忆伤害，却坚持中央网络曾控制真实灾害，要求玩家证明伤害、替代与执行能力。',
      immutableFacts: ['总账原件和有效证词不可被篡改', '旧网络确实控制部分灾害', '制度功用不能免除强征责任', '三类改革能力不能彼此替代'],
    },
    echo_repository: {
      name: '中央回响库',
      description: '数代记忆索引在巨大暗库中缓慢脱落，个人归还、地区稳定与责任记录无法无代价全部迁移。',
      immutableFacts: ['网络不能无代价一次迁移', '索引损毁会阻断归还', '保留全部索引会延长中央控制', '优先级必须由玩家明确选择'],
    },
    court_fault: {
      name: '王庭断层',
      description: '黑焰压力、港口身份索引与林海根脉同时断裂，理念必须在此转化为具体的负担分配。',
      immutableFacts: ['三道断层都是真实风险', '一名盟友不能完整承担两处', '不足会形成过渡负担而非自动死亡', '玩家牺牲必须明确选择'],
    },
    memory_core: {
      name: '万忆中枢',
      description: '中枢不是王座，而是改变记忆流向的结构化操作；旧秩序提出稳定承诺，所有替代方案都要求承担后果。',
      immutableFacts: ['最终方案只由已取得成果开放', '重构需要实践社会授权和自然规律', '摧毁存在真实过渡风险', '最终选择必须由玩家明确作出'],
    },
  },
  items: {
    ember_lantern: {
      name: '余烬灯',
      description: '能够照见封印、牵引记忆并约束黑焰的铜灯；灯火有限，每次强行使用都会留下代价。',
    },
    master_ledger: { name: '中央征忆总账', description: '记录捐献、抵债、强征与无法追溯来源记忆的原始账册。' },
    ring_mark: { name: '年轮印', description: '由见证、归还与留白构成的自然根路凭证。' },
  },
  clues: {
    door_sigils: '门上三枚符文应按“风、星、灰”的次序点亮。',
    echo_rhythm: '封印会把特定回声误认成塔内信号，但回应会使黑焰更容易模仿来访者。',
    archivist_warning: '守忆人警告：黑焰会模仿来访者已经听过、并渴望再次听见的声音。',
    erased_names: '空白石碑上的姓名是被守忆人亲手磨除的。',
    star_map: '残缺星图指向档案井、裂钟回廊与北侧塔顶阶梯。',
    archive_mechanism: '档案井的配重轮可以修复，黑水则会加深回声侵蚀。',
    memory_fuel: '灰烬塔一直以被征集的真实记忆维持黑焰封印。',
    corridor_truth: '真正阶梯在北侧，幻象没有稳定影子，也不能提供未知事实。',
    archivist_responsibility: '守忆人参与建塔并抹去献忆者姓名；当年的黑焰威胁也确实存在。',
    seal_principle: '黑焰可以被继续封存、释放、继承管理，或在证词、灯火与责任共同成立时重构。',
    harbor_ledger: '灰烬塔的征忆船册指向记忆供应地沉钟港。',
    forest_origin: '余烬灯芯与黑焰残留都来自无名林海的根火。',
    harbor_stamp: '市场票据上的采购印记与灰烬塔征忆船册属于同一套中央配额。',
    famine_contract: '潮痕街区的征忆契约是在饥荒和债务压力下签署的。',
    master_ledger: '中央征忆总账证明回声王庭逐年提高记忆征集指标。',
    witness_mark: '年轮印“见证”：记忆必须先被承认，才能被安全放下。',
    return_mark: '年轮印“归还”：归还影响并不等于永久保存完整叙事。',
    space_mark: '年轮印“留白”：自然循环必须允许一部分记忆停止和消散。',
    natural_seal: '替代封印遵循“见证—归还—留白”，不需要持续献祭个人记忆。',
    court_coordinates: '黑根抽取机保存着通向回声王庭的自然根路坐标。',
    court_liability: '九席合唱的隐瞒记录证明中央明知强征扩大，却优先维持系统自身稳定。',
    network_index: '中央回响库把个人归还、地区稳定与责任记录编织在同一套索引中。',
  },
  testimonies: {
    mason: '建塔石匠留下的证词：封印最初只是临时措施，却被改造成长期征忆制度。',
    donor: '献忆者留下的证词：她在饥荒中以童年记忆换取家人的口粮。',
    trapped_echo: '受困回声证明：部分被献出的记忆仍保有自我叙述，却不等同于仍然活着的人。',
    harbor_worker: '潮工证词：饥荒中的“自愿”契约以失去配给资格作为拒绝代价。',
    returned_identity: '回流者证词：同一段真实记忆可以同时改变多人，却不能单独裁定身份所有权。',
    forest_cycle: '林海见证：被尊重地遗忘会留下关系和影响，而非把一切抹成从未发生。',
  },
} as const;

export type MapId = keyof typeof adventure.maps;
export type SceneId = keyof typeof adventure.scenes;
export type ClueId = keyof typeof adventure.clues;
export type TestimonyId = keyof typeof adventure.testimonies;

export const sceneOrder: readonly SceneId[] = ['gate', 'hall', 'archive', 'corridor', 'stairs', 'summit'];

export function getMapIdForScene(sceneId: SceneId): MapId {
  for (const [mapId, map] of Object.entries(adventure.maps) as [MapId, typeof adventure.maps[MapId]][]) {
    if ((map.scenes as readonly string[]).includes(sceneId)) return mapId;
  }
  return 'tower';
}
