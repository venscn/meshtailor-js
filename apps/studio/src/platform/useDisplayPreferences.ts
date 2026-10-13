import { useSyncExternalStore } from 'react';
import { displayPreferences, readDisplayPreferences, DISPLAY_STORAGE_KEY, type PreferenceStorage } from '../../../../packages/ui-platform/src/index';

export function useDisplayPreferences() {
  return useSyncExternalStore(displayPreferences.subscribe, displayPreferences.getSnapshot, displayPreferences.getSnapshot);
}

/** Browser ownership stays in the client adapter. The shared package has no
 * DOM, React, storage, or algorithm side effects when imported by the offline lab. */
export function initializeDisplayPreferences(browser: Window) {
  let storage: PreferenceStorage | undefined;
  try { storage = browser.localStorage; } catch { /* Session preferences still work with blocked storage. */ }
  displayPreferences.set(readDisplayPreferences(storage));
  const apply = () => {
    const preferences = displayPreferences.getSnapshot();
    browser.document.documentElement.lang = preferences.locale;
    try { storage?.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Do not interrupt an active mesh job. */ }
  };
  apply();
  return displayPreferences.subscribe(apply);
}
