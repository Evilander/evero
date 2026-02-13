/**
 * Palette System patch for EveRo v1.1.0
 *
 * Adds runtime palette switching with 13 curated presets + custom palette creator.
 *
 * 4 layers:
 *   1. Main process: __PaletteManager class + 6 IPC handlers
 *   2. Preload: palette:{} bridge namespace with 7 methods
 *   3. Renderer engine: CSS var override + __applyPalette + __resolveColor
 *   4. Renderer UI: palette picker button + panel in chat header
 *   5. Inline color replacements: dynamic __resolveColor() calls
 */

const fs = require('fs');
const path = require('path');

function log(msg) { console.log(`[patch-palette-system] ${msg}`); }

log('Applying palette system...');

// ============================================================
// COLOR UTILITIES (used to compute palette scales)
// ============================================================

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}

function mixHex(c1, c2, t) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function primaryScale(accent) {
  return {
    primary50: mixHex(accent, '#ffffff', 0.92),
    primary100: mixHex(accent, '#ffffff', 0.82),
    primary200: mixHex(accent, '#ffffff', 0.65),
    primary300: accent,
    primary400: mixHex(accent, '#000000', 0.12),
    primary500: mixHex(accent, '#000000', 0.25),
    primary600: mixHex(accent, '#000000', 0.38),
    primary700: mixHex(accent, '#000000', 0.52),
    primary800: mixHex(accent, '#000000', 0.65),
    primary900: mixHex(accent, '#000000', 0.78),
  };
}

function makePalette(id, name, author, type, accent, bg, surface, textPrimary, textSecondary, opts = {}) {
  const [ar, ag, ab] = hexToRgb(accent);
  const [br, bgg, bb] = hexToRgb(bg);
  const [tr, tg, tb] = hexToRgb(textSecondary);
  const textTertiary = opts.textTertiary || mixHex(textSecondary, bg, 0.35);
  const surfaceElevated = opts.surfaceElevated || mixHex(surface, textPrimary, 0.08);
  const hover = opts.hover || mixHex(surface, textPrimary, 0.12);
  const inputBg = opts.inputBg || mixHex(bg, '#000000', 0.08);
  const muted = opts.muted || mixHex(textSecondary, bg, 0.5);
  const borderHex = opts.border || surfaceElevated;

  return {
    id, name, author, type, builtin: true,
    colors: {
      ...primaryScale(accent),
      bg,
      surface,
      surfaceElevated,
      border: `rgba(${tr}, ${tg}, ${tb}, .12)`,
      borderSubtle: `rgba(${tr}, ${tg}, ${tb}, .06)`,
      hover,
      textPrimary,
      textSecondary,
      textTertiary,
      inputBg,
      codeBg: opts.codeBg || inputBg,
      codeInlineBg: opts.codeInlineBg || surfaceElevated,
      glassBg: `rgba(${br}, ${bgg}, ${bb}, .85)`,
      glassBorder: `rgba(${ar}, ${ag}, ${ab}, .15)`,
      glassShadow: `0 8px 32px rgba(${Math.max(0, br - 20)}, ${Math.max(0, bgg - 20)}, ${Math.max(0, bb - 20)}, .5)`,
      accentGlow: `rgba(${ar}, ${ag}, ${ab}, .15)`,
      accentGlowStrong: `rgba(${ar}, ${ag}, ${ab}, .3)`,
      bodyGradientFrom: opts.bodyGradientFrom || mixHex(bg, '#000000', 0.06),
      bodyGradientTo: opts.bodyGradientTo || bg,
      accentText: opts.accentText || (type === 'dark' ? bg : '#ffffff'),
      muted,
      success: '#4ade80',
      error: '#f87171',
      warning: '#fbbf24',
    }
  };
}

// ============================================================
// PALETTE DATA — 13 curated presets
// ============================================================

