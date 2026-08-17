import { describe, expect, it } from 'vitest';
import type { SceneId } from '../../shared/adventure';
import type { GameMessage } from '../../shared/contracts';
import { getCurrentSceneUnpassedAttemptCount, getLatestSceneProgressMessage } from './narrative-highlights';

function message(
  id: string, sceneId?: SceneId, outcome?: GameMessage['outcome'], narrativeMode?: GameMessage['narrativeMode'],
): GameMessage {
  return { id, role: 'narrator', text: id, createdAt: 1, narrativeMode, outcome, sceneId };
}

describe('getLatestSceneProgressMessage', () => {
  it('returns only the latest progress-bearing reply from the current scene', () => {
    const messages = [
      message('gate-progress', 'gate', 'progress', 'important-action'),
      message('hall-entry', 'hall', 'progress', 'background-rich'),
      message('hall-progress', 'hall', 'costly_success', 'important-action'),
      message('no-progress', 'hall', 'flavor', 'brief-action'),
      message('wrong-input', 'hall', 'blocked', 'brief-action'),
      message('other-scene', 'archive', 'progress', 'important-action'),
    ];

    expect(getLatestSceneProgressMessage(messages, 'hall')?.id).toBe('hall-progress');
  });

  it('uses the scene entry narration before the player makes progress', () => {
    const messages = [
      message('opening', 'gate', undefined, 'background-rich'),
      message('no-progress', 'gate', 'flavor', 'brief-action'),
    ];

    expect(getLatestSceneProgressMessage(messages, 'gate')?.id).toBe('opening');
  });

  it('recovers progress messages from saves created before scene ownership was recorded', () => {
    const messages = [
      message('old-gate-entry', undefined, undefined, 'background-rich'),
      message('old-gate-progress', undefined, 'progress', 'important-action'),
      message('hall-entry', undefined, 'progress', 'background-rich'),
      message('hall-progress', undefined, 'progress', 'important-action'),
      message('hall-no-progress', undefined, 'flavor', 'brief-action'),
    ];

    expect(getLatestSceneProgressMessage(messages, 'hall')?.id).toBe('hall-progress');
  });
});

describe('getCurrentSceneUnpassedAttemptCount', () => {
  it('counts completed player turns after entering the current scene', () => {
    const messages = [
      message('gate-entry', 'gate', undefined, 'background-rich'),
      message('gate-attempt', 'gate', 'blocked', 'brief-action'),
      message('hall-entry', 'hall', 'progress', 'background-rich'),
      message('hall-local-progress', 'hall', 'progress', 'important-action'),
      message('hall-flavor', 'hall', 'flavor', 'brief-action'),
      message('hall-blocked', 'hall', 'blocked', 'brief-action'),
    ];

    expect(getCurrentSceneUnpassedAttemptCount(messages, 'hall')).toBe(3);
  });

  it('supports old saves without scene ownership fields', () => {
    const messages = [
      message('old-entry', undefined, 'progress', 'background-rich'),
      message('attempt-1', undefined, 'progress', 'important-action'),
      message('attempt-2', undefined, 'blocked', 'brief-action'),
    ];

    expect(getCurrentSceneUnpassedAttemptCount(messages, 'hall')).toBe(2);
  });
});
