import { describe, expect, it } from 'vitest';
import { formatNarrationParagraphs } from './ai-service';
import { createInitialGame, type Resolution } from './game-engine';

function resolution(outcome: Resolution['outcome']): Resolution {
  return {
    nextState: createInitialGame(),
    outcome,
    approvedFacts: [],
  };
}

describe('formatNarrationParagraphs', () => {
  it('starts important information and plot progression in new paragraphs', () => {
    const formatted = formatNarrationParagraphs(
      '雨水沿着门缝缓慢淌落。三枚符文依次亮起，黑石门开启。你进入守忆长厅。余烬灯火减少一簇。',
      resolution('costly_success'),
    );

    expect(formatted.split('\n\n')).toEqual([
      '雨水沿着门缝缓慢淌落。',
      '三枚符文依次亮起，黑石门开启。',
      '你进入守忆长厅。',
      '余烬灯火减少一簇。',
    ]);
  });

  it('keeps ordinary short atmosphere sentences together', () => {
    const formatted = formatNarrationParagraphs(
      '雨声落在石面上。冷风从墙边掠过。灰尘在灯光里缓慢浮动。',
      resolution('flavor'),
    );

    expect(formatted).toBe('雨声落在石面上。冷风从墙边掠过。灰尘在灯光里缓慢浮动。');
  });
});