const PALETTES = [
  // 1. Midnight Blush — the current default (must match exactly)
  {
    id: 'midnight-blush', name: 'Midnight Blush', author: 'EveRo', type: 'dark', builtin: true,
    colors: {
      primary50: '#fff5f7', primary100: '#fde8ec', primary200: '#f8d0d7',
      primary300: '#eebbc3', primary400: '#e8a5af', primary500: '#d4899a',
      primary600: '#c07080', primary700: '#a85a6a', primary800: '#8a4555', primary900: '#6d3545',
      bg: '#232946', surface: '#1e2440', surfaceElevated: '#2a3157',
      border: 'rgba(184, 193, 236, .12)', borderSubtle: 'rgba(184, 193, 236, .06)',
      hover: '#303767',
      textPrimary: '#fffffe', textSecondary: '#b8c1ec', textTertiary: '#8892b8',
      inputBg: '#1a1f3d', codeBg: '#1a1f3d', codeInlineBg: '#2a3157',
      glassBg: 'rgba(35, 41, 70, .85)', glassBorder: 'rgba(238, 187, 195, .15)',
      glassShadow: '0 8px 32px rgba(18, 22, 41, .5)',
      accentGlow: 'rgba(238, 187, 195, .15)', accentGlowStrong: 'rgba(238, 187, 195, .3)',
      bodyGradientFrom: '#1a2040', bodyGradientTo: '#232946',
      accentText: '#232946', muted: '#6b7ead',
      success: '#4ade80', error: '#f87171', warning: '#fbbf24',
    }
  },
  // 2. Cyberpunk
  makePalette('cyberpunk', 'Cyberpunk', 'EveRo', 'dark',
    '#ff2a6d', '#0d0221', '#150734', '#e0e0ff', '#a599c4', {
      textTertiary: '#7b6f99', muted: '#5e4f8a', hover: '#1e0b4a',
      surfaceElevated: '#1f0f4f', inputBg: '#0a011a', border: '#1f0f4f',
      accentText: '#0d0221',
    }),
  // 3. Neon Ember
  makePalette('neon-ember', 'Neon Ember', 'EveRo', 'dark',
    '#ff6b35', '#0a0a0f', '#14141f', '#f0f0f0', '#a0a0b0', {
      textTertiary: '#707080', muted: '#555565', hover: '#1e1e2f',
      surfaceElevated: '#222235', inputBg: '#08080d', border: '#222235',
      accentText: '#0a0a0f',
    }),
  // 4. Deep Teal
  makePalette('deep-teal', 'Deep Teal', 'EveRo', 'dark',
    '#00d9ff', '#0d1b2a', '#1b2838', '#e0f7fa', '#80cbc4', {
      textTertiary: '#4db6ac', muted: '#2e8b83', hover: '#243a4d',
      surfaceElevated: '#263c50', inputBg: '#091520', border: '#263c50',
      accentText: '#0d1b2a',
    }),
  // 5. Mocha
  makePalette('mocha', 'Mocha', 'EveRo', 'dark',
    '#d4a574', '#1e1510', '#2a2018', '#f5e6d3', '#c4a882', {
      textTertiary: '#9a7e5b', muted: '#7a6348', hover: '#3a3025',
      surfaceElevated: '#3d3228', inputBg: '#17100b', border: '#3d3228',
      accentText: '#1e1510',
    }),
  // 6. Catppuccin Mocha
  {
    id: 'catppuccin-mocha', name: 'Catppuccin Mocha', author: 'Catppuccin', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#b4befe'),
      bg: '#1e1e2e', surface: '#181825', surfaceElevated: '#313244',
      border: 'rgba(186, 194, 222, .12)', borderSubtle: 'rgba(186, 194, 222, .06)',
      hover: '#383854',
      textPrimary: '#cdd6f4', textSecondary: '#bac2de', textTertiary: '#a6adc8',
      inputBg: '#11111b', codeBg: '#11111b', codeInlineBg: '#313244',
      glassBg: 'rgba(30, 30, 46, .85)', glassBorder: 'rgba(180, 190, 254, .15)',
      glassShadow: '0 8px 32px rgba(10, 10, 26, .5)',
      accentGlow: 'rgba(180, 190, 254, .15)', accentGlowStrong: 'rgba(180, 190, 254, .3)',
      bodyGradientFrom: '#181828', bodyGradientTo: '#1e1e2e',
      accentText: '#1e1e2e', muted: '#6c7086',
      success: '#a6e3a1', error: '#f38ba8', warning: '#f9e2af',
    }
  },
  // 7. Catppuccin Frappe
  {
    id: 'catppuccin-frappe', name: 'Catppuccin Frapp\u00e9', author: 'Catppuccin', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#babbf1'),
      bg: '#303446', surface: '#292c3c', surfaceElevated: '#414559',
      border: 'rgba(181, 191, 226, .12)', borderSubtle: 'rgba(181, 191, 226, .06)',
      hover: '#4a4e66',
      textPrimary: '#c6d0f5', textSecondary: '#b5bfe2', textTertiary: '#a5adce',
      inputBg: '#232634', codeBg: '#232634', codeInlineBg: '#414559',
      glassBg: 'rgba(48, 52, 70, .85)', glassBorder: 'rgba(186, 187, 241, .15)',
      glassShadow: '0 8px 32px rgba(28, 32, 50, .5)',
      accentGlow: 'rgba(186, 187, 241, .15)', accentGlowStrong: 'rgba(186, 187, 241, .3)',
      bodyGradientFrom: '#282c3e', bodyGradientTo: '#303446',
      accentText: '#303446', muted: '#737994',
      success: '#a6d189', error: '#e78284', warning: '#e5c890',
    }
  },
  // 8. Rose Pine
  {
    id: 'rose-pine', name: 'Ros\u00e9 Pine', author: 'Ros\u00e9 Pine', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#ebbcba'),
      bg: '#191724', surface: '#1f1d2e', surfaceElevated: '#26233a',
      border: 'rgba(144, 140, 170, .12)', borderSubtle: 'rgba(144, 140, 170, .06)',
      hover: '#2e2b40',
      textPrimary: '#e0def4', textSecondary: '#908caa', textTertiary: '#6e6a86',
      inputBg: '#13111e', codeBg: '#13111e', codeInlineBg: '#26233a',
      glassBg: 'rgba(25, 23, 36, .85)', glassBorder: 'rgba(235, 188, 186, .15)',
      glassShadow: '0 8px 32px rgba(5, 3, 16, .5)',
      accentGlow: 'rgba(235, 188, 186, .15)', accentGlowStrong: 'rgba(235, 188, 186, .3)',
      bodyGradientFrom: '#12101e', bodyGradientTo: '#191724',
      accentText: '#191724', muted: '#555169',
      success: '#9ccfd8', error: '#eb6f92', warning: '#f6c177',
    }
  },
  // 9. Rose Pine Moon
  {
    id: 'rose-pine-moon', name: 'Ros\u00e9 Pine Moon', author: 'Ros\u00e9 Pine', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#ea9a97'),
      bg: '#232136', surface: '#2a273f', surfaceElevated: '#393552',
      border: 'rgba(144, 140, 170, .12)', borderSubtle: 'rgba(144, 140, 170, .06)',
      hover: '#423e5c',
      textPrimary: '#e0def4', textSecondary: '#908caa', textTertiary: '#6e6a86',
      inputBg: '#1b192e', codeBg: '#1b192e', codeInlineBg: '#393552',
      glassBg: 'rgba(35, 33, 54, .85)', glassBorder: 'rgba(234, 154, 151, .15)',
      glassShadow: '0 8px 32px rgba(15, 13, 34, .5)',
      accentGlow: 'rgba(234, 154, 151, .15)', accentGlowStrong: 'rgba(234, 154, 151, .3)',
      bodyGradientFrom: '#1c1a2e', bodyGradientTo: '#232136',
      accentText: '#232136', muted: '#555169',
      success: '#9ccfd8', error: '#eb6f92', warning: '#f6c177',
    }
  },
  // 10. Nord
  {
    id: 'nord', name: 'Nord', author: 'Arctic Ice Studio', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#88c0d0'),
      bg: '#2e3440', surface: '#3b4252', surfaceElevated: '#434c5e',
      border: 'rgba(216, 222, 233, .12)', borderSubtle: 'rgba(216, 222, 233, .06)',
      hover: '#4c566a',
      textPrimary: '#eceff4', textSecondary: '#d8dee9', textTertiary: '#a3b1c2',
      inputBg: '#272d38', codeBg: '#272d38', codeInlineBg: '#434c5e',
      glassBg: 'rgba(46, 52, 64, .85)', glassBorder: 'rgba(136, 192, 208, .15)',
      glassShadow: '0 8px 32px rgba(26, 32, 44, .5)',
      accentGlow: 'rgba(136, 192, 208, .15)', accentGlowStrong: 'rgba(136, 192, 208, .3)',
      bodyGradientFrom: '#272d38', bodyGradientTo: '#2e3440',
      accentText: '#2e3440', muted: '#7b8da0',
      success: '#a3be8c', error: '#bf616a', warning: '#ebcb8b',
    }
  },
  // 11. Dracula
  {
    id: 'dracula', name: 'Dracula', author: 'Zeno Rocha', type: 'dark', builtin: true,
    colors: {
      ...primaryScale('#bd93f9'),
      bg: '#282a36', surface: '#21222c', surfaceElevated: '#44475a',
      border: 'rgba(248, 248, 242, .12)', borderSubtle: 'rgba(248, 248, 242, .06)',
      hover: '#4d5068',
      textPrimary: '#f8f8f2', textSecondary: '#c0c0d0', textTertiary: '#6272a4',
      inputBg: '#1e1f29', codeBg: '#1e1f29', codeInlineBg: '#44475a',
      glassBg: 'rgba(40, 42, 54, .85)', glassBorder: 'rgba(189, 147, 249, .15)',
      glassShadow: '0 8px 32px rgba(20, 22, 34, .5)',
      accentGlow: 'rgba(189, 147, 249, .15)', accentGlowStrong: 'rgba(189, 147, 249, .3)',
      bodyGradientFrom: '#21222c', bodyGradientTo: '#282a36',
      accentText: '#282a36', muted: '#6272a4',
      success: '#50fa7b', error: '#ff5555', warning: '#f1fa8c',
    }
  },
  // 12. Rose Pine Dawn (light)
  {
    id: 'rose-pine-dawn', name: 'Ros\u00e9 Pine Dawn', author: 'Ros\u00e9 Pine', type: 'light', builtin: true,
    colors: {
      ...primaryScale('#d7827e'),
      bg: '#faf4ed', surface: '#fffaf3', surfaceElevated: '#f2e9e1',
      border: 'rgba(87, 82, 121, .12)', borderSubtle: 'rgba(87, 82, 121, .06)',
      hover: '#ebe4dc',
      textPrimary: '#575279', textSecondary: '#797593', textTertiary: '#9893a5',
      inputBg: '#f4ede5', codeBg: '#f4ede5', codeInlineBg: '#f2e9e1',
      glassBg: 'rgba(250, 244, 237, .9)', glassBorder: 'rgba(215, 130, 126, .15)',
      glassShadow: '0 8px 32px rgba(200, 190, 175, .3)',
      accentGlow: 'rgba(215, 130, 126, .12)', accentGlowStrong: 'rgba(215, 130, 126, .25)',
      bodyGradientFrom: '#f4ede5', bodyGradientTo: '#faf4ed',
      accentText: '#fffaf3', muted: '#b4b0c8',
      success: '#56949f', error: '#b4637a', warning: '#ea9d34',
    }
  },
  // 13. Catppuccin Latte (light)
  {
    id: 'catppuccin-latte', name: 'Catppuccin Latte', author: 'Catppuccin', type: 'light', builtin: true,
    colors: {
      ...primaryScale('#7287fd'),
      bg: '#eff1f5', surface: '#e6e9ef', surfaceElevated: '#ccd0da',
      border: 'rgba(92, 95, 119, .12)', borderSubtle: 'rgba(92, 95, 119, .06)',
      hover: '#c4c8d4',
      textPrimary: '#4c4f69', textSecondary: '#5c5f77', textTertiary: '#6c6f85',
      inputBg: '#dce0e8', codeBg: '#dce0e8', codeInlineBg: '#ccd0da',
      glassBg: 'rgba(239, 241, 245, .9)', glassBorder: 'rgba(114, 135, 253, .15)',
      glassShadow: '0 8px 32px rgba(172, 176, 190, .3)',
      accentGlow: 'rgba(114, 135, 253, .12)', accentGlowStrong: 'rgba(114, 135, 253, .25)',
      bodyGradientFrom: '#e6e9ef', bodyGradientTo: '#eff1f5',
      accentText: '#eff1f5', muted: '#9ca0b0',
      success: '#40a02b', error: '#d20f39', warning: '#df8e1d',
    }
  },
];

