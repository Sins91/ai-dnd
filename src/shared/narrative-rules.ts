import { z } from 'zod';
import type { SceneId } from './adventure';

export const narrativeRulesSchema = z.object({
  version: z.literal(2),
  briefMinCharacters: z.number().int().min(10).max(80).default(20),
  briefMaxCharacters: z.number().int().min(20).max(120).default(60),
  minCharacters: z.number().int().min(60).max(360),
  maxCharacters: z.number().int().min(120).max(500),
  sceneMinCharacters: z.number().int().min(220).max(800),
  sceneMaxCharacters: z.number().int().min(320).max(1200),
  recentMessageCount: z.number().int().min(2).max(16),
  atmosphereLevel: z.enum(['subtle', 'rich', 'cinematic']),
  interferenceFrequency: z.enum(['off', 'occasional', 'frequent']),
  stylePrompt: z.string().trim().max(800),
}).refine((rules) => rules.briefMaxCharacters >= rules.briefMinCharacters + 10, {
  message: '普通操作最多字数必须比最少字数至少多 10。',
  path: ['briefMaxCharacters'],
}).refine((rules) => rules.maxCharacters >= rules.minCharacters + 60, {
  message: '最大字数必须比最小字数至少多 60。',
  path: ['maxCharacters'],
}).refine((rules) => rules.sceneMaxCharacters >= rules.sceneMinCharacters + 80, {
  message: '背景最大字数必须比最小字数至少多 80。',
  path: ['sceneMaxCharacters'],
});

export type NarrativeRules = z.infer<typeof narrativeRulesSchema>;

export const defaultNarrativeRules: NarrativeRules = {
  version: 2,
  briefMinCharacters: 20,
  briefMaxCharacters: 60,
  minCharacters: 120,
  maxCharacters: 220,
  sceneMinCharacters: 340,
  sceneMaxCharacters: 560,
  recentMessageCount: 8,
  atmosphereLevel: 'rich',
  interferenceFrequency: 'occasional',
  stylePrompt: '采用克制、阴郁、富有质感的中文黑暗奇幻笔调；让环境像有记忆一样回应玩家，但避免堆砌形容词。',
};

type NarrativePalette = {
  sensoryDetails: readonly string[];
  environmentalResponses: readonly string[];
  interferences: readonly { appearance: string; mundaneTruth: string }[];
};

