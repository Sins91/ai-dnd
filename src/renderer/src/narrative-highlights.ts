import type { SceneId } from '../../shared/adventure';
import type { ActionOutcome, GameMessage } from '../../shared/contracts';

const PROGRESS_OUTCOMES = new Set<ActionOutcome>(['progress', 'costly_success', 'failed_forward', 'complete']);

function getSceneEntryIndex(messages: readonly GameMessage[], sceneId: SceneId): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'narrator' || message.narrativeMode !== 'background-rich') continue;
    if (message.sceneId === sceneId || !message.sceneId) return index;
  }
  return -1;
}

export function getCurrentSceneUnpassedAttemptCount(
  messages: readonly GameMessage[], sceneId: SceneId,
): number {
  const sceneEntryIndex = getSceneEntryIndex(messages, sceneId);
  let count = 0;
  for (let index = sceneEntryIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'narrator') continue;
    if (message.sceneId && message.sceneId !== sceneId) continue;
    count += 1;
  }
  return count;
}

export function getLatestSceneProgressMessage(
  messages: readonly GameMessage[], sceneId: SceneId,
): GameMessage | null {
  const sceneEntryIndex = getSceneEntryIndex(messages, sceneId);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'narrator') continue;
    if (message.sceneId && message.sceneId !== sceneId) continue;
    if (!message.sceneId && index < sceneEntryIndex) continue;
    if (message.outcome && PROGRESS_OUTCOMES.has(message.outcome)) return message;
    if (index === sceneEntryIndex && message.narrativeMode === 'background-rich') return message;
  }
  return null;
}
