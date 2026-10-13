export type Locale = 'en' | 'zh-CN';
export type Theme = 'light' | 'dark';
export interface DisplayPreferences { readonly locale: Locale; readonly theme: Theme }
export interface PreferenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

export const DISPLAY_STORAGE_KEY = 'meshtailor.display.v1';
export const DEFAULT_DISPLAY: DisplayPreferences = Object.freeze({ locale: 'en', theme: 'dark' });

/** A separate storage namespace prevents appearance from becoming solver input.
 * Unknown or corrupt persisted values are ignored, never copied to a job. */
export function readDisplayPreferences(storage?: Pick<PreferenceStorage, 'getItem'>, fallback = DEFAULT_DISPLAY): DisplayPreferences {
  try {
    const value: unknown = JSON.parse(storage?.getItem(DISPLAY_STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return fallback;
    const record = value as Record<string, unknown>;
    return Object.freeze({
      locale: record.locale === 'en' || record.locale === 'zh-CN' ? record.locale : fallback.locale,
      theme: record.theme === 'light' || record.theme === 'dark' ? record.theme : fallback.theme,
    });
  } catch { return fallback; }
}

/** Framework-neutral observable. Notifications are for presentation redraws;
 * subscribers must not replace meshes, snapshots, cameras, or generation options. */
export function createDisplayPreferenceStore(initial: DisplayPreferences = DEFAULT_DISPLAY) {
  let state = Object.freeze({ ...initial });
  const listeners = new Set<() => void>();
  return {
    getSnapshot: (): DisplayPreferences => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(patch: Partial<DisplayPreferences>) {
      const next = { ...state, ...patch };
      if (next.locale !== 'en' && next.locale !== 'zh-CN') throw new Error('Unsupported display locale.');
      if (next.theme !== 'light' && next.theme !== 'dark') throw new Error('Unsupported display theme.');
      if (next.locale === state.locale && next.theme === state.theme) return;
      state = Object.freeze(next);
      for (const listener of listeners) listener();
    },
  };
}

export const displayPreferences = createDisplayPreferenceStore();
