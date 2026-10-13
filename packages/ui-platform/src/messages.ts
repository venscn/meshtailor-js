import { messages } from './catalogue.js';
import { displayPreferences, type Locale } from './preferences.js';
export { messages } from './catalogue.js';
export type MessageKey = keyof typeof messages;
export type MessageValues = readonly (string | number)[];
export interface MessageDescriptor { readonly key: MessageKey; readonly values: MessageValues }

export function descriptor(key: MessageKey, values: MessageValues = []): MessageDescriptor { return { key, values }; }

/** Report formatters may keep a bilingual sentence beside the measured values.
 * Both variants are mandatory; this never translates or mutates DOM content. */
export function bilingual(en: string, zh: string, locale: Locale = displayPreferences.getSnapshot().locale): string {
  return locale === 'en' ? en : zh;
}

export function message(key: MessageKey, values: MessageValues = [], locale: Locale = displayPreferences.getSnapshot().locale): string {
  return messages[key][locale].replace(/\{(\d+)\}/g, (placeholder, index: string) => values[Number(index)] === undefined ? placeholder : String(values[Number(index)]));
}

/** Known catalogue metadata gets localized before rendering. Unrecognized model
 * names, error details, and scientific diagnostics retain their exact evidence. */
export function displayLabel(value: string, locale: Locale = displayPreferences.getSnapshot().locale): string {
  return Object.hasOwn(messages, value) ? message(value as MessageKey, [], locale) : value;
}

export function renderMessage(value: string | MessageDescriptor, locale: Locale = displayPreferences.getSnapshot().locale): string {
  return typeof value === 'string' ? displayLabel(value, locale) : message(value.key, value.values, locale);
}

/** Generated page IDs carry display semantics; arbitrary material/space names
 * remain user data. Format the label without rewriting atlas/export metadata. */
export function uvSpaceDisplayName(id: string, name: string, locale: Locale = displayPreferences.getSnapshot().locale): string {
  const page = /^atlas-page-([1-9]\d*)$/.exec(id);
  return page ? bilingual(`UV page ${page[1]}`, `UV 页 ${page[1]}`, locale) : name;
}