const palettesJson = JSON.stringify(PALETTES);

// ============================================================
// PART 1: MAIN PROCESS — PaletteManager + IPC handlers
// ============================================================

const mainPath = path.resolve(__dirname, '../out/main/index.js');
let main = fs.readFileSync(mainPath, 'utf-8');
const mainOrigLen = main.length;

// The IPC handlers are comma-chained expressions inside the if(k){...} block.
// We can't inject const/class into a comma expression. Instead:
// 1. Find ",c.ipcMain.handle("shell:openExternal"" — the comma before the anchor
// 2. Replace that comma with a semicolon to end the expression chain
// 3. Inject our const/class declarations as standalone statements
// 4. Then our IPC handlers as a new comma expression followed by a comma
// 5. Then c.ipcMain.handle("shell:openExternal" continues normally

const mainAnchorFull = ',c.ipcMain.handle("shell:openExternal"';
const mainAnchorIdx = main.indexOf(mainAnchorFull);
if (mainAnchorIdx === -1) throw new Error('Main anchor not found: ' + mainAnchorFull);

const mainInject =
`;/* PALETTE SYSTEM */` +
`const __PALETTES_BUILTIN=${palettesJson};` +
`class __PaletteManager{constructor(){this._cfg=null}` +
`_cfgPath(){return p.join(c.app.getPath("userData"),"palette-config.json")}` +
`_load(){if(this._cfg)return this._cfg;try{this._cfg=JSON.parse(require("fs").readFileSync(this._cfgPath(),"utf-8"))}catch(e){this._cfg={activeId:"midnight-blush",custom:[]}}return this._cfg}` +
`_save(){require("fs").writeFileSync(this._cfgPath(),JSON.stringify(this._cfg,null,2))}` +
`list(){const cfg=this._load();return[...__PALETTES_BUILTIN,...cfg.custom]}` +
`getActive(){const cfg=this._load();const all=this.list();return all.find(x=>x.id===cfg.activeId)||all[0]}` +
`setActive(id){const cfg=this._load();const all=this.list();const pal=all.find(x=>x.id===id);if(!pal)throw new Error("Palette not found: "+id);cfg.activeId=id;this._save();const wins=c.BrowserWindow.getAllWindows();wins.forEach(w=>{try{w.webContents.send("palette:changed",pal)}catch(e){}});return pal}` +
`saveCustom(pal){const cfg=this._load();pal.builtin=false;pal.id=pal.id||("custom-"+Date.now());const idx=cfg.custom.findIndex(x=>x.id===pal.id);if(idx>=0)cfg.custom[idx]=pal;else cfg.custom.push(pal);this._save();return pal}` +
`deleteCustom(id){const cfg=this._load();cfg.custom=cfg.custom.filter(x=>x.id!==id);if(cfg.activeId===id)cfg.activeId="midnight-blush";this._save()}` +
`importPalette(json){let pal;try{pal=typeof json==="string"?JSON.parse(json):json}catch(e){throw new Error("Invalid JSON")}if(!pal.name||!pal.colors)throw new Error("Invalid palette format");pal.id="imported-"+Date.now();pal.builtin=false;return this.saveCustom(pal)}}` +
`const __pm=new __PaletteManager();` +
`c.ipcMain.handle("palette:list",async()=>{try{return{success:true,data:__pm.list()}}catch(e){return{success:false,error:e.message}}}),` +
`c.ipcMain.handle("palette:get-active",async()=>{try{return{success:true,data:__pm.getActive()}}catch(e){return{success:false,error:e.message}}}),` +
`c.ipcMain.handle("palette:set",async(t,id)=>{try{return{success:true,data:__pm.setActive(id)}}catch(e){return{success:false,error:e.message}}}),` +
`c.ipcMain.handle("palette:save-custom",async(t,pal)=>{try{return{success:true,data:__pm.saveCustom(pal)}}catch(e){return{success:false,error:e.message}}}),` +
`c.ipcMain.handle("palette:delete-custom",async(t,id)=>{try{__pm.deleteCustom(id);return{success:true}}catch(e){return{success:false,error:e.message}}}),` +
`c.ipcMain.handle("palette:import",async(t,json)=>{try{return{success:true,data:__pm.importPalette(json)}}catch(e){return{success:false,error:e.message}}})` +
`/* END PALETTE SYSTEM */,`;

