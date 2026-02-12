/**
 * Color palette patch for EveRo v1.0.92-win
 *
 * Transforms the default dark-purple/violet theme to a deep navy/soft-pink palette.
 *
 * New palette:
 *   Background: #232946 (deep navy)
 *   Headline:   #fffffe (white)
 *   Paragraph:  #b8c1ec (soft lavender)
 *   Button:     #eebbc3 (soft pink)
 *   Button text:#232946 (matching background)
 *   Stroke:     #121629 (darker navy)
 *   Highlight:  #eebbc3 (soft pink)
 *
 * Patches applied:
 * 1. CSS: Custom property values in :root
 * 2. CSS: Body gradient and hardcoded hex colors
 * 3. CSS: Tailwind utility class color values
 * 4. Renderer JS: Hardcoded inline style colors
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-color-palette] ${msg}`);
}

log('Applying color palette patch...');

// ============================================================
// PART 1: CSS - Replace custom properties and hardcoded colors
// ============================================================

const cssPath = path.resolve(__dirname, '../out/renderer/assets/index-CDjYEUtK.css');
let css = fs.readFileSync(cssPath, 'utf-8');
const cssOrigLen = css.length;

// 1a: Replace CSS custom properties in :root
const cssVarReplacements = [
  // Primary color scale: purple → soft pink
  ['--primary-50: #faf5ff', '--primary-50: #fff5f7'],
  ['--primary-100: #f3e8ff', '--primary-100: #fde8ec'],
  ['--primary-200: #e9d5ff', '--primary-200: #f8d0d7'],
  ['--primary-300: #d8b4fe', '--primary-300: #eebbc3'],
  ['--primary-400: #c084fc', '--primary-400: #e8a5af'],
  ['--primary-500: #a855f7', '--primary-500: #d4899a'],
  ['--primary-600: #9333ea', '--primary-600: #c07080'],
  ['--primary-700: #7c3aed', '--primary-700: #a85a6a'],
  ['--primary-800: #6b21a8', '--primary-800: #8a4555'],
  ['--primary-900: #581c87', '--primary-900: #6d3545'],
  // Dark theme: dark purple/black → deep navy
  ['--dark-bg: #0f0f12', '--dark-bg: #232946'],
  ['--dark-surface: #131316', '--dark-surface: #1e2440'],
  ['--dark-surface-elevated: #1a1a1d', '--dark-surface-elevated: #2a3157'],
  ['--dark-border: rgba(255, 255, 255, .08)', '--dark-border: rgba(184, 193, 236, .12)'],
  ['--dark-border-subtle: rgba(255, 255, 255, .04)', '--dark-border-subtle: rgba(184, 193, 236, .06)'],
  ['--dark-hover: #27272a', '--dark-hover: #303767'],
  // Text
  ['--dark-text-primary: #fafafa', '--dark-text-primary: #fffffe'],
  ['--dark-text-secondary: #a1a1aa', '--dark-text-secondary: #b8c1ec'],
  ['--dark-text-tertiary: #71717a', '--dark-text-tertiary: #8892b8'],
  // Input & code
  ['--dark-input-bg: #27272a', '--dark-input-bg: #1a1f3d'],
  ['--dark-code-bg: #0f0f12', '--dark-code-bg: #1a1f3d'],
  ['--dark-code-inline-bg: #27272a', '--dark-code-inline-bg: #2a3157'],
  // Glass
  ['--glass-bg: rgba(24, 24, 27, .8)', '--glass-bg: rgba(35, 41, 70, .85)'],
  ['--glass-border: rgba(255, 255, 255, .1)', '--glass-border: rgba(238, 187, 195, .15)'],
  ['--glass-shadow: 0 8px 32px rgba(0, 0, 0, .4)', '--glass-shadow: 0 8px 32px rgba(18, 22, 41, .5)'],
  // Accent glow: purple → soft pink
  ['--accent-glow: rgba(168, 85, 247, .15)', '--accent-glow: rgba(238, 187, 195, .15)'],
  ['--accent-glow-strong: rgba(168, 85, 247, .3)', '--accent-glow-strong: rgba(238, 187, 195, .3)'],
];

let cssVarCount = 0;
cssVarReplacements.forEach(([old, rep]) => {
  if (css.includes(old)) {
    css = css.replace(old, rep);
    cssVarCount++;
  }
});
log(`  [1] Replaced ${cssVarCount}/${cssVarReplacements.length} CSS custom properties`);

// 1b: Body gradient
css = css.replace(
  'background:linear-gradient(135deg,#1a1025,#1f1530)',
  'background:linear-gradient(135deg,#1a2040,#232946)'
);
log('  [2] Updated body gradient');

// 1c: Hardcoded Tailwind utility colors
// These are the bg-[#hex], border-[#hex], from-[#hex], etc. classes
const cssHexReplacements = [
  // bg-[#131316] → bg-[#1e2440]
  ['background-color:rgb(19 19 22', 'background-color:rgb(30 36 64'],
  // bg-[#a855f7] → bg-[#eebbc3]
  ['background-color:rgb(168 85 247', 'background-color:rgb(238 187 195'],
  // bg-[#a855f7]/10 etc
  ['background-color:#a855f71a', 'background-color:#eebbc31a'],
  ['background-color:#a855f726', 'background-color:#eebbc326'],
  ['background-color:#a855f733', 'background-color:#eebbc333'],
  // border-[#1a1025]
  ['border-color:rgb(26 16 37', 'border-color:rgb(26 32 64'],
  // border-[#a855f7]/50
  ['border-color:#a855f780', 'border-color:#eebbc380'],
  // border-[#c084fc]/50
  ['border-color:#c084fc80', 'border-color:#e8a5af80'],
  // from-[#1a1025] gradient
  ['--tw-gradient-from: #1a1025', '--tw-gradient-from: #1a2040'],
  ['rgb(26 16 37 / 0)', 'rgb(26 32 64 / 0)'],
  // via-[#1f1530]
  ['#1f1530 var(--tw-gradient-via-position)', '#232946 var(--tw-gradient-via-position)'],
  // to-[#1a1025]
  ['--tw-gradient-to: #1a1025', '--tw-gradient-to: #1a2040'],
  // purple → pink in gradients
  ['rgb(147 51 234 / .2)', 'rgb(238 187 195 / .2)'],
  ['rgb(147 51 234 / 0)', 'rgb(238 187 195 / 0)'],
  // Accent colors in rings
  ['--tw-ring-color: rgb(168 85 247 / .3)', '--tw-ring-color: rgb(238 187 195 / .3)'],
  ['--tw-ring-color: rgb(192 132 252 / .6)', '--tw-ring-color: rgb(232 165 175 / .6)'],
  // Text colors
  ['color:rgb(192 132 252', 'color:rgb(232 165 175'],  // text-purple-400
  ['color:rgb(168 85 247', 'color:rgb(238 187 195'],    // text-purple-500 (via slack)
  // Hover bg purple → pink
  ['background-color:rgb(147 51 234', 'background-color:rgb(192 112 128'],  // hover:bg-[#9333ea], hover:bg-purple-600
  ['background-color:rgb(126 34 206', 'background-color:rgb(168 90 106'],   // hover:bg-purple-700
  // Focus ring
  ['--tw-ring-color: rgb(168 85 247 / .5)', '--tw-ring-color: rgb(238 187 195 / .5)'],
  // conic-gradient in spinning border
  ['#a855f7 50%', '#eebbc3 50%'],
  // pulse-border green → pink
  ['outline-color:#0f0', 'outline-color:#eebbc3'],
  ['outline-color:#22c55e', 'outline-color:#d4899a'],
  ['outline:2px solid lime', 'outline:2px solid #eebbc3'],
  // hljs background
  ['background:#1e1e1e', 'background:#1a1f3d'],
  // ghmd link color fallback
  ['var(--primary-400, #c084fc)', 'var(--primary-400, #e8a5af)'],
];

let cssHexCount = 0;
cssHexReplacements.forEach(([old, rep]) => {
  if (css.includes(old)) {
    css = css.replaceAll(old, rep);
    cssHexCount++;
  }
});
log(`  [3] Replaced ${cssHexCount} hardcoded color values in CSS`);

fs.writeFileSync(cssPath, css, 'utf-8');
log(`  CSS: ${cssOrigLen} -> ${css.length} bytes`);

// ============================================================
// PART 2: RENDERER JS - Replace inline style colors
// ============================================================

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let render = fs.readFileSync(rendererPath, 'utf-8');
const renderOrigLen = render.length;

// Replace inline style hex colors in our injected components (model-hub, agent-model-picker)
// and any hardcoded colors in the original renderer
const jsColorReplacements = [
  // Grays used in inline styles → navy palette equivalents
  ['#374151', '#2a3157'],  // borders (gray-700 → navy border)
  ['#1f2937', '#1e2440'],  // dark surface borders (gray-800 → navy surface)
  ['#111827', '#1a1f3d'],  // dark bg (gray-900 → dark navy)
  ['#e2e8f0', '#fffffe'],  // light text → headline white
  ['#9ca3af', '#b8c1ec'],  // secondary text → paragraph lavender
  ['#6b7280', '#8892b8'],  // muted text → muted lavender
  ['#4b5563', '#6b7ead'],  // very muted → slightly muted navy
  ['#1a2332', '#252c55'],  // hover darker → navy hover
];

let jsCount = 0;
jsColorReplacements.forEach(([old, rep]) => {
  const count = render.split(old).length - 1;
  if (count > 0) {
    render = render.replaceAll(old, rep);
    jsCount += count;
  }
});
log(`  [4] Replaced ${jsCount} inline color values in renderer JS`);

// Replace the accent blue (#3b82f6) used in model-hub Pull button → soft pink
// Only replace in inline style contexts (not in Tailwind class definitions)
// Actually #3b82f6 appears in both CSS classes and our injected code
// The CSS classes are handled by the CSS patch above
// In the JS, it's used as: background:"#3b82f6" and borderColor="#3b82f6"
// We'll replace it in the JS too since these are our injected model-hub styles
render = render.replaceAll('"#3b82f6"', '"#eebbc3"');
log('  [5] Replaced accent blue with soft pink in JS inline styles');

// Fix Pull button text: was white on blue, now should be dark on pink
render = render.replaceAll(
  'background:"#eebbc3",color:"#fff"',
  'background:"#eebbc3",color:"#232946"'
);
log('  [6] Updated button text color for contrast');

fs.writeFileSync(rendererPath, render, 'utf-8');
log(`  Renderer JS: ${renderOrigLen} -> ${render.length} bytes`);

// ============================================================
// VERIFICATION
// ============================================================

log('');
log('Verification:');

const vCss = fs.readFileSync(cssPath, 'utf-8');
const vRender = fs.readFileSync(rendererPath, 'utf-8');

const checks = [
  // CSS custom properties
  ['CSS: --dark-bg is #232946', vCss.includes('--dark-bg: #232946')],
  ['CSS: --dark-surface is #1e2440', vCss.includes('--dark-surface: #1e2440')],
  ['CSS: --dark-text-primary is #fffffe', vCss.includes('--dark-text-primary: #fffffe')],
  ['CSS: --dark-text-secondary is #b8c1ec', vCss.includes('--dark-text-secondary: #b8c1ec')],
  ['CSS: --primary-300 is #eebbc3', vCss.includes('--primary-300: #eebbc3')],
  ['CSS: --primary-500 is #d4899a', vCss.includes('--primary-500: #d4899a')],
  ['CSS: accent glow is pink', vCss.includes('rgba(238, 187, 195, .15)')],
  ['CSS: body gradient is navy', vCss.includes('#1a2040,#232946')],
  ['CSS: glass bg is navy', vCss.includes('rgba(35, 41, 70, .85)')],
  ['CSS: no old purple primary (#a855f7) in vars', !vCss.includes('--primary-500: #a855f7')],
  ['CSS: no old dark-bg (#0f0f12)', !vCss.includes('--dark-bg: #0f0f12')],
  // JS inline styles
  ['JS: navy borders (#2a3157)', vRender.includes('#2a3157')],
  ['JS: navy surface (#1e2440)', vRender.includes('"#1e2440"')],
  ['JS: dark navy bg (#1a1f3d)', vRender.includes('"#1a1f3d"')],
  ['JS: headline text (#fffffe)', vRender.includes('"#fffffe"')],
  ['JS: lavender text (#b8c1ec)', vRender.includes('"#b8c1ec"')],
  ['JS: pink accent (#eebbc3)', vRender.includes('"#eebbc3"')],
  ['JS: button text on pink (#232946)', vRender.includes('color:"#232946"')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

log('');
if (allPass) {
  log('All color palette checks passed!');
} else {
  log('WARNING: Some checks failed!');
}
