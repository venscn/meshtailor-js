import type { Theme } from './preferences.js';

const dark = {
  '--app-bg':'#1b1d1f', '--panel-bg':'#242628', '--field-bg':'#1c1e20', '--hover-bg':'#333639',
  '--line':'#393c3f', '--line-soft':'#303335', '--text':'#e0e2e4', '--muted':'#a1a6aa', '--quiet':'#92999f',
  '--accent':'#ceaf7b', '--accent-fill':'#3e382d', '--danger':'#e3a391', '--danger-border':'#b96955',
  '--raised-bg':'#292b2d', '--button-bg':'#2c2f31', '--button-hover-border':'#666b6f',
  '--primary-text':'#efdab8', '--primary-border':'#766343', '--primary-hover-bg':'#4c4333',
  '--link':'#d4bb93', '--scroll-thumb':'#4a4e51', '--overlay-bg':'#202224ed', '--error-bg':'#272626f5',
  '--info':'#9fc3d4', '--info-bg':'#263336e8', '--warning':'#d69b4c', '--selection-fill':'#88b9c522',
} as const;
const light: Record<keyof typeof dark,string> = {
  '--app-bg':'#f7f8fa', '--panel-bg':'#eef1f4', '--field-bg':'#ffffff', '--hover-bg':'#e2e7ed',
  '--line':'#c9d0d8', '--line-soft':'#dce1e7', '--text':'#19232e', '--muted':'#465566', '--quiet':'#526273',
  '--accent':'#73531e', '--accent-fill':'#f2e6ce', '--danger':'#963f2f', '--danger-border':'#a95242',
  '--raised-bg':'#e6ebf0', '--button-bg':'#f5f7fa', '--button-hover-border':'#8997a5',
  '--primary-text':'#5d431b', '--primary-border':'#ad8848', '--primary-hover-bg':'#e9d8b7',
  '--link':'#73531e', '--scroll-thumb':'#a6b3bf', '--overlay-bg':'#ffffffed', '--error-bg':'#fff4f0f5',
  '--info':'#28627c', '--info-bg':'#e7f3f8ed', '--warning':'#9a601a', '--selection-fill':'#387b9d22',
};

function rgb(hex:string):readonly[number,number,number] {
  return [Number.parseInt(hex.slice(1,3),16)/255,Number.parseInt(hex.slice(3,5),16)/255,Number.parseInt(hex.slice(5,7),16)/255];
}

function palette(theme:Theme,tokens:Record<keyof typeof dark,string>) {
  return Object.freeze({
    tokens:Object.freeze(tokens), background:tokens['--app-bg'], clearColor:rgb(tokens['--app-bg']),
    atlasBorder:theme==='dark'?'#344352':'#8a9cad', atlasLine:rgb(theme==='dark'?'#3b4f63':'#6b8195'),
    labelBackground:tokens['--overlay-bg'], labelText:tokens['--text'], caption:tokens['--muted'], quiet:tokens['--quiet'],
    focusedFace:theme==='dark'?'#ffffff':'#183d5a', focusColor:rgb(theme==='dark'?'#ffffff':'#183d5a'),
    seam:theme==='dark'?'#ffca71':'#ad6c0d', seamColor:rgb(theme==='dark'?'#ffca71':'#ad6c0d'),
    hingeColor:rgb(theme==='dark'?'#33e6ff':'#087f94'), temporaryColor:rgb(theme==='dark'?'#eb73ff':'#ac27bd'),
  });
}

/** One display palette drives DOM, Canvas, and GL. Island identity colors are
 * deliberately excluded: switching appearance must not change correspondence. */
const palettes={dark:palette('dark',{...dark}),light:palette('light',light)};
export function getPalette(theme:Theme) { return palettes[theme]; }
export type DisplayPalette = ReturnType<typeof getPalette>;
