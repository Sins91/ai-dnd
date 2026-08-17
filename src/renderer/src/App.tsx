import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, Bot, ChevronDown, ChevronRight, Coins, Eye, Flame, Handshake, House, Pause, Play, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import { adventure, type MapId, type SceneId } from '../../shared/adventure';
import type { BootstrapPayload, ConnectionTestResult, GameMessage, GameState, ProviderConfig } from '../../shared/contracts';
import type { NarrativeRules } from '../../shared/narrative-rules';
import { getCurrentObjective } from '../../shared/objectives';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message as AiMessage, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CursorTooltip } from '@/components/ui/tooltip';
import { getCluesNewestFirst } from './clue-order';
import { getCurrentSceneUnpassedAttemptCount, getLatestSceneProgressMessage } from './narrative-highlights';
import { getAutoplayDecision } from './autoplay-agent';
import appIcon from './assets/app-icon.png';
import ashenTowerCover from './assets/ashen-tower-cover.png';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODELS = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（推荐）' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
] as const;

function normalizeDeepSeekSettings(settings: ProviderConfig): ProviderConfig {
  const modelId = DEEPSEEK_MODELS.some((model) => model.id === settings.modelId)
    ? settings.modelId
    : DEEPSEEK_MODELS[0].id;
  return { provider: 'deepseek', baseURL: DEEPSEEK_BASE_URL, modelId };
}

function getProgressLabel(game: GameState): string {
  if (game.progress >= 6) return `${adventure.maps[game.mapId].shortName}区域结局`;
  const sceneId = adventure.maps[game.mapId].scenes[game.progress] ?? game.sceneId;
  return `抵达${adventure.scenes[sceneId].name}`;
}

