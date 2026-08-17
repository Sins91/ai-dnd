import { describe, expect, it } from 'vitest';
import { getCluesNewestFirst } from './clue-order';

describe('getCluesNewestFirst', () => {
  it('puts later discoveries above earlier discoveries without mutating state', () => {
    const clueIds = ['first', 'second', 'third', 'fourth'];

    expect(getCluesNewestFirst(clueIds)).toEqual(['fourth', 'third', 'second', 'first']);
    expect(clueIds).toEqual(['first', 'second', 'third', 'fourth']);
  });
});
