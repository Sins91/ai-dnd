import { generateText, Output, streamText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { adventure } from '../shared/adventure';
import { actionIntentSchema, type ActionIntent, type GameState, type ProviderConfig } from '../shared/contracts';
import { selectNarrativeGuidance, type NarrativeRules } from '../shared/narrative-rules';
import { classifyLocally, selectNarrativeMode, type Resolution } from './game-engine';

function createModel(settings: ProviderConfig, apiKey: string): LanguageModel {
  if (!settings.modelId) throw new Error('请先在设置中填写模型 ID。');
  if (settings.provider === 'openai') {
    const provider = createOpenAI({ apiKey, ...(settings.baseURL ? { baseURL: settings.baseURL } : {}) });
    return provider(settings.modelId);
  }
  if (!settings.baseURL) throw new Error('兼容接口需要填写 API 地址。');
  const provider = createOpenAICompatible({
    name: settings.provider === 'local' ? 'local-model' : settings.provider === 'deepseek' ? 'deepseek' : 'custom-provider',
    apiKey: settings.provider === 'local' ? apiKey || 'local' : apiKey,
    baseURL: settings.baseURL,
    includeUsage: true,
  });
  return provider(settings.modelId);
}

function getProviderOptions(settings: ProviderConfig) {
  return settings.provider === 'deepseek'
    ? { deepseek: { thinking: { type: 'disabled' as const } } }
    : undefined;
}

export async function testModelConnection(settings: ProviderConfig, apiKey: string): Promise<void> {
  const result = await generateText({
    model: createModel(settings, apiKey),
    prompt: '只回复 OK',
    maxOutputTokens: 32,
    providerOptions: getProviderOptions(settings),
    abortSignal: AbortSignal.timeout(15_000),
  });
  if (!result.text.trim()) throw new Error('模型返回了空响应。');
}

export async function classifyWithAi(
  text: string, state: GameState, settings: ProviderConfig, apiKey: string,
): Promise<ActionIntent> {
  try {
    const { output } = await generateText({
      model: createModel(settings, apiKey),
      output: Output.object({ schema: actionIntentSchema }),
      providerOptions: getProviderOptions(settings),
      system: [
        '你是文字冒险的意图解析器。只识别玩家正在做什么，不裁决结果，不创建实体，不推进剧情。',
        '保留玩家明确表达的对象、方法、目的与风险倾向；尤其不要丢失“强行、模仿、承诺、拒绝、带走、留下、重构、释放、继任”等决定性做法。',
        '否定表达必须保留在 approach 中，不能把“我不触摸黑焰”解析成触摸黑焰。',
      ].join('\n'),
      prompt: JSON.stringify({
        scene: adventure.scenes[state.sceneId], inventory: state.inventory, resources: state.resources,
        oath: state.oath, knownClues: state.clues, testimonies: state.testimonies, playerInput: text,
      }),
    });
    return output;
  } catch {
    return classifyLocally(text);
  }
}

export async function* narrateWithAi(
  playerText: string, state: GameState, intent: ActionIntent, resolution: Resolution,
  settings: ProviderConfig, apiKey: string, narrativeRules: NarrativeRules,
): AsyncGenerator<string> {
  let streamError: unknown;
  const guidance = selectNarrativeGuidance(resolution.nextState.sceneId, resolution.nextState.turn, narrativeRules);
  const narrativeMode = selectNarrativeMode(state, resolution);
  const isBackgroundMoment = narrativeMode === 'background-rich';
  const isBriefAction = narrativeMode === 'brief-action';
  const isFailure = narrativeMode === 'failure-restart';
  const isConcise = isBriefAction || isFailure;
  const minCharacters = isBackgroundMoment
    ? narrativeRules.sceneMinCharacters
    : isConcise ? narrativeRules.briefMinCharacters : narrativeRules.minCharacters;
  const maxCharacters = isBackgroundMoment
    ? narrativeRules.sceneMaxCharacters
    : isConcise ? narrativeRules.briefMaxCharacters : narrativeRules.maxCharacters;
  const paragraphInstruction = isBackgroundMoment
    ? '分成 4 至 7 个短段落，每段约 45 至 85 个汉字；每段只承担一个功能，例如结果、空间、感官、历史痕迹或局面变化。段落之间使用一个空行。'
    : isConcise
      ? '只写一个短段落，不要为了排版强行拆段。'
      : '分成 2 至 3 个短段落，每段约 35 至 70 个汉字；分别交代行动结果、关键发现与可观察变化。段落之间使用一个空行。';
  const atmosphereInstruction = narrativeRules.atmosphereLevel === 'subtle'
    ? '氛围描写保持轻微，不遮盖行动结果。'
    : narrativeRules.atmosphereLevel === 'cinematic'
      ? '使用更具镜头感的空间、光影、声音与动作节奏，但保持克制。'
      : '充分运用环境、感官和动作细节营造沉浸感。';

  const result = streamText({
    model: createModel(settings, apiKey),
    providerOptions: getProviderOptions(settings),
    system: [
      '你是一名克制、富有氛围感的中文黑暗奇幻叙事者。',
      '事实边界：只有 approvedFacts、immutableFacts、knownClues 是已确认事实。不得改变、遗漏或扩展其剧情含义。',
      '氛围边界：sensoryDetails 与 environmentalResponse 只用于描写过程，不得成为新线索或改变游戏状态。',
      '干扰边界：若提供 interference，先自然呈现 appearance，再通过后续观察或谨慎措辞保留 mundaneTruth 的合理解释；绝不能把表象写成已确认事实。',
      '禁止创造新地点、通道、NPC、物品、关键线索、伤害、奖励、能力或剧情进展。',
      '禁止替玩家决定思想、台词和下一步行动；禁止解释系统规则；禁止使用列表、标题或元叙事。',
      isBackgroundMoment
        ? '当前是场景切换或结局时刻：先明确行动结果，再重点展开新环境的空间结构、光线、声音、气味、材质和历史痕迹；背景信息必须来自 scene、immutableFacts 与提供的氛围素材。'
        : isFailure
          ? '当前行动已被游戏引擎判定为必然死亡：只用一句短句直接说明致命后果与死亡，不复述玩家输入，不添加过程铺陈、感官细节、比喻、悬念或背景。不得让玩家幸存；不要提及游戏失败、系统、弹窗、确认、流程点、检查点、重新开始或状态回退。'
        : isBriefAction
          ? '当前是普通操作：只用一至两句短句，简要说明玩家做了什么以及产生了什么结果。不要添加氛围铺陈、背景信息、干扰信息、悬念、比喻或无关细节，不要复述玩家输入。'
          : '当前是重要行动：先清楚交代行动与关键结果，再用少量必要细节呈现新线索或真实进展；不要复述完整场景背景。',
      `使用第二人称，输出 ${minCharacters} 至 ${maxCharacters} 个汉字。`,
      paragraphInstruction,
      '硬性分段规则：凡是交代新线索、新事实、资源或状态变化、代价、成败结果、路线开启、场景切换、人物立场变化或结局推进的内容，都必须从新段落开始；上一段末尾不得顺带交代这些内容。段落之间使用一个空行。',
      isConcise ? '' : atmosphereInstruction,
      !isConcise && narrativeRules.stylePrompt ? `附加文风要求：${narrativeRules.stylePrompt}` : '',
    ].filter(Boolean).join('\n'),
    prompt: JSON.stringify({
      scene: adventure.scenes[resolution.nextState.sceneId],
      playerText,
      intent,
      outcome: resolution.outcome,
      approvedFacts: isFailure ? resolution.approvedFacts.slice(0, 1) : resolution.approvedFacts,
      immutableFacts: adventure.scenes[resolution.nextState.sceneId].immutableFacts,
      knownClues: resolution.nextState.clues.map((id) => adventure.clues[id as keyof typeof adventure.clues]),
      knownTestimonies: resolution.nextState.testimonies.map((id) => adventure.testimonies[id as keyof typeof adventure.testimonies]),
      gameState: {
        mapId: resolution.nextState.mapId,
        completedMaps: resolution.nextState.completedMaps,
        resources: resolution.nextState.resources,
        oath: resolution.nextState.oath,
        brokenOath: resolution.nextState.brokenOath,
        echoDisposition: resolution.nextState.echoDisposition,
        towerOutcome: resolution.nextState.towerOutcome,
        harborOutcome: resolution.nextState.harborOutcome,
        forestOutcome: resolution.nextState.forestOutcome,
        campaignOutcome: resolution.nextState.campaignOutcome,
      },
      sensoryDetails: isConcise ? [] : guidance.sensoryDetails,
      environmentalResponse: isConcise ? null : guidance.environmentalResponse,
      interference: isConcise ? null : guidance.interference,
      narrativeMode,
      previousNarration: state.messages.slice(-narrativeRules.recentMessageCount),
      repetitionRule: '避免重复最近叙事中的比喻、句式、气味、颜色和“仿佛被注视”等常见表达。',
    }),
    onError({ error }) { streamError = error; },
  });
  for await (const textPart of result.textStream) yield textPart;
  if (streamError) throw streamError;
}

const IMPORTANT_NARRATIVE_SENTENCE = /(?:发现|确认|证明|揭示|得知|获得|取得|取回|失去|消耗|增加|减少|下降|上升|恢复|改变|完成|失败|成功|受阻|代价|开启|打开|显现|闭合|进入|抵达|离开|前往|通往|路线|通路|入口|出口|线索|证词|誓言|信任|警觉|侵蚀|灯火|封印|结局|继任|重构|释放|维持)/;

function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^。！？；]+[。！？；]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
}

