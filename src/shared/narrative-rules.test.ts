import { describe, expect, it } from 'vitest';
import { defaultNarrativeRules, narrativeRulesSchema, selectNarrativeGuidance } from './narrative-rules';

describe('narrative rules', () => {
  it('keeps occasional interference deterministic by turn', () => {
    const first = selectNarrativeGuidance('gate', 1, defaultNarrativeRules);
    const second = selectNarrativeGuidance('gate', 2, defaultNarrativeRules);
    expect(first.interference).not.toBeNull();
    expect(second.interference).toBeNull();
    expect(first.interference).toHaveProperty('mundaneTruth');
  });

  it('fully disables interference when configured off', () => {
    const rules = { ...defaultNarrativeRules, interferenceFrequency: 'off' as const };
    for (let turn = 0; turn < 12; turn += 1) {
      expect(selectNarrativeGuidance('summit', turn, rules).interference).toBeNull();
    }
  });

  it('uses more sensory details for cinematic atmosphere', () => {
    const subtle = selectNarrativeGuidance('hall', 0, { ...defaultNarrativeRules, atmosphereLevel: 'subtle' });
    const cinematic = selectNarrativeGuidance('hall', 0, { ...defaultNarrativeRules, atmosphereLevel: 'cinematic' });
    expect(subtle.sensoryDetails).toHaveLength(1);
    expect(cinematic.sensoryDetails).toHaveLength(3);
  });

  it('rejects an invalid narrative length range', () => {
    const parsed = narrativeRulesSchema.safeParse({
      ...defaultNarrativeRules,
      minCharacters: 200,
      maxCharacters: 230,
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps ordinary action replies short', () => {
    expect(defaultNarrativeRules.briefMaxCharacters).toBeLessThan(defaultNarrativeRules.minCharacters);
    const parsed = narrativeRulesSchema.safeParse({
      ...defaultNarrativeRules,
      briefMinCharacters: 50,
      briefMaxCharacters: 55,
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps scene background ranges independent and substantially longer', () => {
    expect(defaultNarrativeRules.sceneMinCharacters).toBeGreaterThan(defaultNarrativeRules.maxCharacters);
    const parsed = narrativeRulesSchema.safeParse({
      ...defaultNarrativeRules,
      sceneMinCharacters: 500,
      sceneMaxCharacters: 550,
    });
    expect(parsed.success).toBe(false);
  });
});
