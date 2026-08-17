# 灰烬塔的回声

本地优先、玩家自带模型 Key（BYOK）的 AI 文字冒险桌面应用骨架。

## 已实现

- Electron + React/Vite 桌面应用
- 无服务器、本地 SQLite 存档和事件日志
- Electron safeStorage 加密保存 API Key
- AI SDK 7 流式叙事和结构化意图识别
- OpenAI、OpenAI-compatible、LM Studio/Ollama 接口入口
- 确定性剧情边界与本地无 Key 演示模式
- 固定地图、角色、物品和线索
- 地图一“灰烬塔”的六场景正式冒险：封印之门、守忆长厅、沉星档案井、裂钟回廊、灰烬阶梯与无火之塔
- 灯火、信任、回声侵蚀、塔顶警觉、誓言、记忆证词和受困回声等持续状态
- 观察、交涉、资源消耗与失败推进构成的多路线解法
- 由结构化条件判定的维持、释放、继任与重构四种区域结局

## 本地运行

要求 Node.js 22 或更高版本。

```bash
npm install
npm run rebuild:native
npm run dev
```

没有模型 Key 时也能游玩，应用会使用本地关键词意图识别和模板叙事。配置 Key 后，AI 负责意图解析及流式文学化叙事，但仍不能直接修改剧情状态。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

## Windows 打包

```bash
npm run package:win
```

安装包输出到 `release/`。用户的存档与加密 API Key 位于 Electron 的 `userData` 目录，不会写入安装包。

## 进程边界

- `src/renderer`：纯 UI，不读取 Key、文件系统或 Node API。
- `src/preload`：只暴露白名单 IPC 方法。
- `src/main`：模型调用、Key、本地数据库和确定性游戏引擎。
- `src/shared`：进程间契约和固定冒险内容。