// Replace the comma before shell:openExternal with: semicolon + declarations + IPC handlers + comma
main = main.substring(0, mainAnchorIdx) + mainInject + main.substring(mainAnchorIdx + 1);
fs.writeFileSync(mainPath, main, 'utf-8');
log(`  [1] Main process patched: PaletteManager + 6 IPC handlers (${mainOrigLen} -> ${main.length} bytes)`);

// ============================================================
// PART 2: PRELOAD — palette bridge namespace
// ============================================================

const preloadPath = path.resolve(__dirname, '../out/preload/index.js');
let preload = fs.readFileSync(preloadPath, 'utf-8');
const preloadOrigLen = preload.length;

const preloadAnchor = 'conversation:{export:(content,name)=>n.ipcRenderer.invoke("conversation:export",content,name)}});';
const preloadAnchorIdx = preload.indexOf(preloadAnchor);
if (preloadAnchorIdx === -1) throw new Error('Preload anchor not found');

const preloadReplace = 'conversation:{export:(content,name)=>n.ipcRenderer.invoke("conversation:export",content,name)},' +
  'palette:{' +
  'list:()=>n.ipcRenderer.invoke("palette:list"),' +
  'getActive:()=>n.ipcRenderer.invoke("palette:get-active"),' +
  'set:(id)=>n.ipcRenderer.invoke("palette:set",id),' +
  'saveCustom:(p)=>n.ipcRenderer.invoke("palette:save-custom",p),' +
  'deleteCustom:(id)=>n.ipcRenderer.invoke("palette:delete-custom",id),' +
  'import:(json)=>n.ipcRenderer.invoke("palette:import",json),' +
  'onChanged:(cb)=>{const h=(ev,p)=>cb(p);n.ipcRenderer.on("palette:changed",h);return()=>{n.ipcRenderer.removeListener("palette:changed",h)}}' +
  '}});';

