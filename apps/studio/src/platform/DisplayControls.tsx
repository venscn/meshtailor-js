import { displayPreferences, message, type Locale } from '../../../../packages/ui-platform/src/index';
import { useDisplayPreferences } from './useDisplayPreferences';

export function DisplayControls() {
  const preferences = useDisplayPreferences();
  return <div className="display-preferences" role="group" aria-label={message('Display preferences')}>
    <label>{message('Language')}<select aria-label={message('Language')} value={preferences.locale}
      onChange={event => displayPreferences.set({ locale: event.target.value as Locale })}>
      <option value="en">English</option><option value="zh-CN">简体中文</option>
    </select></label>
  </div>;
}
