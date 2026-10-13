import { describe, expect, it } from 'vitest';
import { createDisplayPreferenceStore, readDisplayPreferences, DEFAULT_DISPLAY, message, messages, descriptor, renderMessage } from '../index';

describe('display preferences are isolated from computation', () => {
  it('accepts supported display values and discards foreign persisted fields', () => {
    const storage = { getItem: () => JSON.stringify({ locale: 'zh-CN', theme: 'light', method: 'source', mesh: { faces: [] } }) };
    expect(readDisplayPreferences(storage)).toEqual({ locale: 'zh-CN', theme: 'light' });
    expect(readDisplayPreferences({ getItem: () => '{broken' })).toBe(DEFAULT_DISPLAY);
    expect(readDisplayPreferences({ getItem: () => JSON.stringify({ locale: 'invalid', theme: 'invalid' }) })).toEqual(DEFAULT_DISPLAY);
    expect(readDisplayPreferences({ getItem: () => { throw new Error('Storage blocked'); } })).toBe(DEFAULT_DISPLAY);
  });

  it('notifies only actual display changes and keeps snapshots stable between changes', () => {
    const store = createDisplayPreferenceStore();
    const before = store.getSnapshot();
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });
    store.set({ locale: 'en' });
    expect(store.getSnapshot()).toBe(before);
    expect(calls).toBe(0);
    store.set({ locale: 'zh-CN' });
    expect(calls).toBe(1);
    expect(before.locale).toBe('en');
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    unsubscribe();
    store.set({ theme: 'light' });
    expect(calls).toBe(1);
  });
});

describe('localized copy preserves measured values', () => {
  it('renders stored descriptors using the current requested language, not the language when created', () => {
    const notice = descriptor('Loaded {0}: {1} triangles.', ['gear.obj', 123]);
    expect(renderMessage(notice, 'en')).toBe('Loaded gear.obj: 123 triangles.');
    expect(renderMessage(notice, 'zh-CN')).toBe('已载入 gear.obj：123 个三角面。');
    expect(message('导入网格', [], 'en')).toBe('Import mesh');
  });

  it('keeps identical interpolation contracts in every translation', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
    for (const copy of Object.values(messages)) {
      expect(copy.en.length).toBeGreaterThan(0);
      expect(copy['zh-CN'].length).toBeGreaterThan(0);
      expect(placeholders(copy.en)).toEqual(placeholders(copy['zh-CN']));
    }
  });
});