preload = preload.substring(0, preloadAnchorIdx) + preloadReplace + preload.substring(preloadAnchorIdx + preloadAnchor.length);
fs.writeFileSync(preloadPath, preload, 'utf-8');
log(`  [2] Preload patched: palette bridge namespace (${preloadOrigLen} -> ${preload.length} bytes)`);

// ============================================================
// PART 3: RENDERER — Runtime palette engine (prepend)
// ============================================================

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let renderer = fs.readFileSync(rendererPath, 'utf-8');
const rendererOrigLen = renderer.length;

// The VAR_MAP maps palette color keys to CSS variable names
const VAR_MAP_JS = `{primary50:"--primary-50",primary100:"--primary-100",primary200:"--primary-200",primary300:"--primary-300",primary400:"--primary-400",primary500:"--primary-500",primary600:"--primary-600",primary700:"--primary-700",primary800:"--primary-800",primary900:"--primary-900",bg:"--dark-bg",surface:"--dark-surface",surfaceElevated:"--dark-surface-elevated",border:"--dark-border",borderSubtle:"--dark-border-subtle",hover:"--dark-hover",textPrimary:"--dark-text-primary",textSecondary:"--dark-text-secondary",textTertiary:"--dark-text-tertiary",inputBg:"--dark-input-bg",codeBg:"--dark-code-bg",codeInlineBg:"--dark-code-inline-bg",glassBg:"--glass-bg",glassBorder:"--glass-border",glassShadow:"--glass-shadow",accentGlow:"--accent-glow",accentGlowStrong:"--accent-glow-strong"}`;

const engineCode = `/* EveRo Palette Engine */
var __paletteCache={};
function __resolveColor(role){return __paletteCache[role]||null}
function __applyPalette(pal){if(!pal||!pal.colors)return;Object.assign(__paletteCache,pal.colors);var VM=${VAR_MAP_JS};var el=document.getElementById("evero-palette-override");if(!el){el=document.createElement("style");el.id="evero-palette-override";document.head.appendChild(el)}var css=":root{";var keys=Object.keys(VM);for(var i=0;i<keys.length;i++){var k=keys[i];if(pal.colors[k])css+=VM[k]+":"+pal.colors[k]+";"}css+="}";if(pal.colors.bodyGradientFrom&&pal.colors.bodyGradientTo){css+="body{background:linear-gradient(135deg,"+pal.colors.bodyGradientFrom+","+pal.colors.bodyGradientTo+")!important}"}el.textContent=css;document.documentElement.style.visibility="visible"}
function __derivePalette(c){function hx(h){var m=h.match(/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i);return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[0,0,0]}function rh(r,g,b){return"#"+[r,g,b].map(function(x){return Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,"0")}).join("")}function mx(c1,c2,t){var a=hx(c1),b=hx(c2);return rh(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t)}var ac=c.accent,bg=c.bg,sf=c.surface,tp=c.textPrimary,ts=c.textSecondary,bd=c.border;var ar=hx(ac),br=hx(bg),tr=hx(ts);var se=mx(sf,tp,0.08),hv=mx(sf,tp,0.12),ib=mx(bg,"#000000",0.08);return{primary50:mx(ac,"#ffffff",0.92),primary100:mx(ac,"#ffffff",0.82),primary200:mx(ac,"#ffffff",0.65),primary300:ac,primary400:mx(ac,"#000000",0.12),primary500:mx(ac,"#000000",0.25),primary600:mx(ac,"#000000",0.38),primary700:mx(ac,"#000000",0.52),primary800:mx(ac,"#000000",0.65),primary900:mx(ac,"#000000",0.78),bg:bg,surface:sf,surfaceElevated:se,border:"rgba("+tr[0]+","+tr[1]+","+tr[2]+",.12)",borderSubtle:"rgba("+tr[0]+","+tr[1]+","+tr[2]+",.06)",hover:hv,textPrimary:tp,textSecondary:ts,textTertiary:mx(ts,bg,0.35),inputBg:ib,codeBg:ib,codeInlineBg:se,glassBg:"rgba("+br[0]+","+br[1]+","+br[2]+",.85)",glassBorder:"rgba("+ar[0]+","+ar[1]+","+ar[2]+",.15)",glassShadow:"0 8px 32px rgba("+Math.max(0,br[0]-20)+","+Math.max(0,br[1]-20)+","+Math.max(0,br[2]-20)+",.5)",accentGlow:"rgba("+ar[0]+","+ar[1]+","+ar[2]+",.15)",accentGlowStrong:"rgba("+ar[0]+","+ar[1]+","+ar[2]+",.3)",bodyGradientFrom:mx(bg,"#000000",0.06),bodyGradientTo:bg,accentText:bg,muted:mx(ts,bg,0.5),success:"#4ade80",error:"#f87171",warning:"#fbbf24"}}
(function(){document.documentElement.style.visibility="hidden";function ready(){if(window.electronAPI&&window.electronAPI.palette){window.electronAPI.palette.getActive().then(function(res){if(res&&res.success&&res.data)__applyPalette(res.data);else document.documentElement.style.visibility="visible"}).catch(function(){document.documentElement.style.visibility="visible"});window.electronAPI.palette.onChanged(function(pal){__applyPalette(pal)})}else{document.documentElement.style.visibility="visible"}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();setTimeout(function(){document.documentElement.style.visibility="visible"},200)})();
`;

renderer = engineCode + renderer;
log(`  [3] Renderer engine prepended: __applyPalette, __resolveColor, __derivePalette`);