function getAvailableMaps(game: GameState): MapId[] {
  if (!game.completedMaps.includes('tower')) return [];
  if (!game.completedMaps.includes('harbor') || !game.completedMaps.includes('forest')) {
    return (['harbor', 'forest'] as MapId[]).filter((mapId) => !game.completedMaps.includes(mapId));
  }
  return game.completedMaps.includes('court') ? [] : ['court'];
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function getBillingLabel(bootstrap: BootstrapPayload | null): string | null {
  if (!bootstrap || bootstrap.settings.provider !== 'deepseek' || !bootstrap.credentialConfigured) return null;
  const billing = bootstrap.game.billing;
  if (!billing) return '余额查询中';
  if (billing.status !== 'available' || !billing.currency || billing.currentBalance === null) return '余额暂不可用';
  return `余额 ${formatMoney(billing.currentBalance, billing.currency)}`;
}

function getGameSpendLabel(bootstrap: BootstrapPayload | null): string | null {
  if (!bootstrap || bootstrap.settings.provider !== 'deepseek' || !bootstrap.credentialConfigured) return null;
  const billing = bootstrap.game.billing;
  if (!billing || billing.status !== 'available' || !billing.currency
    || billing.currentBalance === null || billing.startingBalance === null) return '本游戏已经消耗 --';
  const estimatedCost = Math.max(0, billing.startingBalance - billing.currentBalance);
  return `本游戏已经消耗 ${formatMoney(estimatedCost, billing.currency)}`;
}

function StoryMessage({ message }: { message: GameMessage }) {
  const from = message.role === 'player' ? 'user' : 'assistant';
  return (
    <AiMessage from={from} className="group/message">
      <div className="mb-1 px-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {from === 'user' ? '你' : '叙事者'}
      </div>
      <MessageContent className={from === 'assistant'
        ? 'narrator-message-content border border-border/70 bg-card/80 text-card-foreground shadow-sm'
        : 'bg-primary text-primary-foreground shadow-sm'}>
        <MessageResponse className={from === 'assistant' ? 'story-narration space-y-2' : undefined}>{message.text}</MessageResponse>
      </MessageContent>
    </AiMessage>
  );
}

function NarratorRecallDropdown({ messages, sceneId }: { messages: GameMessage[]; sceneId: SceneId }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const latestNarratorMessage = getLatestSceneProgressMessage(messages, sceneId);
  const unpassedAttemptCount = getCurrentSceneUnpassedAttemptCount(messages, sceneId);
  const previousAttemptsRef = useRef({ sceneId, count: 0 });

  useEffect(() => {
    const previous = previousAttemptsRef.current;
    const enteredNewScene = previous.sceneId !== sceneId;
    if ((enteredNewScene || previous.count < 6) && unpassedAttemptCount >= 6) setOpen(true);
    previousAttemptsRef.current = { sceneId, count: unpassedAttemptCount };
  }, [sceneId, unpassedAttemptCount]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, latestNarratorMessage?.id]);

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 ${open ? 'bottom-0' : ''}`}>
      {open ? (
        <>
          <button
            type="button"
            className="pointer-events-auto absolute inset-0 z-0 cursor-default bg-black/10"
            aria-label="收起最近叙事"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="narrator-recall-dropdown"
            className="narrator-recall-panel game-scrollbar pointer-events-auto absolute inset-x-0 top-0 z-10 max-h-[38vh] overflow-y-auto px-8 pb-2 pt-2 backdrop-blur-xl"
            onClick={() => setOpen(false)}
          >
            {latestNarratorMessage ? (
              <div className="mx-auto w-full max-w-4xl">
                <p className="mb-3 text-[10px] leading-none font-semibold tracking-[0.16em] text-primary uppercase">{adventure.scenes[sceneId].name} · 最近进展</p>
                <div className="space-y-1 font-serif text-sm leading-5 text-foreground/90">
                  {latestNarratorMessage.text.split(/\n{2,}/).map((paragraph, index) => (
                    <p key={`${latestNarratorMessage.id}-${index}`} className="whitespace-pre-line">{paragraph}</p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">当前关卡尚无可回看的推进信息。</p>
            )}
          </div>
        </>
      ) : null}
      <button
          type="button"
          className="group/recall-trigger pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-7 items-start justify-center bg-transparent focus-visible:outline-none"
          aria-label={open ? '收起最近叙事' : '展开最近叙事'}
          aria-expanded={open}
          aria-controls="narrator-recall-dropdown"
          title={open ? '收起最近叙事' : '展开最近叙事'}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="grid size-6 -translate-y-0.5 place-items-center rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm backdrop-blur-md transition-[opacity,color,background-color,transform] duration-150 group-hover/recall-trigger:translate-y-0 group-hover/recall-trigger:opacity-100 group-hover/recall-trigger:bg-accent/90 group-hover/recall-trigger:text-primary group-focus-visible/recall-trigger:translate-y-0 group-focus-visible/recall-trigger:opacity-100 group-focus-visible/recall-trigger:ring-2 group-focus-visible/recall-trigger:ring-ring">
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
      </button>
    </div>
  );
}

function getLastNarratorText(game: GameState): string {
  for (let index = game.messages.length - 1; index >= 0; index -= 1) {
    if (game.messages[index].role === 'narrator') return game.messages[index].text;
  }
  return '';
}

function getOutcomeTitle(game: GameState): string {
  if (game.campaignOutcome === 'federated') return '记忆归于众地';
  if (game.campaignOutcome === 'reconstructed') return '万忆中枢获得新生';
  if (game.campaignOutcome === 'destroyed') return '中央回响永久熄灭';
  if (game.campaignOutcome === 'inherited') return '新的中央守忆人';
  if (game.campaignOutcome === 'maintained') return '王庭继续运转';
  if (game.mapId === 'harbor' && game.harborOutcome === 'reformed') return '沉钟港公开旧账';
  if (game.mapId === 'harbor' && game.harborOutcome === 'autonomous') return '万钟归于潮工';
  if (game.mapId === 'harbor' && game.harborOutcome === 'destroyed') return '征忆港沉入潮下';
  if (game.mapId === 'harbor' && game.harborOutcome === 'regulated') return '港口接受公开监管';
  if (game.mapId === 'forest' && game.forestOutcome === 'restored') return '林海重获自然循环';
  if (game.mapId === 'forest' && game.forestOutcome === 'covenant') return '人类与林海订立新约';
  if (game.mapId === 'forest' && game.forestOutcome === 'harvested') return '根火落入人手';
  if (game.mapId === 'forest' && game.forestOutcome === 'sealed') return '无名林海封闭根路';
  if (game.towerOutcome === 'released') return '被囚记忆重返世界';
  if (game.towerOutcome === 'inherited') return '新的守忆人留在塔中';
  if (game.towerOutcome === 'reconstructed') return '旧封印在真相中熄灭';
  return '灰烬塔恢复了寂静';
}

function getOutcomeLabel(game: GameState): string {
  if (game.campaignOutcome) return ({ maintained: '维持中央网络', inherited: '继任王庭', destroyed: '摧毁中枢', reconstructed: '重构记忆制度', federated: '建立记忆联邦' })[game.campaignOutcome];
  if (game.mapId === 'harbor' && game.harborOutcome) return ({ regulated: '公开监管', reformed: '制度改革', autonomous: '潮工自治', destroyed: '摧毁港口' })[game.harborOutcome];
  if (game.mapId === 'forest' && game.forestOutcome) return ({ restored: '恢复循环', covenant: '共生契约', sealed: '封闭林海', harvested: '收割根火' })[game.forestOutcome];
  if (game.towerOutcome === 'released') return '释放被囚记忆';
  if (game.towerOutcome === 'inherited') return '继任守忆人';
  if (game.towerOutcome === 'reconstructed') return '重构局部封印';
  return '维持旧封印';
}

function getRegionalOutcomeRows(game: GameState): Array<{ name: string; outcome: string }> {
  const towerOutcomes = { maintained: '旧封印继续运转', released: '被囚记忆重返世界', inherited: '新的守忆人继承灰烬塔', reconstructed: '封印被重构为不再献祭的形式' };
  const harborOutcomes = { regulated: '港口接受公开监管', reformed: '征忆制度被公开改革', autonomous: '潮工取得港口自治', destroyed: '征忆港沉入潮下' };
  const forestOutcomes = { restored: '林海恢复自然循环', covenant: '人类与林海订立共生契约', sealed: '无名林海封闭根路', harvested: '根火落入人类手中' };
  return [
    { name: '灰烬塔', outcome: game.towerOutcome ? towerOutcomes[game.towerOutcome] : '命运未明' },
    { name: '沉钟港', outcome: game.harborOutcome ? harborOutcomes[game.harborOutcome] : '命运未明' },
    { name: '无名林海', outcome: game.forestOutcome ? forestOutcomes[game.forestOutcome] : '命运未明' },
    { name: '回声王庭', outcome: game.campaignOutcome ? getOutcomeLabel(game) : '命运未明' },
  ];
}

function CampaignEndingDialog({ game, open, onOpenChange, onRestart }: {
  game: GameState;
  open: boolean;
  onOpenChange(open: boolean): void;
  onRestart(): void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const finalNarration = getLastNarratorText(game);
  const paragraphs = finalNarration.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = 0;
    setPlaying(true);
    setFinished(false);
  }, [open, game.id, game.turn]);

  useEffect(() => {
    if (!open || !playing) return;
    let interval = 0;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
      const viewport = scrollRef.current;
      if (!viewport) return;
      const maximumScroll = viewport.scrollHeight - viewport.clientHeight;
      if (maximumScroll <= 1) return;
      viewport.scrollTop = Math.min(maximumScroll, viewport.scrollTop + 1);
      const reachedEnd = viewport.scrollTop >= maximumScroll - 1;
      if (reachedEnd) {
        window.clearInterval(interval);
        setPlaying(false);
        setFinished(true);
      }
      }, 40);
    }, 700);
    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [open, playing]);

  function replay() {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = 0;
    setFinished(false);
    setPlaying(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[82vh] flex-col gap-0 overflow-hidden border-primary/35 bg-card/98 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-8 py-6 text-center">
          <Badge className="mx-auto mb-2">四地图战役完成</Badge>
          <DialogTitle className="font-serif text-3xl tracking-wider">{getOutcomeTitle(game)}</DialogTitle>
          <DialogDescription>最终结局 · {getOutcomeLabel(game)}</DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-card to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-card to-transparent" />
          <div
            ref={scrollRef}
            className="game-scrollbar h-full overflow-y-auto px-10"
          >
            <article className="mx-auto max-w-2xl space-y-8 pb-[42vh] pt-[34vh] font-serif text-base leading-8 text-foreground/90">
              {(paragraphs.length ? paragraphs : ['你在万忆中枢作出的决定，已经越过王庭，传向四片彼此相连的土地。']).map((paragraph, index) => (
                <p key={`${game.turn}-${index}`} className="whitespace-pre-line text-pretty">{paragraph}</p>
              ))}

              <section className="space-y-5 border-y border-primary/25 py-8">
                <h3 className="text-center text-xs font-semibold tracking-[0.28em] text-primary uppercase">四地回响</h3>
                {getRegionalOutcomeRows(game).map((entry) => (
                  <div key={entry.name} className="grid grid-cols-[7rem_1fr] gap-5 text-sm leading-7">
                    <span className="text-right text-primary">{entry.name}</span>
                    <span>{entry.outcome}</span>
                  </div>
                ))}
              </section>

              <p className="text-center text-sm tracking-[0.35em] text-muted-foreground">—— 终 ——</p>
            </article>
          </div>
        </div>

        <DialogFooter className="shrink-0 items-center justify-between border-t border-border/60 px-8 py-4 sm:justify-between">
          <Button variant="ghost" onClick={finished ? replay : () => setPlaying((current) => !current)}>
            {finished ? <RotateCcw /> : playing ? <Pause /> : <Play />}
            {finished ? '重新播放' : playing ? '暂停滚动' : '继续滚动'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>返回记录</Button>
            <Button onClick={onRestart}>重新开始战役</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScriptLibraryPage({ bootstrap, connectionLabel, billingLabel, gameSpendLabel, onOpenScript, onOpenSettings }: {
  bootstrap: BootstrapPayload;
  connectionLabel: string;
  billingLabel: string | null;
  gameSpendLabel: string | null;
  onOpenScript(): void;
  onOpenSettings(): void;
}) {
  const { game } = bootstrap;
  const currentMapCompleted = game.completedMaps.includes(game.mapId);
  const completedScenes = (game.completedMaps.length * 6) + (currentMapCompleted ? 0 : game.progress);
  const progress = game.completed ? 100 : Math.min(99, (completedScenes / 24) * 100);
  const status = game.completed ? '已完成' : game.turn > 0 || game.completedMaps.length > 0 ? '进行中' : '尚未开始';

  return (
    <main className="flex min-h-screen flex-col overflow-y-auto bg-background text-foreground">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-border/70 bg-card/60 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src={appIcon} alt="" className="size-10 rounded-xl border border-primary/30 object-cover shadow-[0_0_18px_rgba(196,145,70,.18)]" />
          <div><h1 className="font-serif text-xl tracking-wider">回声剧本集</h1><p className="text-xs text-muted-foreground">选择一段等待回应的旅程</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 gap-2 px-3"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.6)]" />{connectionLabel}</Badge>
          {billingLabel ? <Badge variant="secondary" className="h-8 gap-1.5 px-3"><Coins className="size-3.5" />{billingLabel}</Badge> : null}
          <Button variant="outline" size="sm" onClick={onOpenSettings}><Settings2 />模型设置</Button>
        </div>
      </header>

      <section className="w-full flex-1 px-10 pt-5 pb-10">
        <p className="mb-5 text-[11px] leading-5 text-muted-foreground">游戏全程由 AI 驱动并会产生账单消耗，请自行权衡。</p>
        <div className="grid grid-flow-row grid-cols-[repeat(auto-fill,12rem)] content-start items-start justify-start gap-x-6 gap-y-8">
          <Card className="script-card group gap-0 border-0 bg-transparent py-0 shadow-none transition-transform duration-400 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform hover:-translate-y-1">
            <button type="button" onClick={onOpenScript} className="block w-full text-left focus-visible:outline-none">
              <div className="script-cover relative aspect-[2/3] origin-center overflow-hidden rounded-md border border-primary/25 bg-black shadow-[0_10px_22px_rgba(0,0,0,.26),inset_8px_0_14px_rgba(0,0,0,.14)] group-hover:border-primary/65 group-hover:shadow-[0_16px_30px_rgba(0,0,0,.38),0_0_20px_rgba(196,145,70,.09),inset_8px_0_14px_rgba(0,0,0,.14)] group-focus-within:ring-2 group-focus-within:ring-ring group-focus-within:ring-offset-2 group-focus-within:ring-offset-background">
                <img src={ashenTowerCover} alt="灰烬塔剧本封面" className="absolute inset-0 size-full object-cover transition-transform duration-1000 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.045]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,6,.38)_0%,transparent_28%,transparent_62%,rgba(8,7,6,.9)_100%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(232,184,102,.18),transparent_48%)] opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100" />
                <span className="absolute top-3 left-3 rounded-full border border-amber-200/15 bg-black/35 px-2 py-1 text-[10px] leading-none tracking-wide text-amber-100/75 backdrop-blur-sm" title="完整游玩预计消耗金额小于 1 元">完整游玩 &lt; ¥1</span>
                <Badge className="absolute top-3 right-3 px-2 py-0.5 text-[10px]" variant={game.completed ? 'default' : 'secondary'}>{status}</Badge>

                <div className="absolute inset-x-4 bottom-4">
                  <div className="mb-2 flex justify-between text-[10px] text-amber-100/65"><span>阅读进度</span><span className="tabular-nums">{Math.round(progress)}%</span></div>
                  <Progress value={progress} className="h-1 bg-black/35" />
                </div>
              </div>
            </button>

            <CardContent className="px-0.5 pt-3 pb-0">
              <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.18em] text-primary/80 uppercase">
                <Flame className="size-3.5 shrink-0" />
                <span>黑暗奇幻冒险</span>
              </div>
              <h3 className="font-serif text-base leading-tight tracking-[0.08em] text-foreground">灰烬塔的回声</h3>
              <p className="mt-1.5 text-[9px] tracking-[0.14em] text-muted-foreground">记忆 · 余烬 · 回响</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground transition-colors duration-500 group-hover:text-foreground/80">追随一盏余烬灯，调查被征集的记忆，并决定四片彼此牵连的土地最终的命运。</p>
              {gameSpendLabel ? <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Coins className="size-3" />{gameSpendLabel}</p> : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function ClueList({ clueIds }: { clueIds: string[] }) {
  return (
    <ul className="space-y-3 text-xs leading-5 text-muted-foreground">
      {clueIds.map((clueId) => (
        <li key={clueId} className="flex gap-2.5">
          <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
          <span>{adventure.clues[clueId as keyof typeof adventure.clues]}</span>
        </li>
      ))}
    </ul>
  );
}

function SidebarDialogSection({ title, description, preview, children, accent = false }: {
  title: string;
  description: string;
  preview: ReactNode;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="group -mx-3 block w-[calc(100%+1.5rem)] rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex items-center justify-between gap-3">
              <span className={accent
                ? 'text-[11px] tracking-[0.14em] text-primary uppercase'
                : 'text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase'}>
                {title}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </span>
            <div className="mt-3">{preview}</div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-hidden border-border bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto rounded-md border border-border/60 bg-background/25 p-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TowerStatusGrid({ game }: { game: GameState }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Flame className="size-3.5 text-amber-400" />灯火</div>
        <p className="shrink-0 font-medium tabular-nums text-foreground">{game.resources.ember} / {game.resources.emberMax}</p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Eye className="size-3.5 text-violet-400" />侵蚀</div>
        <p className="shrink-0 font-medium tabular-nums text-foreground">{game.resources.echoCorruption} / 3</p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Handshake className="size-3.5 text-sky-400" />信任</div>
        <p className="shrink-0 font-medium tabular-nums text-foreground">{game.resources.archivistTrust > 0 ? `+${game.resources.archivistTrust}` : game.resources.archivistTrust}</p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Bell className="size-3.5 text-rose-400" />警觉</div>
        <p className="shrink-0 font-medium tabular-nums text-foreground">{game.resources.towerAlert} / 2</p>
      </div>
    </div>
  );
}

function CampaignStatusGrid({ game }: { game: GameState }) {
  const statusByMap = {
    tower: [
      ['灯火', `${game.resources.ember} / ${game.resources.emberMax}`],
      ['侵蚀', `${game.resources.echoCorruption} / 3`],
      ['信任', game.resources.archivistTrust > 0 ? `+${game.resources.archivistTrust}` : `${game.resources.archivistTrust}`],
      ['警觉', `${game.resources.towerAlert} / 2`],
    ],
    harbor: [
      ['公众', `${game.resources.publicSupport}`], ['港务权威', `${game.resources.harborAuthority}`],
      ['潮工信任', `${game.resources.unionTrust}`], ['账证', `${game.resources.ledgerEvidence} / 3`],
    ],
    forest: [
      ['林海承认', `${game.resources.forestRecognition}`], ['循环平衡', `${game.resources.cycleBalance}`],
      ['根系污染', `${game.resources.rootPollution}`], ['年轮印', `${game.resources.ringMarks} / 3`],
    ],
    court: [
      ['王庭稳定', `${game.resources.courtStability}`], ['公开证据', `${game.resources.publicEvidence} / 3`],
      ['地区席位', `${game.resources.allianceSeats}`], ['转型负担', `${game.resources.transitionBurden}`],
    ],
  } satisfies Record<MapId, string[][]>;
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {statusByMap[game.mapId].map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

function TestimonyList({ testimonyIds }: { testimonyIds: string[] }) {
  if (testimonyIds.length === 0) return <p className="text-xs italic text-muted-foreground">尚未取得记忆证词</p>;
  return (
    <ul className="space-y-3 text-xs leading-5 text-muted-foreground">
      {testimonyIds.map((id) => <li key={id}>{adventure.testimonies[id as keyof typeof adventure.testimonies]}</li>)}
    </ul>
  );
}

function InventoryList({ itemIds, detailed = false }: { itemIds: string[]; detailed?: boolean }) {
  return (
    <ul className="divide-y divide-border/50">
      {itemIds.map((itemId) => {
        const item = adventure.items[itemId as keyof typeof adventure.items];
        return (
          <li key={itemId} className="py-3 first:pt-0 last:pb-0">
            <p className="font-serif text-sm text-primary">
              {detailed ? item.name : (
                <CursorTooltip content={item.description} className="max-w-full" focusable={false}>
                  <span className="block truncate">{item.name}</span>
                </CursorTooltip>
              )}
            </p>
            {detailed ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function LeftSidebar({ game }: { game: GameState }) {
  const scene = adventure.scenes[game.sceneId];
  const oathLabel = game.oath === 'none'
    ? '尚未立下誓言'
    : `誓言：${{ maintain: '维持封印', seek_truth: '查明真相后决定', refused: '拒绝承诺' }[game.oath]}${game.brokenOath ? '（已违背）' : ''}`;
  return (
    <aside className="min-h-0 overflow-y-auto border-r border-border/70 bg-card/20 px-6 py-5">
      <SidebarDialogSection
        title="所在场景"
        description="查看当前场景与本地图的旅程进度。"
        accent
        preview={<>
          <CursorTooltip content={scene.description} className="max-w-full" focusable={false}>
            <span className="block truncate font-serif text-xl leading-tight text-foreground transition-colors group-hover:text-primary">{scene.name}</span>
          </CursorTooltip>
          <span className="mt-4 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">旅程进度</span>
            <span className="font-medium tabular-nums text-foreground">{game.progress} / 6</span>
          </span>
          <Progress value={(game.progress / 6) * 100} className="mt-3 h-1.5" />
          <span className="mt-2 block text-xs text-muted-foreground">{getProgressLabel(game)}</span>
        </>}
      >
        <p className="font-serif text-lg text-foreground">{scene.name}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{scene.description}</p>
        <div className="mt-5 flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">旅程进度</span>
          <span className="font-medium tabular-nums text-foreground">{game.progress} / 6</span>
        </div>
        <Progress value={(game.progress / 6) * 100} className="mt-3 h-1.5" />
        <p className="mt-2 text-xs text-muted-foreground">{getProgressLabel(game)}</p>
      </SidebarDialogSection>

      <Separator className="my-4" />
      <SidebarDialogSection
        title={`${adventure.maps[game.mapId].shortName}状态`}
        description="查看当前资源、风险、关系与誓言状态。"
        preview={<><CampaignStatusGrid game={game} />{game.mapId === 'tower' && game.oath !== 'none' ? <span className="mt-3 block text-xs leading-5 text-muted-foreground">{oathLabel}</span> : null}</>}
      >
        <CampaignStatusGrid game={game} />
        {game.mapId === 'tower' ? <p className="mt-4 text-xs leading-5 text-muted-foreground">{oathLabel}</p> : null}
      </SidebarDialogSection>

      <Separator className="my-4" />
      <SidebarDialogSection
        title="随身物品"
        description="查看当前携带物品的用途与限制。"
        preview={<InventoryList itemIds={game.inventory} />}
      >
        <InventoryList itemIds={game.inventory} detailed />
      </SidebarDialogSection>
    </aside>
  );
}

function RightSidebar({ game }: { game: GameState }) {
  const objective = getCurrentObjective(game);
  const newestClues = getCluesNewestFirst(game.clues);
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-border/70 bg-card/20 px-6 py-5">
      <SidebarDialogSection
        title="当前任务"
        description="查看当前场景中最明确的推进目标。"
        preview={<span className="block border-l-2 border-primary/70 pl-3 font-serif text-sm leading-6 text-foreground">{objective}</span>}
      >
        <p className="border-l-2 border-primary/70 pl-4 font-serif text-base leading-7 text-foreground">{objective}</p>
      </SidebarDialogSection>

      <Separator className="my-4" />
      <SidebarDialogSection
        title="已知线索"
        description={`共 ${game.clues.length} 条，最新发现的线索排在最上方。`}
        preview={game.clues.length === 0
          ? <span className="text-xs italic text-muted-foreground">尚未发现线索</span>
          : <ClueList clueIds={newestClues.slice(0, 3)} />}
      >
        {game.clues.length === 0
          ? <p className="text-xs italic text-muted-foreground">尚未发现线索</p>
          : <ClueList clueIds={newestClues} />}
      </SidebarDialogSection>

      <Separator className="my-4" />
      <SidebarDialogSection
        title="记忆证词"
        description="查看已经取得、可用于还原历史与影响结局的记忆证词。"
        preview={<TestimonyList testimonyIds={game.testimonies} />}
      >
        <TestimonyList testimonyIds={game.testimonies} />
      </SidebarDialogSection>
    </aside>
  );
}

function SettingsDialog({ bootstrap, open, onOpenChange, onSaved }: {
  bootstrap: BootstrapPayload;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved(payload: BootstrapPayload): void;
}) {
  const [settings, setSettings] = useState<ProviderConfig>(() => normalizeDeepSeekSettings(bootstrap.settings));
  const [narrativeRules, setNarrativeRules] = useState<NarrativeRules>(bootstrap.narrativeRules);
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSettings(normalizeDeepSeekSettings(bootstrap.settings));
    setNarrativeRules(bootstrap.narrativeRules);
    setSecret('');
    setTestResult(null);
    setError('');
  }, [open, bootstrap.settings.provider, bootstrap.settings.baseURL, bootstrap.settings.modelId, bootstrap.narrativeRules]);

  async function testConnection() {
    setTesting(true); setError(''); setTestResult(null);
    try {
      setTestResult(await window.localRpg.testConnection(settings, secret));
    } catch (reason) {
      setTestResult({
        ok: false,
        message: reason instanceof Error ? reason.message : '连接测试失败',
        latencyMs: 0,
      });
    } finally { setTesting(false); }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (secret.trim()) await window.localRpg.saveCredential(secret);
      await window.localRpg.saveSettings(settings);
      const next = await window.localRpg.saveNarrativeRules(narrativeRules);
      onSaved(next); onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">连接叙事模型</DialogTitle>
          <DialogDescription>模型配置和 Key 只保存在这台电脑上。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <label className="grid gap-2 text-sm">DeepSeek 模型
            <Select value={settings.modelId} onValueChange={(modelId) => setSettings({
              provider: 'deepseek', baseURL: DEEPSEEK_BASE_URL, modelId,
            })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEEPSEEK_MODELS.map((model) => <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-sm">API Key
            <Input type="password" value={secret} onChange={(event) => setSecret(event.target.value)}
              placeholder={bootstrap.credentialConfigured ? '已安全保存；留空表示不修改' : '输入玩家自己的 API Key'} autoComplete="off" />
          </label>
          {testResult ? <p className={testResult.ok ? 'text-xs text-emerald-400' : 'text-xs text-destructive'}>{testResult.message} · {testResult.latencyMs} ms</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Separator className="my-2" />
          <div>
            <h3 className="font-serif text-base">叙事规则</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">调整叙事氛围、干扰信息与文风。篇幅、段落和上下文等规则由游戏自动控制；设置从下一次行动开始生效。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm">氛围强度
              <Select value={narrativeRules.atmosphereLevel} onValueChange={(atmosphereLevel) => setNarrativeRules((current) => ({
                ...current, atmosphereLevel: atmosphereLevel as NarrativeRules['atmosphereLevel'],
              }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="subtle">轻微</SelectItem><SelectItem value="rich">丰富</SelectItem><SelectItem value="cinematic">电影感</SelectItem></SelectContent>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">干扰信息
              <Select value={narrativeRules.interferenceFrequency} onValueChange={(interferenceFrequency) => setNarrativeRules((current) => ({
                ...current, interferenceFrequency: interferenceFrequency as NarrativeRules['interferenceFrequency'],
              }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="off">关闭</SelectItem><SelectItem value="occasional">偶尔</SelectItem><SelectItem value="frequent">频繁</SelectItem></SelectContent>
              </Select>
            </label>
          </div>
          <label className="grid gap-2 text-sm">自定义文风
            <textarea className="min-h-24 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              maxLength={800} value={narrativeRules.stylePrompt}
              onChange={(event) => setNarrativeRules((current) => ({ ...current, stylePrompt: event.target.value }))} />
          </label>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {bootstrap.credentialConfigured ? (
              <Button variant="ghost" onClick={async () => {
                await window.localRpg.clearCredential();
                onSaved(await window.localRpg.getBootstrap());
                onOpenChange(false);
              }}>清除 Key</Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={async () => {
              const next = await window.localRpg.resetNarrativeRules();
              setNarrativeRules(next.narrativeRules); onSaved(next);
            }}>恢复叙事默认值</Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || saving}>{testing ? '测试中…' : '测试连接'}</Button>
            <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存配置'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequiredModelDialog({ bootstrap, open, onOpenChange, onConnected }: {
  bootstrap: BootstrapPayload;
  open: boolean;
  onOpenChange(open: boolean): void;
  onConnected(payload: BootstrapPayload): void;
}) {
  const [settings, setSettings] = useState<ProviderConfig>(() => normalizeDeepSeekSettings(bootstrap.settings));
  const [secret, setSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setSettings(normalizeDeepSeekSettings(bootstrap.settings));
    setSecret('');
    setResult(null);
  }, [open, bootstrap.settings.provider, bootstrap.settings.baseURL, bootstrap.settings.modelId]);

  async function connectAndEnter() {
    setConnecting(true);
    setResult(null);
    try {
      const tested = await window.localRpg.testConnection(settings, secret);
      if (!tested.ok) {
        setResult(tested);
        return;
      }
      if (secret.trim()) await window.localRpg.saveCredential(secret);
      const next = await window.localRpg.saveSettings(settings);
      onConnected(next);
    } catch (reason) {
      setResult({
        ok: false,
        message: reason instanceof Error ? reason.message : '连接测试失败',
        latencyMs: 0,
      });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={connecting ? () => undefined : onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">连接模型后进入剧本</DialogTitle>
          <DialogDescription>配置只保存在这台电脑上。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <label className="grid gap-2 text-sm">DeepSeek 模型
            <Select value={settings.modelId} onValueChange={(modelId) => setSettings({
              provider: 'deepseek', baseURL: DEEPSEEK_BASE_URL, modelId,
            })} disabled={connecting}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEEPSEEK_MODELS.map((model) => <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-sm">API Key
            <Input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={bootstrap.credentialConfigured ? '已安全保存；留空使用现有 Key' : '输入 DeepSeek API Key'}
              autoComplete="off"
              disabled={connecting}
            />
          </label>
          {result && !result.ok ? <p className="text-xs leading-5 text-destructive">{result.message}</p> : null}
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={connectAndEnter}
            disabled={connecting || (!bootstrap.credentialConfigured && !secret.trim())}
          >
            {connecting ? '正在检测连接…' : '检测连接并进入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [view, setView] = useState<'library' | 'game'>('library');
  const [input, setInput] = useState('');
  const [pendingPlayer, setPendingPlayer] = useState('');
  const [pendingNarration, setPendingNarration] = useState('');
  const [activeRequest, setActiveRequest] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requiredModelOpen, setRequiredModelOpen] = useState(false);
  const [endingOpen, setEndingOpen] = useState(false);
  const [restartingCheckpoint, setRestartingCheckpoint] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoplayEpochRef = useRef(0);

  useEffect(() => {
    if (!window.localRpg) {
      setError('本地安全桥接加载失败，请完全退出应用后重新启动。');
      return;
    }
    void window.localRpg.getBootstrap().then(setBootstrap).catch((reason) => {
      setError(reason instanceof Error ? reason.message : '无法加载本地数据');
    });
  }, []);

  useEffect(() => {
    if (!bootstrap?.credentialConfigured || bootstrap.settings.provider !== 'deepseek') return;
    let cancelled = false;
    const refresh = () => {
      void window.localRpg.refreshBilling().then((game) => {
        if (cancelled) return;
        setBootstrap((current) => current?.game.id === game.id ? { ...current, game } : current);
      }).catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [bootstrap?.credentialConfigured, bootstrap?.game.id, bootstrap?.settings.baseURL, bootstrap?.settings.provider]);

  useEffect(() => {
    setEndingOpen(view === 'game' && Boolean(bootstrap?.game.completed));
  }, [view, bootstrap?.game.completed, bootstrap?.game.id]);

  useEffect(() => window.localRpg.onStream((event) => {
    if (event.type === 'chunk') setPendingNarration((text) => text + event.text);
    if (event.type === 'billing') {
      setBootstrap((current) => current?.game.id === event.gameId
        ? { ...current, game: { ...current.game, billing: event.billing } }
        : current);
    }
    if (event.type === 'complete') {
      setBootstrap((current) => current ? { ...current, game: event.state } : current);
      setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
    }
    if (event.type === 'error') {
      setError(event.message); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
    }
  }), []);

  useEffect(() => {
    if (view !== 'game' || activeRequest || settingsOpen || !bootstrap || bootstrap.game.completed || bootstrap.game.regionCompleted || bootstrap.game.failed) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view, activeRequest, settingsOpen, bootstrap?.game.completed, bootstrap?.game.regionCompleted, bootstrap?.game.failed]);

  useEffect(() => {
    if (view !== 'game' || !autoplayEnabled || !bootstrap || activeRequest || settingsOpen || bootstrap.game.completed) return;
    const epoch = ++autoplayEpochRef.current;
    const isCurrent = () => autoplayEpochRef.current === epoch;
    const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

    const run = async () => {
      // Give React StrictMode cleanup time to cancel its first development-only effect pass.
      await wait(220);
      if (!isCurrent()) return;
      const decision = getAutoplayDecision(bootstrap.game);
      if (decision.type === 'done') {
        setAutoplayEnabled(false);
        return;
      }
      if (decision.type === 'restart-checkpoint') {
        const game = await window.localRpg.restartFromCheckpoint();
        if (!isCurrent()) return;
        setBootstrap((current) => current ? { ...current, game } : current);
        setError(''); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
        return;
      }
      if (decision.type === 'map') {
        const game = await window.localRpg.startMap(decision.mapId);
        if (!isCurrent()) return;
        setBootstrap((current) => current ? { ...current, game } : current);
        setError(''); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
        return;
      }

      setInput('');
      const characters = Array.from(decision.text);
      for (let index = 0; index < characters.length; index += 1) {
        await wait(28 + (index % 4) * 7);
        if (!isCurrent()) return;
        setInput(decision.text.slice(0, index + 1));
      }
      await wait(320);
      if (!isCurrent()) return;
      await submit(decision.text);
    };

    void run().catch((reason) => {
      if (!isCurrent()) return;
      setAutoplayEnabled(false);
      setError(reason instanceof Error ? reason.message : '自动试玩代理已停止');
    });
    return () => { autoplayEpochRef.current += 1; };
  }, [
    activeRequest, autoplayEnabled, bootstrap?.game.completed, bootstrap?.game.failed, bootstrap?.game.id,
    bootstrap?.game.mapId, bootstrap?.game.regionCompleted, bootstrap?.game.sceneId, bootstrap?.game.turn, settingsOpen, view,
  ]);

  const connectionLabel = useMemo(() => {
    if (bootstrap?.settings.provider === 'local' && bootstrap.settings.modelId) return `${bootstrap.settings.modelId}（本地）`;
    if (!bootstrap?.credentialConfigured) return '本地演示模式';
    return bootstrap.settings.modelId || '模型待配置';
  }, [bootstrap]);

  const billingLabel = getBillingLabel(bootstrap);
  const gameSpendLabel = getGameSpendLabel(bootstrap);

  async function submit(text: string) {
    const normalized = text.trim();
    if (!normalized || activeRequest || bootstrap?.game.completed || bootstrap?.game.regionCompleted || bootstrap?.game.failed) return;
    setInput(''); setError(''); setPendingPlayer(normalized); setPendingNarration('');
    try {
      const { requestId } = await window.localRpg.submitAction({ text: normalized });
      setActiveRequest(requestId);
    } catch (reason) {
      setPendingPlayer(''); setError(reason instanceof Error ? reason.message : '提交失败');
    }
  }

  function stopAutoplay() {
    autoplayEpochRef.current += 1;
    setAutoplayEnabled(false);
  }

  function toggleAutoplay() {
    if (autoplayEnabled) {
      stopAutoplay();
      return;
    }
    setError('');
    setAutoplayEnabled(true);
  }

  async function restart() {
    stopAutoplay();
    const game = await window.localRpg.newGame();
    setBootstrap((current) => current ? { ...current, game } : current);
    setError(''); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
  }

  async function continueToMap(mapId: MapId) {
    try {
      const game = await window.localRpg.startMap(mapId);
      setBootstrap((current) => current ? { ...current, game } : current);
      setError(''); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法进入下一张地图');
    }
  }

  async function confirmFailureRestart() {
    setRestartingCheckpoint(true);
    try {
      const game = await window.localRpg.restartFromCheckpoint();
      setBootstrap((current) => current ? { ...current, game } : current);
      setError(''); setPendingPlayer(''); setPendingNarration(''); setActiveRequest('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法返回流程点');
    } finally {
      setRestartingCheckpoint(false);
    }
  }

  if (!bootstrap) {
    return <main className="grid min-h-screen place-content-center text-center text-muted-foreground"><Sparkles className="mx-auto mb-4 size-8 animate-pulse text-primary" /><p>{error || '正在唤醒故事…'}</p></main>;
  }

  if (view === 'library') {
    return <>
      <ScriptLibraryPage
        bootstrap={bootstrap}
        connectionLabel={connectionLabel}
        billingLabel={billingLabel}
        gameSpendLabel={gameSpendLabel}
        onOpenScript={() => {
          const modelReady = bootstrap.settings.provider === 'deepseek' && Boolean(bootstrap.settings.modelId);
          if (!modelReady || !bootstrap.credentialConfigured) {
            setRequiredModelOpen(true);
            return;
          }
          setView('game');
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsDialog bootstrap={bootstrap} open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setBootstrap} />
      <RequiredModelDialog
        bootstrap={bootstrap}
        open={requiredModelOpen}
        onOpenChange={setRequiredModelOpen}
        onConnected={(next) => {
          setBootstrap(next);
          setRequiredModelOpen(false);
          setView('game');
        }}
      />
    </>;
  }

  const chatStatus = activeRequest ? 'streaming' as const : error ? 'error' as const : 'ready' as const;
  const failureNarration = bootstrap.game.failed ? getLastNarratorText(bootstrap.game) : '';
  return (
    <main className="flex h-screen min-w-[1260px] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-border/70 bg-card/60 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { stopAutoplay(); setView('library'); }}
            disabled={Boolean(activeRequest)}
            aria-label="返回剧本主页"
            title={activeRequest ? '等待当前叙事完成后返回主页' : '返回剧本主页'}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-45"
          >
            <img src={appIcon} alt="" className="size-10 rounded-xl border border-primary/30 object-cover transition-[border-color,filter] group-hover:border-primary/60" />
          </button>
          <h1 className="font-serif text-2xl tracking-wider">{adventure.title}</h1>
          <Button variant="ghost" size="sm" onClick={() => { stopAutoplay(); setView('library'); }} disabled={Boolean(activeRequest)} title={activeRequest ? '等待当前叙事完成后返回主页' : '返回剧本主页'}><House />剧本主页</Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 gap-2 px-3"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.6)]" />{connectionLabel}</Badge>
          {billingLabel ? <Badge variant="secondary" className="h-8 gap-1.5 px-3"><Coins className="size-3.5" />{billingLabel}</Badge> : null}
          <Button
            variant={autoplayEnabled ? 'default' : 'outline'} size="sm" onClick={toggleAutoplay}
            disabled={bootstrap.game.completed} aria-pressed={autoplayEnabled}
            title={autoplayEnabled ? '暂停后可立即接管输入' : '从当前状态启动自动试玩'}
          >
            {autoplayEnabled ? <Pause /> : <Play />}{autoplayEnabled ? '暂停代理' : '自动试玩'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 />模型设置</Button>
          <Button variant="outline" size="sm" onClick={restart}><RotateCcw />重新开始</Button>
        </div>
      </header>

      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1 overflow-hidden"
        resizeTargetMinimumSize={{ fine: 8, coarse: 20 }}
      >
        <ResizablePanel id="left-sidebar" defaultSize="18" minSize="18" maxSize="22">
          <LeftSidebar game={bootstrap.game} />
        </ResizablePanel>
        <ResizableHandle id="left-sidebar-handle" />
        <ResizablePanel id="chat" defaultSize="60" minSize="44">
          <section className="relative flex size-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(170,125,62,.08),transparent_35rem)]">
          <NarratorRecallDropdown messages={bootstrap.game.messages} sceneId={bootstrap.game.sceneId} />
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-4xl gap-5 px-8 py-8">
              {bootstrap.game.messages.map((message) => <StoryMessage key={message.id} message={message} />)}
              {pendingPlayer ? <StoryMessage message={{ id: 'pending-player', role: 'player', text: pendingPlayer, createdAt: 0 }} /> : null}
              {pendingPlayer ? (
                <AiMessage from="assistant">
                  <div className="mb-1 px-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">叙事者</div>
                  <MessageContent className="narrator-message-content border border-border/70 bg-card/80 shadow-sm">
                    {pendingNarration ? <MessageResponse className="story-narration space-y-2">{pendingNarration}</MessageResponse> : <span className="animate-pulse text-sm text-muted-foreground">正在倾听回声…</span>}
                  </MessageContent>
                </AiMessage>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="mx-auto w-full max-w-4xl shrink-0 px-8 pb-6">
            {error ? <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">{error}</div> : null}
            {bootstrap.game.completed ? (
              <Card className="border-primary/40 bg-card/90 text-center">
                <CardHeader><Badge className="mx-auto">四地图战役完成</Badge><CardTitle className="font-serif">{getOutcomeTitle(bootstrap.game)}</CardTitle><CardDescription>最终结局：{getOutcomeLabel(bootstrap.game)}</CardDescription></CardHeader>
                <CardContent className="flex justify-center gap-3"><Button variant="outline" onClick={() => setEndingOpen(true)}>重看结局</Button><Button onClick={restart}>重新开始战役</Button></CardContent>
              </Card>
            ) : bootstrap.game.regionCompleted ? (
              <Card className="border-primary/40 bg-card/90 text-center">
                <CardHeader><Badge className="mx-auto">{adventure.maps[bootstrap.game.mapId].shortName}完成</Badge><CardTitle className="font-serif">{getOutcomeTitle(bootstrap.game)}</CardTitle><CardDescription>区域结局：{getOutcomeLabel(bootstrap.game)}</CardDescription></CardHeader>
                <CardContent className="flex justify-center gap-3">
                  {getAvailableMaps(bootstrap.game).map((mapId) => <Button key={mapId} onClick={() => continueToMap(mapId)}>进入{adventure.maps[mapId].shortName}</Button>)}
                </CardContent>
              </Card>
            ) : (
              <PromptInput className="rounded-xl border border-border/80 bg-card/90 shadow-2xl" onSubmit={({ text }) => { stopAutoplay(); void submit(text); }}>
                <PromptInputBody>
                  <PromptInputTextarea ref={inputRef} value={input} onChange={(event) => { stopAutoplay(); setInput(event.target.value); }}
                    placeholder="描述你想做的事，例如：我举起余烬灯检查门上的符文……" maxLength={1200} disabled={Boolean(activeRequest) || bootstrap.game.regionCompleted || bootstrap.game.failed} />
                </PromptInputBody>
                <PromptInputFooter className="border-t border-border/60 px-3 py-2">
                  <PromptInputTools>
                    {autoplayEnabled
                      ? <span className="flex items-center gap-1.5 text-[11px] text-primary"><Bot className="size-3.5" />代理正在模拟输入，暂停后可接管</span>
                      : <span className="text-[11px] text-muted-foreground">Enter 发送 · Shift+Enter 换行</span>}
                  </PromptInputTools>
                  <PromptInputSubmit status={chatStatus} disabled={!input.trim() || Boolean(activeRequest) || bootstrap.game.regionCompleted || bootstrap.game.failed} />
                </PromptInputFooter>
              </PromptInput>
            )}
          </div>
          </section>
        </ResizablePanel>
        <ResizableHandle id="right-sidebar-handle" />
        <ResizablePanel id="right-sidebar" defaultSize="18" minSize="18" maxSize="22">
          <RightSidebar game={bootstrap.game} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <SettingsDialog bootstrap={bootstrap} open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setBootstrap} />
      {bootstrap.game.completed ? (
        <CampaignEndingDialog game={bootstrap.game} open={endingOpen} onOpenChange={setEndingOpen} onRestart={restart} />
      ) : null}
      <Dialog open={view === 'game' && Boolean(bootstrap.game.failed)} onOpenChange={() => undefined}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="sr-only">失败</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap font-serif text-base leading-8 text-foreground">
              {failureNarration}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={confirmFailureRestart} disabled={restartingCheckpoint}>
              {restartingCheckpoint ? '重新开始……' : '重新开始'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