/**
 * Applies a deterministic final-pass layout rule after streaming. The model still
 * controls the prose, while consequential information cannot remain buried at
 * the end of an atmosphere paragraph in the stored or final rendered message.
 */
export function formatNarrationParagraphs(text: string, resolution: Resolution): string {
  const sourceParagraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (sourceParagraphs.length === 0) return '';

  const advancesPlot = ['progress', 'costly_success', 'failed_forward', 'complete'].includes(resolution.outcome);
  const output: string[] = [];
  let sentenceIndex = 0;

  for (const sourceParagraph of sourceParagraphs) {
    let buffer = '';
    const flush = () => {
      if (buffer) output.push(buffer);
      buffer = '';
    };

    for (const sentence of splitSentences(sourceParagraph)) {
      const isConsequential = (advancesPlot && sentenceIndex === 0)
        || IMPORTANT_NARRATIVE_SENTENCE.test(sentence);
      sentenceIndex += 1;

      if (isConsequential) {
        flush();
        output.push(sentence);
        continue;
      }

      if (buffer && `${buffer}${sentence}`.length > 72) flush();
      buffer += sentence;
    }
    flush();
  }

  return output.join('\n\n');
}

export function fallbackNarration(resolution: Resolution): string {
  if (resolution.outcome === 'failed') return resolution.approvedFacts[0] ?? '死亡在顷刻间终结了这次行动。';
  const prefix = resolution.outcome === 'blocked'
    ? '你的尝试没能改变眼前的局面。'
    : resolution.outcome === 'costly_success'
      ? '目标达成了，但代价也已经发生。'
      : resolution.outcome === 'failed_forward'
        ? '行动没有按预期成功，却暴露了新的前进方向。'
    : resolution.outcome === 'complete'
      ? '最后一道回声随之消散。'
      : '周围的细节回应了你的行动。';
  return [prefix, ...resolution.approvedFacts].filter(Boolean).join('\n\n');
}