// ============================================================
// PART 4: RENDERER — Inline color replacements
// ============================================================

// Replace style property hex values with dynamic __resolveColor() calls
const inlineReplacements = [
  [':"#fffffe"', ':(__resolveColor("textPrimary")||"#fffffe")'],
  [':"#b8c1ec"', ':(__resolveColor("textSecondary")||"#b8c1ec")'],
  [':"#8892b8"', ':(__resolveColor("textTertiary")||"#8892b8")'],
  [':"#1e2440"', ':(__resolveColor("surface")||"#1e2440")'],
  [':"#1a1f3d"', ':(__resolveColor("inputBg")||"#1a1f3d")'],
  [':"#2a3157"', ':(__resolveColor("border")||"#2a3157")'],
  [':"#eebbc3"', ':(__resolveColor("accent")||"#eebbc3")'],
  [':"#232946"', ':(__resolveColor("accentText")||"#232946")'],
  [':"#6b7ead"', ':(__resolveColor("muted")||"#6b7ead")'],
];

let inlineCount = 0;
inlineReplacements.forEach(([old, rep]) => {
  const count = renderer.split(old).length - 1;
  if (count > 0) {
    renderer = renderer.replaceAll(old, rep);
    inlineCount += count;
  }
});
log(`  [4] Replaced ${inlineCount} inline style hex values with __resolveColor()`);

// Replace hover event handler colors
const hoverReplacements = [
  ['e.currentTarget.style.background="#252c55"', 'e.currentTarget.style.background=__resolveColor("hover")||"#252c55"'],
  ['ev.currentTarget.style.background="#2a3157"', 'ev.currentTarget.style.background=__resolveColor("surfaceElevated")||"#2a3157"'],
  ['ev.currentTarget.style.background="transparent"', 'ev.currentTarget.style.background="transparent"'],  // keep as-is
  ['e.currentTarget.style.background="#1a1f3d"', 'e.currentTarget.style.background=__resolveColor("inputBg")||"#1a1f3d"'],
];

let hoverCount = 0;
hoverReplacements.forEach(([old, rep]) => {
  if (old === rep) return; // skip no-op
  const count = renderer.split(old).length - 1;
  if (count > 0) {
    renderer = renderer.replaceAll(old, rep);
    hoverCount += count;
  }
});
log(`  [5] Replaced ${hoverCount} hover handler colors`);

// Replace border strings
const borderReplacements = [
  ['"1px solid #2a3157"', '"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157")'],
  ['"1px solid #1e2440"', '"1px solid "+(__resolveColor("surface")||"#1e2440")'],
];

let borderCount = 0;
borderReplacements.forEach(([old, rep]) => {
  const count = renderer.split(old).length - 1;
  if (count > 0) {
    renderer = renderer.replaceAll(old, rep);
    borderCount += count;
  }
});
log(`  [6] Replaced ${borderCount} border string literals`);

// Replace boxShadow rgba with dynamic values
const shadowOld = '"0 8px 24px rgba(18,22,41,0.6)"';
const shadowNew = '"0 8px 24px rgba(0,0,0,0.4)"';
if (renderer.includes(shadowOld)) {
  renderer = renderer.replaceAll(shadowOld, shadowNew);
  log('  [6b] Updated box-shadow rgba');
}

// ============================================================
// PART 5: RENDERER — Palette picker UI
// ============================================================