export const narrativePalettes: Partial<Record<SceneId, NarrativePalette>> = {
  gate: {
    sensoryDetails: [
      '冷雨敲击黑石，水声在门前被压成低沉而重复的节拍。',
      '余烬灯的铜柄冰冷发涩，掌心却能感到极轻的脉动。',
      '湿苔和旧铁的气味贴着断崖升起，风里带着微弱的灰烬焦味。',
      '银色刻痕只在视线移开时显得明亮，直视时反而近乎熄灭。',
    ],
    environmentalResponses: [
      '你的动作让门缝附近的积水荡开一圈并不存在的波纹。',
      '灯光扫过之处，雨滴短暂偏离了原本的落点。',
      '黑石把声音吞下，只留下比原声更迟的一次回响。',
    ],
    interferences: [
      { appearance: '门后传来像是指节敲击的三声轻响。', mundaneTruth: '节奏随后与岩缝滴水完全重合，不能证明门后有人。' },
      { appearance: '崖壁边缘掠过一道酷似人影的狭长阴影。', mundaneTruth: '云层移动后，阴影显出只是被风拉长的枯枝轮廓。' },
      { appearance: '门侧似乎浮现出一条可供侧身通过的暗缝。', mundaneTruth: '灯火稳定后，那只是雨水沿旧裂纹形成的视觉错觉。' },
    ],
  },
  hall: {
    sensoryDetails: [
      '长厅里的空气干燥得像翻动多年的纸页，呼吸会带起细微尘屑。',
      '空白石碑把脚步声折回不同方向，使距离变得难以判断。',
      '守忆人的灰袍散发着冷炉灰和陈旧药草的气味。',
      '残缺星图表面微凉，刻线边缘积着比周围更深的黑尘。',
    ],
    environmentalResponses: [
      '你靠近时，相邻石碑上的尘埃依次滑落，像有无形手指掠过。',
      '一句话落下后，最远处的回声比你的声音多出了一个音节。',
      '星图上的微光没有移动，但周围阴影悄然改变了朝向。',
    ],
    interferences: [
      { appearance: '一块空白石碑上短暂映出陌生人的侧脸。', mundaneTruth: '角度改变后只剩守忆人与灯影重叠的反光。' },
      { appearance: '北侧传来拖动铁链的声音，仿佛有人正封闭楼梯。', mundaneTruth: '声音与高处石环被风推动的节奏一致，没有新的阻碍出现。' },
      { appearance: '星图边缘有一点光像在指向西墙。', mundaneTruth: '那点光来自余烬灯在碎石上的反射，不构成新的路线。' },
    ],
  },
  archive: {
    sensoryDetails: [
      '玻璃匣沿井壁一层层向下，微弱人声隔着厚玻璃彼此错开。',
      '黑水吞没灯光，只有配重轮上的油脂反出冷白细线。',
      '旧纸、湿石与金属锈蚀的气味从井底缓慢升起。',
      '悬空星图轻轻转动，每次转过缺口都会漏下一点灰蓝微光。',
    ],
    environmentalResponses: [
      '相邻记忆匣依次轻震，却没有泄露尚未取得的内容。',
      '配重链条回应动作发出低响，磨损方向变得更容易辨认。',
      '黑水表面短暂凹陷，随后恢复成不反光的平面。',
    ],
    interferences: [
      { appearance: '井底有人用熟悉声音承诺可以带你直接到塔顶。', mundaneTruth: '声音只重复此前听过的词句，不能提供真实新路线。' },
      { appearance: '一只空玻璃匣里似乎出现仍在呼吸的人影。', mundaneTruth: '灯光稳定后只剩相邻记忆匣的层叠投影。' },
      { appearance: '黑水中映出一条完整阶梯。', mundaneTruth: '黑水本身不反光，这条阶梯是回声侵蚀造成的诱导。' },
    ],
  },
  corridor: {
    sensoryDetails: [
      '十二口裂钟悬在不同高度，铜锈像干涸潮线攀满钟腹。',
      '每次钟摆移动，脚下石缝都会渗出一线冰冷白雾。',
      '回声从错误方向返回，使远近和左右短暂失去意义。',
      '真正的石阶留下稳定尘痕，幻象边缘却没有承接任何重量。',
    ],
    environmentalResponses: [
      '你的声音被十二口钟分开，其中只有一道回声与影子一致。',
      '墙面道路同时偏转，北侧尘痕却没有改变。',
      '钟声停顿的瞬间，所有虚假出口都显得过于明亮。',
    ],
    interferences: [
      { appearance: '一条新路传来守忆人的催促。', mundaneTruth: '催促只由已听过的话拼成，不能证明那条路真实。' },
      { appearance: '西侧门洞投下清晰人影。', mundaneTruth: '影子与任何光源都不一致，属于钟阵制造的假象。' },
      { appearance: '钟声像在说出一项未知秘密。', mundaneTruth: '内容在可理解前不断变化，没有提供可验证事实。' },
    ],
  },
  stairs: {
    sensoryDetails: [
      '阶梯断口缓慢落灰，碎屑在坠下前短暂组成旧日脚印。',
      '墙面残影没有声音，抹去姓名的动作却一次次清晰重现。',
      '越接近塔顶，余烬灯越沉，铜环把掌心勒出细痕。',
      '封印裂隙透出灰白冷光，把守忆人的旧影拉得极长。',
    ],
    environmentalResponses: [
      '脚下残影与现实阶梯短暂重合，暴露一段可通行的旧路。',
      '墙中回声停在某个被磨去的名字之前，不肯继续。',
      '一枚星图节点响应灯火亮起，附近断阶随之稳定。',
    ],
    interferences: [
      { appearance: '残影中的守忆人似乎声称自己从未参与建塔。', mundaneTruth: '影像动作与已取得证词直接冲突，声音来自黑焰篡接。' },
      { appearance: '上方出现一段不需要任何代价的完整阶梯。', mundaneTruth: '阶梯没有承接落灰，不能承重。' },
      { appearance: '被磨去的姓名自行恢复成玩家的称呼。', mundaneTruth: '刻痕深度没有变化，只是灯影短暂拼出的形状。' },
    ],
  },
  summit: {
    sensoryDetails: [
      '塔顶没有风，寒意却从黑焰周围一层层向外扩散。',
      '余烬灯靠近黑焰时变得沉重，铜壁内部传来细砂滚动般的声响。',
      '每次呼吸都会在眼前留下短暂白雾，白雾却朝黑焰反向收拢。',
      '黑焰没有温度和焦味，只有潮湿石窟般的阴冷气息。',
    ],
    environmentalResponses: [
      '你的动作被塔壁重复，却有一道回声故意慢了半拍。',
      '黑焰表面浮起细小凹陷，像在模仿一张尚未成形的面孔。',
      '灯中的余光拉出一条暗红细线，又在触及黑焰前自行断开。',
    ],
    interferences: [
      { appearance: '身后响起熟悉的呼唤，声音准确复述了你记忆中的语气。', mundaneTruth: '塔内没有新增来者，这是黑焰对声音的模仿，不能提供事实。' },
      { appearance: '黑焰旁像是出现了一件你曾渴望得到的物品。', mundaneTruth: '轮廓无法投下影子，只是黑焰诱发的视觉幻象。' },
      { appearance: '塔壁上仿佛打开了一道通往安全之处的门。', mundaneTruth: '已知事实确认塔顶没有其他出口，那只是黑焰制造的诱导。' },
    ],
  },
};

export function selectNarrativeGuidance(sceneId: SceneId, turn: number, rules: NarrativeRules) {
  const palette = narrativePalettes[sceneId] ?? narrativePalettes.hall!;
  const detailCount = rules.atmosphereLevel === 'subtle' ? 1 : rules.atmosphereLevel === 'rich' ? 2 : 3;
  const sensoryDetails = Array.from({ length: detailCount }, (_, offset) => (
    palette.sensoryDetails[(turn + offset) % palette.sensoryDetails.length]
  ));
  const environmentalResponse = palette.environmentalResponses[turn % palette.environmentalResponses.length];
  const includeInterference = rules.interferenceFrequency === 'frequent'
    || (rules.interferenceFrequency === 'occasional' && turn % 2 === 1);
  const interference = includeInterference
    ? palette.interferences[turn % palette.interferences.length]
    : null;
  return { sensoryDetails, environmentalResponse, interference };
}
