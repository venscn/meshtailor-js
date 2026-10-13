import { describe, expect, it } from 'vitest';
import { createDisplayPreferenceStore, readDisplayPreferences, DEFAULT_DISPLAY, message, messages, descriptor, renderMessage, getPalette } from '../index';

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

describe('one theme palette drives all rendering surfaces', () => {
  it('uses identical token contracts and background colors in CSS and GL', () => {
    const dark = getPalette('dark'), light = getPalette('light');
    expect(Object.keys(dark.tokens).sort()).toEqual(Object.keys(light.tokens).sort());
    for (const palette of [dark, light]) {
      expect(palette.background).toBe(palette.tokens['--app-bg']);
      expect(palette.clearColor.map(channel => Math.round(channel*255))).toEqual([1,3,5].map(index => Number.parseInt(palette.background.slice(index,index+2),16)));
    }
    expect(light.background).not.toBe(dark.background);
  });

  it('keeps small UI text readable on both application and panel surfaces', () => {
    const luminance = (hex: string) => {
      const rgb = [1,3,5].map(index => Number.parseInt(hex.slice(index,index+2),16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    for (const theme of ['dark','light'] as const) {
      const {tokens} = getPalette(theme);
      for (const foreground of ['--text','--muted','--quiet'] as const) for (const background of ['--app-bg','--panel-bg','--raised-bg'] as const) {
        const a = luminance(tokens[foreground]), b = luminance(tokens[background]);
        expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
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