// Build the palette picker IIFE as a string
const palettePicker = `E.jsx((function(){` +
  `var _s=W.useState,_e=W.useEffect;` +
  `var _r=_s(false),showP=_r[0],setP=_r[1];` +
  `var _p=_s([]),pals=_p[0],setPals=_p[1];` +
  `var _a=_s(""),actId=_a[0],setAct=_a[1];` +
  `var _cm=_s(false),custMode=_cm[0],setCustMode=_cm[1];` +
  `var _cn=_s("My Theme"),custName=_cn[0],setCustName=_cn[1];` +
  `var _cc=_s({bg:"#232946",surface:"#1e2440",textPrimary:"#fffffe",textSecondary:"#b8c1ec",accent:"#eebbc3",border:"#2a3157"}),custC=_cc[0],setCustC=_cc[1];` +
  `_e(function(){if(showP){` +
    `window.electronAPI.palette.list().then(function(r){if(r&&r.success)setPals(r.data)});` +
    `window.electronAPI.palette.getActive().then(function(r){if(r&&r.success)setAct(r.data.id)})` +
  `}},[showP]);` +
  `var selPal=function(id){window.electronAPI.palette.set(id).then(function(r){if(r&&r.success)setAct(id)})};` +
  `var saveCust=function(){` +
    `var d=window.__derivePalette(custC);` +
    `var pal={name:custName,type:"dark",colors:d};` +
    `window.electronAPI.palette.saveCustom(pal).then(function(r){` +
      `if(r&&r.success){setAct(r.data.id);setPals(function(prev){return prev.filter(function(x){return x.id!==r.data.id}).concat([r.data])});setCustMode(false)}` +
    `})};` +
  `var delCust=function(id){window.electronAPI.palette.deleteCustom(id).then(function(){setPals(function(prev){return prev.filter(function(x){return x.id!==id})})})};` +
  `var doImport=function(){` +
    `var inp=document.createElement("input");inp.type="file";inp.accept=".json";` +
    `inp.onchange=function(){var f=inp.files[0];if(!f)return;var rd=new FileReader();` +
    `rd.onload=function(){window.electronAPI.palette.import(rd.result).then(function(r){` +
      `if(r&&r.success){setPals(function(prev){return prev.concat([r.data])});setAct(r.data.id)}` +
    `})};rd.readAsText(f)};inp.click()};` +
  `var doExportPal=function(){` +
    `var cur=pals.find(function(x){return x.id===actId});if(!cur)return;` +
    `var blob=new Blob([JSON.stringify(cur,null,2)],{type:"application/json"});` +
    `var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=cur.id+".json";a.click()};` +
  // Swatch helper
  `var swatch=function(colors){return E.jsx("div",{style:{display:"flex",height:"16px",borderRadius:"4px",overflow:"hidden",marginBottom:"3px"},` +
    `children:[colors.bg,colors.surface,colors.accent||colors.primary300,colors.textPrimary,colors.textSecondary].map(function(c,i){` +
    `return E.jsx("div",{style:{flex:1,background:c}},String(i))})})};` +
  // Card helper
  `var card=function(p,showDel){return E.jsxs("div",{onClick:function(){selPal(p.id)},` +
    `style:{cursor:"pointer",borderRadius:"8px",border:p.id===actId?"2px solid "+(__resolveColor("accent")||"#eebbc3"):"2px solid transparent",padding:"4px",background:p.colors.bg,position:"relative"},` +
    `children:[swatch(p.colors),` +
    `E.jsx("div",{style:{fontSize:"9px",color:p.colors.textPrimary,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:p.name}),` +
    `showDel?E.jsx("button",{onClick:function(ev){ev.stopPropagation();delCust(p.id)},style:{position:"absolute",top:"1px",right:"3px",background:"none",border:"none",color:p.colors.textTertiary||"#888",cursor:"pointer",fontSize:"10px",lineHeight:"1"},children:"\\u00d7"}):null` +
  `]},p.id)};` +
  // Return JSX
  `return E.jsxs("div",{style:{position:"relative"},children:[` +
    // Theme button
    `E.jsxs("button",{onClick:function(){setP(!showP)},` +
    `style:{padding:"4px 10px",borderRadius:"6px",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),` +
    `background:__resolveColor("surface")||"#1e2440",color:__resolveColor("textSecondary")||"#b8c1ec",cursor:"pointer",fontSize:"12px",display:"flex",alignItems:"center",gap:"4px"},` +
    `children:[E.jsx("svg",{width:12,height:12,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,children:E.jsx("path",{d:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"})}),` +
    `"Theme"]}),` +
    // Panel
    `showP&&E.jsxs("div",{style:{position:"absolute",right:0,top:"100%",marginTop:"4px",` +
    `background:__resolveColor("surface")||"#1e2440",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),` +
    `borderRadius:"12px",padding:"12px",width:"340px",zIndex:200,` +
    `boxShadow:"0 12px 40px rgba(0,0,0,0.5)",maxHeight:"480px",overflowY:"auto"},` +
    `children:[` +
      // Title + close
      `E.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"},children:[` +
        `E.jsx("div",{style:{color:__resolveColor("textPrimary")||"#fffffe",fontSize:"13px",fontWeight:600},children:"Color Themes"}),` +
        `E.jsxs("div",{style:{display:"flex",gap:"4px"},children:[` +
          `E.jsx("button",{onClick:doExportPal,title:"Export current theme",style:{background:"none",border:"none",color:__resolveColor("textTertiary")||"#8892b8",cursor:"pointer",fontSize:"11px"},children:"\\u2913"}),` +
          `E.jsx("button",{onClick:function(){setP(false)},style:{background:"none",border:"none",color:__resolveColor("textTertiary")||"#8892b8",cursor:"pointer",fontSize:"14px"},children:"\\u00d7"})` +
        `]})` +
      `]}),` +
      // Builtin palette grid
      `E.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"8px"},` +
      `children:pals.filter(function(p){return p.builtin}).map(function(p){return card(p,false)})}),` +
      // Custom palettes
      `pals.filter(function(p){return!p.builtin}).length>0&&E.jsxs("div",{style:{marginBottom:"8px"},children:[` +
        `E.jsx("div",{style:{color:__resolveColor("textTertiary")||"#8892b8",fontSize:"10px",marginBottom:"4px",textTransform:"uppercase",letterSpacing:"0.5px"},children:"Custom"}),` +
        `E.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"},` +
        `children:pals.filter(function(p){return!p.builtin}).map(function(p){return card(p,true)})})` +
      `]}),` +
      // Create custom + Import buttons
      `!custMode&&E.jsxs("div",{style:{display:"flex",gap:"4px"},children:[` +
        `E.jsx("button",{onClick:function(){setCustMode(true)},style:{flex:1,padding:"5px",borderRadius:"6px",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),background:"transparent",color:__resolveColor("textSecondary")||"#b8c1ec",cursor:"pointer",fontSize:"10px"},children:"+ Create"}),` +
        `E.jsx("button",{onClick:doImport,style:{flex:1,padding:"5px",borderRadius:"6px",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),background:"transparent",color:__resolveColor("textSecondary")||"#b8c1ec",cursor:"pointer",fontSize:"10px"},children:"Import"})` +
      `]}),` +
      // Custom palette editor
      `custMode&&E.jsxs("div",{style:{borderTop:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),paddingTop:"8px",marginTop:"4px"},children:[` +
        `E.jsx("input",{value:custName,onChange:function(ev){setCustName(ev.target.value)},placeholder:"Theme name",` +
        `style:{width:"100%",padding:"4px 8px",borderRadius:"4px",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),` +
        `background:__resolveColor("inputBg")||"#1a1f3d",color:__resolveColor("textPrimary")||"#fffffe",fontSize:"11px",marginBottom:"6px",boxSizing:"border-box"}}),` +
        `E.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"6px"},` +
        `children:["bg","surface","textPrimary","textSecondary","accent","border"].map(function(key){` +
          `return E.jsxs("label",{style:{display:"flex",alignItems:"center",gap:"3px",fontSize:"9px",color:__resolveColor("textTertiary")||"#8892b8",cursor:"pointer"},children:[` +
            `E.jsx("input",{type:"color",value:custC[key],onChange:function(ev){setCustC(function(prev){var n={};for(var k in prev)n[k]=prev[k];n[key]=ev.target.value;return n})},` +
            `style:{width:"18px",height:"18px",border:"none",padding:0,cursor:"pointer",borderRadius:"3px"}}),` +
            `key` +
          `]},key)})}),` +
        // Preview strip
        `E.jsx("div",{style:{display:"flex",height:"20px",borderRadius:"4px",overflow:"hidden",marginBottom:"6px"},` +
        `children:[custC.bg,custC.surface,custC.accent,custC.textPrimary,custC.textSecondary].map(function(c,i){` +
          `return E.jsx("div",{style:{flex:1,background:c}},String(i))})}),` +
        // Save/Cancel
        `E.jsxs("div",{style:{display:"flex",gap:"4px"},children:[` +
          `E.jsx("button",{onClick:saveCust,style:{flex:1,padding:"5px",borderRadius:"6px",background:__resolveColor("accent")||"#eebbc3",color:__resolveColor("accentText")||"#232946",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:600},children:"Save Theme"}),` +
          `E.jsx("button",{onClick:function(){setCustMode(false)},style:{flex:1,padding:"5px",borderRadius:"6px",border:"1px solid "+(__resolveColor("surfaceElevated")||"#2a3157"),background:"transparent",color:__resolveColor("textSecondary")||"#b8c1ec",cursor:"pointer",fontSize:"10px"},children:"Cancel"})` +
        `]})` +
      `]})` +
    `]})` +
  `]})` +
