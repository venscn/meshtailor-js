import { displayPreferences, message, type Locale, type Theme } from '../../../../packages/ui-platform/src/index.js';
import { useDisplayPreferences } from './useDisplayPreferences.js';

export function DisplayControls() {
  const preferences = useDisplayPreferences();
  return <div className="display-preferences" role="group" aria-label={message('Display preferences')}>
    <label>{message('Language')}<select aria-label={message('Language')} value={preferences.locale}
      onChange={event => displayPreferences.set({ locale: event.target.value as Locale })}>
      <option value="en">English</option><option value="zh-CN">简体中文</option>
    </select></label>
    <label>{message('Theme')}<select aria-label={message('Theme')} value={preferences.theme}
      onChange={event => displayPreferences.set({ theme: event.target.value as Theme })}>
      <option value="light">{message('Light')}</option><option value="dark">{message('Dark')}</option>
    </select></label>
  </div>;
}