`})(),{})`;

// Find the export button IIFE and wrap it with the palette button in a flex container
const exportIifeStart = 'E.jsx((function(){const[showMenu,setMenu]=W.useState(false);const doExport=(fmt)=>{';
const exportIifeStartIdx = renderer.indexOf(exportIifeStart);
if (exportIifeStartIdx === -1) {
  log('  WARNING: Export IIFE anchor not found — palette button not injected');
} else {
  // Wrap: E.jsx(exportIIFE) → E.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[E.jsx(exportIIFE), paletteIIFE]})
  // Replace start
  renderer = renderer.substring(0, exportIifeStartIdx) +
    'E.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[' +
    exportIifeStart +
    renderer.substring(exportIifeStartIdx + exportIifeStart.length);

  // Find the end: the export IIFE closes with })(),{}) followed by ]}) closing the header children
  // After wrapping, we need to find the export IIFE end and add the palette picker + close the wrapper
  const exportEndMarker = '})(),{})]}),E.jsx("div",{className:"flex-1 overflow-hidden"';
  const exportEndIdx = renderer.indexOf(exportEndMarker);
  if (exportEndIdx === -1) {
    log('  WARNING: Export IIFE end anchor not found');
  } else {
    // Replace: })(),{})]}),E.jsx(... → })(),{}),PALETTE_PICKER]})]}),E.jsx(...
    renderer = renderer.substring(0, exportEndIdx) +
      '})(),{}),' + palettePicker + ']})]}),E.jsx("div",{className:"flex-1 overflow-hidden"' +
      renderer.substring(exportEndIdx + exportEndMarker.length);
    log('  [7] Palette picker UI injected into chat header');
  }
}

fs.writeFileSync(rendererPath, renderer, 'utf-8');
log(`  Renderer: ${rendererOrigLen} -> ${renderer.length} bytes`);

// ============================================================
// PART 6: VERIFICATION
// ============================================================

log('');
log('Verification:');

const vMain = fs.readFileSync(mainPath, 'utf-8');
const vPreload = fs.readFileSync(preloadPath, 'utf-8');
const vRenderer = fs.readFileSync(rendererPath, 'utf-8');

const checks = [
  // Main process
  ['Main: __PaletteManager class', vMain.includes('class __PaletteManager')],
  ['Main: palette:list IPC', vMain.includes('"palette:list"')],
  ['Main: palette:get-active IPC', vMain.includes('"palette:get-active"')],
  ['Main: palette:set IPC', vMain.includes('"palette:set"')],
  ['Main: palette:save-custom IPC', vMain.includes('"palette:save-custom"')],
  ['Main: palette:delete-custom IPC', vMain.includes('"palette:delete-custom"')],
  ['Main: palette:import IPC', vMain.includes('"palette:import"')],
  ['Main: palette-config.json path', vMain.includes('palette-config.json')],
  ['Main: midnight-blush default', vMain.includes('"midnight-blush"')],
  // Preload
  ['Preload: palette namespace', vPreload.includes('palette:{')],
  ['Preload: palette.onChanged', vPreload.includes('palette:changed')],
  ['Preload: palette.list bridge', vPreload.includes('"palette:list"')],
  // Renderer
  ['Renderer: evero-palette-override style', vRenderer.includes('evero-palette-override')],
  ['Renderer: __applyPalette function', vRenderer.includes('function __applyPalette')],
  ['Renderer: __resolveColor function', vRenderer.includes('function __resolveColor')],
  ['Renderer: __derivePalette function', vRenderer.includes('function __derivePalette')],
  ['Renderer: palette picker UI', vRenderer.includes('Color Themes')],
  ['Renderer: inline textPrimary replacement', vRenderer.includes('__resolveColor("textPrimary")')],
  ['Renderer: inline accent replacement', vRenderer.includes('__resolveColor("accent")')],
  ['Renderer: Theme button', vRenderer.includes('"Theme"')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

log('');
if (allPass) {
  log('All palette system checks passed!');
} else {
  log('WARNING: Some checks failed!');
}
