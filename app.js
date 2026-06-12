'use strict';

/* ═══════════════════════ 墨韵 · 水墨绘制引擎 ═══════════════════════ */

const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
// 近似高斯分布，范围 -1..1，中心密集 —— 模拟笔毫聚锋
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
const lerp = (a, b, t) => a + (b - a) * t;
const IS_COARSE = matchMedia('(pointer: coarse)').matches;   // 触屏设备

const CANVAS_W = 1000, CANVAS_H = 1390;

/* ───────────── 文房定义 ───────────── */

const BRUSHES = [
  { id: 'gongbi', name: '狼毫', sub: '工笔', size: 8,   varia: 0.35, type: 'fine'    },
  { id: 'xieyi',  name: '羊毫', sub: '写意', size: 36,  varia: 0.9,  type: 'soft'    },
  { id: 'cunca',  name: '散锋', sub: '皴擦', size: 46,  varia: 0.7,  type: 'bristle' },
  { id: 'pomo',   name: '斗笔', sub: '泼墨', size: 104, varia: 0.5,  type: 'broad'   },
];

// 起收锋：起笔与提笔的粗细关系（全局运笔 + 停笔顺线共用）
const STROKE_TAPERS = [
  { id: 'out',   name: '收锋', sub: '渐细' },   // 先粗后细
  { id: 'in',    name: '入锋', sub: '渐粗' },   // 先细后粗
  { id: 'even',  name: '匀劲', sub: '均衡' },
  { id: 'belly', name: '鼓腹', sub: '中肥' },   // 两头细、中间粗
];

const SIZE_TIERS = [
  { id: 'nuo', name: '搦', sub: '细毫' },
  { id: 'bao', name: '饱', sub: '饱毫' },
  { id: 'kuo', name: '阔', sub: '阔笔' },
  { id: 'ju',  name: '巨', sub: '巨笔' },
];

// 每笔四档：size / varia / 戳印间距 / 流体注入 / 散锋簇密
const BRUSH_SIZE_TUNING = {
  gongbi: {
    nuo: { sizeMul: 0.5,  variaMul: 0.72, spacingMul: 0.88, depositMul: 0.42, bristleMul: 1    },
    bao: { sizeMul: 1,    variaMul: 1,    spacingMul: 1,    depositMul: 1,    bristleMul: 1    },
    kuo: { sizeMul: 1.42, variaMul: 0.9,  spacingMul: 1.06, depositMul: 1.12, bristleMul: 1    },
    ju:  { sizeMul: 1.88, variaMul: 0.82, spacingMul: 1.12, depositMul: 1.22, bristleMul: 1    },
  },
  xieyi: {
    nuo: { sizeMul: 0.52, variaMul: 0.78, spacingMul: 0.9,  depositMul: 0.62, bristleMul: 1    },
    bao: { sizeMul: 1,    variaMul: 1,    spacingMul: 1,    depositMul: 1,    bristleMul: 1    },
    kuo: { sizeMul: 1.48, variaMul: 1.06, spacingMul: 1.08, depositMul: 1.22, bristleMul: 1    },
    ju:  { sizeMul: 2.08, variaMul: 1.12, spacingMul: 1.14, depositMul: 1.48, bristleMul: 1    },
  },
  cunca: {
    nuo: { sizeMul: 0.52, variaMul: 0.82, spacingMul: 0.94, depositMul: 0.68, bristleMul: 0.82 },
    bao: { sizeMul: 1,    variaMul: 1,    spacingMul: 1,    depositMul: 1,    bristleMul: 1    },
    kuo: { sizeMul: 1.52, variaMul: 1.06, spacingMul: 1.1,  depositMul: 1.18, bristleMul: 1.18 },
    ju:  { sizeMul: 2.12, variaMul: 1.14, spacingMul: 1.18, depositMul: 1.38, bristleMul: 1.38 },
  },
  pomo: {
    nuo: { sizeMul: 0.55, variaMul: 0.86, spacingMul: 0.9,  depositMul: 0.72, bristleMul: 1    },
    bao: { sizeMul: 1,    variaMul: 1,    spacingMul: 1,    depositMul: 1,    bristleMul: 1    },
    kuo: { sizeMul: 1.5,  variaMul: 1.02, spacingMul: 1.1,  depositMul: 1.28, bristleMul: 1    },
    ju:  { sizeMul: 2.18, variaMul: 1.1,  spacingMul: 1.16, depositMul: 1.58, bristleMul: 1    },
  },
};

function brushProfile() {
  const b = state.brush;
  const tierId = state.sizeByBrush[b.id] || 'bao';
  const tune = BRUSH_SIZE_TUNING[b.id][tierId] || BRUSH_SIZE_TUNING[b.id].bao;
  return {
    ...b,
    tierId,
    size: b.size * tune.sizeMul,
    varia: b.varia * tune.variaMul,
    spacingMul: tune.spacingMul,
    depositMul: tune.depositMul,
    bristleMul: tune.bristleMul,
  };
}

const WETNESS = [
  { id: 'jiao',  name: '焦墨', alpha: 0.96, dry: 0.85, bleed: 0,    spread: 0    },
  { id: 'nong',  name: '浓墨', alpha: 0.84, dry: 0.3,  bleed: 0.15, spread: 0.08 },
  { id: 'zhong', name: '重墨', alpha: 0.68, dry: 0.15, bleed: 0.3,  spread: 0.15 },
  { id: 'run',   name: '润墨', alpha: 0.52, dry: 0.08, bleed: 0.45, spread: 0.22 },
  { id: 'dan',   name: '淡墨', alpha: 0.38, dry: 0.04, bleed: 0.6,  spread: 0.3  },
  { id: 'qingd', name: '轻墨', alpha: 0.26, dry: 0.02, bleed: 0.75, spread: 0.4  },
  { id: 'qing',  name: '清墨', alpha: 0.16, dry: 0,    bleed: 0.9,  spread: 0.5  },
  { id: 'yan',   name: '烟墨', alpha: 0.09, dry: 0,    bleed: 1,    spread: 0.6  },
];

const COLORS = [
  { id: 'xuanmo',    name: '玄墨', hex: '#23211e' },
  { id: 'daiqing',   name: '黛青', hex: '#3f4a5c' },
  { id: 'huaqing',   name: '花青', hex: '#2f5a70' },
  { id: 'zheshi',    name: '赭石', hex: '#8a4f2d' },
  { id: 'zhusha',    name: '朱砂', hex: '#a73a2a' },
  { id: 'tenghuang', name: '藤黄', hex: '#ad7e12' },
  { id: 'shilv',     name: '石绿', hex: '#43755f' },
  { id: 'jiangzi',   name: '绛紫', hex: '#6b3a4e' },
];

const PAPERS = [
  {
    id: 'yuban', name: '玉版宣', tint: '#f4eedd',
    // 细滑皮纸：肌理轻、纤维短，洇散克制
    tex: {
      wash: 0.07, cloud: 0, grain: 2200, mottle: 180, pulp: 0, gain: 1.55,
      fiber: 120, fiberLen: [6, 22], fiberWarm: 0.48,
      grainDark: 0.58, vignette: 0.048,
    },
    fluid: {
      bleedMul: 0.68, flowMul: 0.72, absorbMul: 0.78,
      permScale: 0.72, permCoarse: 52, permFine: 138,
      blockRate: 0.21, depositMul: 0.88,
    },
  },
  {
    id: 'fanggu', name: '仿古宣', tint: '#eadfc0',
    // 旧纸黄润：纤维可见，洇散适中
    tex: {
      wash: 0.16, cloud: 0, grain: 5000, mottle: 420, pulp: 58, gain: 1.5,
      fiber: 290, fiberLen: [12, 42], fiberWarm: 0.82,
      grainDark: 0.74, vignette: 0.1,
    },
    fluid: {
      bleedMul: 1.02, flowMul: 1.05, absorbMul: 1.05,
      permScale: 1.05, permCoarse: 38, permFine: 96,
      blockRate: 0.15, depositMul: 1.05,
    },
  },
  {
    id: 'chajian', name: '茶笺', tint: '#ddcaa9',
    // 粗松茶纸：絮团、暗点，吸墨强、洇散大
    tex: {
      wash: 0.26, cloud: 0, grain: 7600, mottle: 680, pulp: 210, gain: 1.55,
      fiber: 360, fiberLen: [14, 48], fiberWarm: 0.9,
      grainDark: 0.8, vignette: 0.12,
    },
    fluid: {
      bleedMul: 1.38, flowMul: 1.28, absorbMul: 1.32,
      permScale: 1.38, permCoarse: 28, permFine: 72,
      blockRate: 0.11, depositMul: 1.22,
    },
  },
  {
    id: 'yuebai', name: '月白笺', tint: '#e7ebe5',
    // 冷白绢感：云斑轻、纤维少，洇散略柔
    tex: {
      wash: 0.1, cloud: 20, grain: 1800, mottle: 160, pulp: 0, gain: 1.48,
      fiber: 88, fiberLen: [5, 18], fiberWarm: 0.22,
      grainDark: 0.48, vignette: 0.045,
    },
    fluid: {
      bleedMul: 0.82, flowMul: 0.86, absorbMul: 0.88,
      permScale: 0.82, permCoarse: 46, permFine: 124,
      blockRate: 0.17, depositMul: 0.92,
    },
  },
];

const NAMES = ['浣溪沙', '卜算子', '水调歌头', '临江仙', '念奴娇', '清平乐', '蝶恋花',
  '虞美人', '声声慢', '鹧鸪天', '青玉案', '定风波', '如梦令', '长相思',
  '空山新雨', '寒江独钓', '溪山行旅', '烟江叠嶂'];

// 预计算 RGB 与各通道吸光系数（颜料越深，吸光越强）
for (const c of COLORS) {
  const n = parseInt(c.hex.slice(1), 16);
  c.r = n >> 16 & 255; c.g = n >> 8 & 255; c.b = n & 255;
  c.kR = (1 - c.r / 255) * 1.7 + 0.05;
  c.kG = (1 - c.g / 255) * 1.7 + 0.05;
  c.kB = (1 - c.b / 255) * 1.7 + 0.05;
}
const parseTint = hex => {
  const n = parseInt(hex.slice(1), 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
};

function paperSeed(id) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

function makePaperRng(id, salt = 0) {
  let s = (paperSeed(id) + salt) >>> 0;
  const next = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    chance: p => next() < p,
  };
}

function paperTex(p = state.paper) { return p.tex; }
function paperFluid(p = state.paper) { return p.fluid; }

function tintShade(tint, dr, dg, db, a) {
  const t = parseTint(tint);
  return `rgba(${clamp(t.r + dr, 0, 255)},${clamp(t.g + dg, 0, 255)},${clamp(t.b + db, 0, 255)},${a})`;
}

// 墨级调制颜料：淡墨低饱和、高明度、融纸 —— 非线性设色（非 色×α 线性）
function pigmentForInk(color, wet, paperTint) {
  const t = clamp(wet.alpha, 0.05, 0.98);
  const paper = parseTint(paperTint);
  const chromatic = color.id !== 'xuanmo';

  const pigment = Math.pow(t, chromatic ? 0.62 : 0.8);
  const wash = 1 - pigment;

  let r = color.r, g = color.g, b = color.b;

  if (chromatic) {
    const lum = color.r * 0.31 + color.g * 0.55 + color.b * 0.14;
    const desatK = clamp(wash * 0.82 + wet.bleed * 0.12, 0, 0.9);
    r = lerp(color.r, lum, desatK);
    g = lerp(color.g, lum, desatK);
    b = lerp(color.b, lum, desatK);

    const paperK = Math.pow(wash, 0.55) * 0.85;
    r = lerp(r, paper.r, paperK);
    g = lerp(g, paper.g, paperK);
    b = lerp(b, paper.b, paperK);

    const lift = Math.pow(wash, 1.02) * 40;
    r = clamp(r + lift, 0, 248);
    g = clamp(g + lift, 0, 248);
    b = clamp(b + lift * 0.86, 0, 248);
  } else {
    const paperK = Math.pow(wash, 0.68) * 0.58;
    r = lerp(color.r, paper.r, paperK);
    g = lerp(color.g, paper.g, paperK);
    b = lerp(color.b, paper.b, paperK);
    const lift = Math.pow(wash, 1.15) * 20;
    r = clamp(r + lift, 0, 242);
    g = clamp(g + lift, 0, 242);
    b = clamp(b + lift, 0, 242);
  }

  return { r: r | 0, g: g | 0, b: b | 0, pigment, wash };
}

function pigmentCoeffs(color, wet, paperTint) {
  const p = pigmentForInk(color, wet, paperTint);
  return {
    kR: (1 - p.r / 255) * 1.7 + 0.05,
    kG: (1 - p.g / 255) * 1.7 + 0.05,
    kB: (1 - p.b / 255) * 1.7 + 0.05,
  };
}

const rgbaInk = (c, a) => {
  const p = pigmentForInk(c, state.wet, state.paper.tint);
  return `rgba(${p.r},${p.g},${p.b},${a})`;
};

const pigmentHex = c => {
  const p = pigmentForInk(c, state.wet, state.paper.tint);
  return `rgb(${p.r},${p.g},${p.b})`;
};

/* ───────────── 状态与画布 ───────────── */

const state = {
  brush: BRUSHES[1],
  strokeTaper: 'belly',
  sizeByBrush: { gongbi: 'bao', xieyi: 'bao', cunca: 'bao', pomo: 'bao' },
  wet: WETNESS[1],
  color: COLORS[0],
  paper: PAPERS[0],
  washing: false,
  painting: false,
  last: null,
  lastT: 0,
  vel: 0,
  stroke: null,
  editingId: null,
  unsaved: false,
  placing: null,
  qMid: null,
  holdRefine: true,   // 停笔顺线（狼毫 / 羊毫）
  pointerClient: null,
};

const view = $('#paper');
const vctx = view.getContext('2d');

const inkC = document.createElement('canvas');
inkC.width = CANVAS_W; inkC.height = CANVAS_H;
const ink = inkC.getContext('2d');

// 单笔缓冲：一笔先画在这里（笔内不自累积变深），
// 抬笔时整笔按墨级透明度压入墨层 —— 墨色梯度因此真实线性
const strokeC = document.createElement('canvas');
strokeC.width = CANVAS_W; strokeC.height = CANVAS_H;
const sctx = strokeC.getContext('2d');
let strokePending = false;

// 整笔压墨的透明度；淡彩 RGB 已水化，略抬低墨级透明度以免过薄
function strokeAlpha() {
  const { wet, color } = state;
  let base = wet.alpha * (1 - wet.bleed * 0.25);
  if (color.id !== 'xuanmo' && wet.alpha < 0.72) {
    base += Math.pow((0.72 - wet.alpha) / 0.72, 0.85) * 0.2;
  }
  return clamp(base, 0.04, 0.97);
}

function commitStroke() {
  if (!strokePending) return;
  ink.globalAlpha = strokeAlpha();
  ink.drawImage(strokeC, 0, 0);
  ink.globalAlpha = 1;
  sctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  strokePending = false;
  dirty = true;
}

const paperC = document.createElement('canvas');
paperC.width = CANVAS_W; paperC.height = CANVAS_H;
const pctx = paperC.getContext('2d');

const WASH_PAD = 18, WASH_MAX = 150;
const washTmp = document.createElement('canvas');
washTmp.width = washTmp.height = (WASH_MAX + WASH_PAD) * 2;
const wctx = washTmp.getContext('2d');
const FILTER_OK = typeof wctx.filter === 'string';

let dirty = true;

/* ───────────── 宣纸流体网格 ─────────────
   湿墨不再用规整圆形扩散，而是落入一张细胞网格：
   水沿"纸纤维渗透率场"向外渗流并携带颜料，
   渗透率的随机性形成不规则的指状洇散；
   多色颜料在格子里以吸光密度叠加，得到真实的减色混合。 */

const GRID_F = 4;                                  // 1 格 = 4px
const GW = Math.ceil(CANVAS_W / GRID_F);           // 250
const GH = Math.ceil(CANVAS_H / GRID_F);           // 348
const CELLS = GW * GH;

const water = new Float32Array(CELLS);             // 水量
const pigR = new Float32Array(CELLS);              // 游离颜料（随水流动）
const pigG = new Float32Array(CELLS);
const pigB = new Float32Array(CELLS);
const fixR = new Float32Array(CELLS);              // 固着颜料（已干入纸，不再流动）
const fixG = new Float32Array(CELLS);
const fixB = new Float32Array(CELLS);
const perm = new Float32Array(CELLS);              // 纸纤维渗透率
const inkAge = new Float32Array(CELLS);            // 墨层最近落墨时刻（秒），水洗随墨龄衰减

const fluidC = document.createElement('canvas');   // 网格渲染小图，放大合成时自带柔化
fluidC.width = GW; fluidC.height = GH;
const fctx = fluidC.getContext('2d');
const fimg = fctx.createImageData(GW, GH);

let fluidDirty = true;
let fluidFlip = false;
let fluidIdle = false;     // 纸面无水时跳过渗流扫描，省电省热

// 生成纤维渗透率场：双尺度纹理 + 细随机 + 致密阻滞点（共同产生指状洇散边缘）
function noiseLayer(cw, ch, rng) {
  const a = new Float32Array((cw + 1) * (ch + 1));
  for (let i = 0; i < a.length; i++) a[i] = rng.next();
  return (gx, gy) => {
    const fx = gx / GW * cw, fy = gy / GH * ch;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    return lerp(
      lerp(a[iy * (cw + 1) + ix], a[iy * (cw + 1) + ix + 1], tx),
      lerp(a[(iy + 1) * (cw + 1) + ix], a[(iy + 1) * (cw + 1) + ix + 1], tx), ty);
  };
}

function genPerm() {
  const pf = paperFluid();
  const rng = makePaperRng(state.paper.id, 91);
  const chRatio = CANVAS_H / CANVAS_W;
  const n1 = noiseLayer(pf.permCoarse, Math.max(4, Math.round(pf.permCoarse * chRatio)), rng);
  const n2 = noiseLayer(pf.permFine, Math.max(8, Math.round(pf.permFine * chRatio)), rng);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const v = n1(x, y) * 0.5 + n2(x, y) * 0.5;
      let p = (0.06 + v * 0.94) * rng.range(0.2, 1.8);
      p = p * p * 1.4 * pf.permScale;
      if (rng.chance(pf.blockRate)) p *= 0.05;
      perm[y * GW + x] = clamp(p, 0.015, 2.4);
    }
  }
}

function resetFluid() {
  water.fill(0); pigR.fill(0); pigG.fill(0); pigB.fill(0);
  fixR.fill(0); fixG.fill(0); fixB.fill(0);
  inkAge.fill(0);
  fluidDirty = true;
  fluidIdle = false;
}

// 墨龄 → 新鲜度：刚落的墨易被水打散，干透的墨咬纸难洗
function inkFreshness(x, y) {
  const cx = clamp((x / GRID_F) | 0, 1, GW - 2);
  const cy = clamp((y / GRID_F) | 0, 1, GH - 2);
  let t = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const v = inkAge[(cy + dy) * GW + cx + dx];
      if (v > t) t = v;
    }
  }
  if (!t) return 0;
  return clamp(1 - (performance.now() / 1000 - t) / 10, 0, 1);   // 约 10 秒干透
}

function markInkAge(x, y) {
  const cx = (x / GRID_F) | 0, cy = (y / GRID_F) | 0;
  if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return;
  inkAge[cy * GW + cx] = performance.now() / 1000;
}

// 落墨入纸：在网格中注入水与颜料
function deposit(x, y, r, strength) {
  const { wet, color } = state;
  if (wet.bleed <= 0 || strength <= 0) return;
  const pf = paperFluid();
  const gx = x / GRID_F, gy = y / GRID_F;
  const gr = Math.max(1.2, r / GRID_F);
  const x0 = Math.max(1, Math.floor(gx - gr)), x1 = Math.min(GW - 2, Math.ceil(gx + gr));
  const y0 = Math.max(1, Math.floor(gy - gr)), y1 = Math.min(GH - 2, Math.ceil(gy + gr));
  const wAmt = wet.bleed * 0.6 * strength * pf.bleedMul;
  const chromatic = color.id !== 'xuanmo';
  const coeff = pigmentCoeffs(color, wet, state.paper.tint);
  const dTarget = Math.pow(wet.alpha, chromatic ? 0.68 : 0.82) * 1.15 * Math.min(1, strength);
  const tR = dTarget * coeff.kR, tG = dTarget * coeff.kG, tB = dTarget * coeff.kB;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const dx = cx - gx, dy = cy - gy;
      const dist = Math.sqrt(dx * dx + dy * dy) / gr;
      if (dist > 1) continue;
      const i = cy * GW + cx;
      const fall = 1 - dist;
      water[i] = Math.min(2.5, water[i] + wAmt * fall * perm[i]);
      const rate = 0.16 * fall * (0.35 + 0.65 * Math.min(1, perm[i])) * pf.depositMul;
      if (pigR[i] < tR) pigR[i] += (tR - pigR[i]) * rate;
      if (pigG[i] < tG) pigG[i] += (tG - pigG[i]) * rate;
      if (pigB[i] < tB) pigB[i] += (tB - pigB[i]) * rate;
    }
  }
  fluidDirty = true;
  fluidIdle = false;
}

// 每帧渗流：水往低处与纤维疏松处走，颜料随水迁移（略滞后，干后边缘留痕）
function fluidStep() {
  if (fluidIdle) return;
  const pf = paperFluid();
  fluidFlip = !fluidFlip;
  let any = false;

  for (let yy = 1; yy < GH - 1; yy++) {
    const y = fluidFlip ? yy : GH - 1 - yy;
    const row = y * GW;
    for (let xx = 1; xx < GW - 1; xx++) {
      const x = fluidFlip ? xx : GW - 1 - xx;
      const i = row + x;
      let w = water[i];
      if (w < 0.002) continue;
      any = true;
      const cap = w * 0.15;

      let n = i - GW;
      for (let k = 0; k < 4; k++) {
        const dw = w - water[n];
        let f = (dw * 0.1 + w * 0.06) * perm[n] * pf.flowMul;
        if (f > 0) {
          if (f > cap) f = cap;
          const frac = (f / w) * 0.5;
          water[n] += f;
          const mR = pigR[i] * frac, mG = pigG[i] * frac, mB = pigB[i] * frac;
          pigR[i] -= mR; pigR[n] += mR;
          pigG[i] -= mG; pigG[n] += mG;
          pigB[i] -= mB; pigB[n] += mB;
          w -= f;
        }
        n = k === 0 ? i + 1 : k === 1 ? i + GW : i - 1;
      }
      const fr = w < 0.08 ? 0.025 * pf.absorbMul : 0.002 * pf.absorbMul;
      if (pigR[i] > 0) { const m = pigR[i] * fr; pigR[i] -= m; fixR[i] += m; }
      if (pigG[i] > 0) { const m = pigG[i] * fr; pigG[i] -= m; fixG[i] += m; }
      if (pigB[i] > 0) { const m = pigB[i] * fr; pigB[i] -= m; fixB[i] += m; }
      const evap = 0.0025 * pf.absorbMul;
      water[i] = Math.max(0, w * (1 - evap) - 0.0001 * pf.absorbMul);
    }
  }
  if (any) { fluidDirty = true; dirty = true; }
  else fluidIdle = true;
}

// 吸光密度 → 透射率（Beer-Lambert），乘法合成即真实减色混色
function renderFluid() {
  const d = fimg.data;
  for (let i = 0, j = 0; i < CELLS; i++, j += 4) {
    d[j] = 255 * Math.exp(-(pigR[i] + fixR[i]));
    d[j + 1] = 255 * Math.exp(-(pigG[i] + fixG[i]));
    d[j + 2] = 255 * Math.exp(-(pigB[i] + fixB[i]));
    d[j + 3] = 255;
  }
  fctx.putImageData(fimg, 0, 0);
}

// 将墨层与流体层压平为一张含透明度的墨图（存档 / 续画用）
function flattenInk() {
  const c = document.createElement('canvas');
  c.width = CANVAS_W; c.height = CANVAS_H;
  const x = c.getContext('2d');
  x.drawImage(inkC, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.imageSmoothingEnabled = true;
  x.drawImage(fluidC, 0, 0, CANVAS_W, CANVAS_H);
  return c;
}

/* ───────────── 宣纸纹理 ───────────── */

function paintPaper() {
  const paper = state.paper;
  const tex = paperTex(paper);
  const gain = tex.gain ?? 1.45;
  const rng = makePaperRng(paper.id, 17);
  const tint = paper.tint;

  pctx.fillStyle = tint;
  pctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 底色不均：纸面局部略深/略浅
  if (tex.wash > 0) {
    for (let i = 0; i < 24; i++) {
      const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
      const rad = rng.range(90, 320);
      const warm = rng.chance(tex.fiberWarm);
      const g = pctx.createRadialGradient(x, y, 0, x, y, rad);
      if (warm) {
        g.addColorStop(0, tintShade(tint, -22, -14, -32, tex.wash * 0.72 * gain));
        g.addColorStop(1, tintShade(tint, 0, 0, 0, 0));
      } else {
        g.addColorStop(0, tintShade(tint, 10, 10, 14, tex.wash * 0.58 * gain));
        g.addColorStop(1, tintShade(tint, 0, 0, 0, 0));
      }
      pctx.fillStyle = g;
      pctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  // 月白笺：大块柔云
  if (tex.cloud > 0) {
    for (let i = 0; i < tex.cloud; i++) {
      const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
      const rad = rng.range(130, 380);
      const g = pctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, tintShade(tint, 8, 12, 18, rng.range(0.06, 0.13) * gain));
      g.addColorStop(0.55, tintShade(tint, 3, 5, 10, rng.range(0.025, 0.05) * gain));
      g.addColorStop(1, tintShade(tint, 0, 0, 0, 0));
      pctx.fillStyle = g;
      pctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  // 纸絮团（茶笺等粗纸）
  for (let i = 0; i < tex.pulp; i++) {
    const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
    const rx = rng.range(5, 18), ry = rng.range(4, 13);
    const g = pctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, tintShade(tint, -28, -22, -16, rng.range(0.09, 0.2) * gain));
    g.addColorStop(0.7, tintShade(tint, -10, -8, -5, rng.range(0.035, 0.08) * gain));
    g.addColorStop(1, tintShade(tint, 0, 0, 0, 0));
    pctx.fillStyle = g;
    pctx.save();
    pctx.translate(x, y);
    pctx.rotate(rng.range(0, TAU));
    pctx.scale(1, ry / rx);
    pctx.beginPath();
    pctx.arc(0, 0, rx, 0, TAU);
    pctx.fill();
    pctx.restore();
  }

  // 中尺度斑驳（介于细颗粒与絮团之间，肉眼更易察觉）
  const mottle = tex.mottle ?? 0;
  for (let i = 0; i < mottle; i++) {
    const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
    const s = rng.range(2, 5.5);
    const dark = rng.chance(tex.grainDark);
    pctx.fillStyle = dark
      ? tintShade(tint, -48, -40, -30, rng.range(0.035, 0.11) * gain)
      : tintShade(tint, 14, 12, 8, rng.range(0.04, 0.12) * gain);
    pctx.fillRect(x, y, s, s * rng.range(0.75, 1.15));
  }

  // 细颗粒肌理
  for (let i = 0; i < tex.grain; i++) {
    const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
    const dark = rng.chance(tex.grainDark);
    if (dark) {
      pctx.fillStyle = tintShade(tint, -62, -52, -38, rng.range(0.022, 0.085) * gain);
    } else {
      pctx.fillStyle = tintShade(tint, 20, 18, 14, rng.range(0.03, 0.095) * gain);
    }
    pctx.fillRect(x, y, rng.range(0.6, 2.8), rng.range(0.6, 2.8));
  }

  // 纸纤维
  pctx.lineCap = 'round';
  const [fMin, fMax] = tex.fiberLen;
  for (let i = 0; i < tex.fiber; i++) {
    const x = rng.range(0, CANVAS_W), y = rng.range(0, CANVAS_H);
    const a = rng.range(0, TAU);
    const len = rng.range(fMin, fMax);
    const warm = rng.chance(tex.fiberWarm);
    pctx.strokeStyle = warm
      ? tintShade(tint, -48, -38, -24, rng.range(0.024, 0.072) * gain)
      : tintShade(tint, -22, -18, -28, rng.range(0.018, 0.058) * gain);
    pctx.lineWidth = rng.range(0.45, 1.15);
    pctx.beginPath();
    pctx.moveTo(x, y);
    pctx.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 + (rng.next() - 0.5) * 8,
      y + Math.sin(a) * len * 0.5 + (rng.next() - 0.5) * 8,
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    pctx.stroke();
  }

  // 四边微暗
  if (tex.vignette > 0) {
    const g = pctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, Math.min(CANVAS_W, CANVAS_H) * 0.42,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) * 0.75);
    g.addColorStop(0, tintShade(tint, -40, -32, -24, 0));
    g.addColorStop(1, tintShade(tint, -40, -32, -24, tex.vignette * gain));
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  dirty = true;
}

/* ───────────── 笔触引擎 ───────────── */

function strokeTaperApplies() {
  const t = brushProfile().type;
  return t === 'fine' || t === 'soft';
}

function strokeTaperMul(t) {
  if (!strokeTaperApplies()) return 1;
  const id = state.strokeTaper || 'belly';
  t = clamp(t, 0, 1);
  if (id === 'out') return lerp(0.96, 0.24, Math.pow(t, 0.82));
  if (id === 'in') return lerp(0.24, 0.96, Math.pow(t, 0.82));
  if (id === 'even') return 0.82;
  const s = Math.sin(Math.PI * t);
  return 0.26 + 0.74 * s * s;
}

function strokeStartWidthMul() {
  return strokeTaperApplies() ? strokeTaperMul(0) * 0.55 : 0.35;
}

function strokeTEstTotal(st) {
  const d = st.dist || 0;
  const brush = brushProfile();
  if (!st.estLen) st.estLen = Math.max(brush.size * 18, 48);
  if (d > st.estLen * 0.9) st.estLen = d / 0.9;
  return st.estLen;
}

function strokeTProg(st, extra = 0) {
  const dist = (st.dist || 0) + extra;
  return clamp(dist / strokeTEstTotal(st), 0, 1);
}

function finalizeStrokeLength(st) {
  if (!st) return;
  const d = st.dist || 0;
  if (d > 0) st.estLen = d;
}

function strokeWidth(vel) {
  const { wet } = state;
  const brush = brushProfile();
  const base = brush.size * (0.8 + wet.spread * 0.7);
  const f = clamp(1.15 - vel * 0.14 * brush.varia, 1 - brush.varia * 0.72, 1.18);
  return Math.max(1.2, base * f);
}

// 收笔出锋时的淡出系数（拖尾期间 < 1）
let strokeFade = 1;

// 单个墨点戳印：实心笔腹 + 柔和墨缘，沿运笔方向略拉长成笔锋
// 画入单笔缓冲，墨色深浅由 commitStroke 统一按墨级决定
function stamp(x, y, r, vel, ang = 0) {
  const { wet, color } = state;
  const brush = brushProfile();
  const dry = clamp(wet.dry + vel * 0.05 * brush.varia, 0, 0.95);
  const alpha = (brush.type === 'broad' ? 0.78 : 0.88) * strokeFade;

  // 枯笔断墨（工笔须线条连贯，不断墨）
  if (brush.type !== 'fine' && dry > 0.55 && Math.random() < dry * 0.3) return;

  // 墨体：中心实、边缘柔，是"墨"而非颗粒
  // 侧锋：墨心偏向一侧，一侧边缘重实、一侧轻虚，笔越粗越明显
  const a = alpha * (1 - dry * 0.55);
  if (a > 0.003) {
    const side = state.stroke ? state.stroke.side : 1;
    const sideK = clamp(0.2 + brush.size / 115, 0.22, 1) * side;
    const off = r * 0.32 * sideK;
    sctx.save();
    sctx.translate(x, y);
    sctx.rotate(ang);
    sctx.scale(1, 0.82);
    const g = sctx.createRadialGradient(0, off, 0, 0, off, r);
    g.addColorStop(0, rgbaInk(color, a));
    g.addColorStop(0.55, rgbaInk(color, a * 0.9));
    g.addColorStop(0.82, rgbaInk(color, a * 0.4));
    g.addColorStop(1, rgbaInk(color, 0));
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(0, 0, r, 0, TAU);
    sctx.fill();
    // 重边：侧锋一侧再压一道淡淡的实边
    const ea = a * 0.3 * Math.abs(sideK);
    if (ea > 0.004) {
      const eg = sctx.createRadialGradient(0, off * 1.9, 0, 0, off * 1.9, r * 0.55);
      eg.addColorStop(0, rgbaInk(color, ea));
      eg.addColorStop(1, rgbaInk(color, 0));
      sctx.fillStyle = eg;
      sctx.beginPath();
      sctx.arc(0, off * 1.9, r * 0.55, 0, TAU);
      sctx.fill();
    }
    sctx.restore();
  }

  // 颗粒只在偏枯时显现（飞白与纸纹），湿墨保持流畅墨体
  if (dry > 0.18) {
    const n = Math.round(r * dry * 5);
    sctx.fillStyle = pigmentHex(color);
    for (let i = 0; i < n; i++) {
      if (Math.random() < dry * 0.5) continue;
      const angr = rand(TAU), rr = Math.abs(gauss()) * r;
      sctx.globalAlpha = alpha * rand(0.15, 0.5);
      sctx.fillRect(x + Math.cos(angr) * rr, y + Math.sin(angr) * rr, rand(0.6, 1.6), rand(0.6, 1.6));
    }
    sctx.globalAlpha = 1;
  }
  strokePending = true;
  markInkAge(x, y);

  // 湿墨入纸：注入流体网格，由渗流形成不规则洇散
  // 细笔注水大减——线条须凝练干净，只余隐约洇意
  if (wet.bleed > 0) {
    const sizeK = brush.type === 'fine' ? 0.22 : brush.type === 'soft' ? 0.5 : 1;
    deposit(x + gauss() * r * 0.4, y + gauss() * r * 0.4, r * (0.8 + Math.random() * 0.5),
      (1 - dry) * (brush.type === 'broad' ? 1.4 : 1) * sizeK * brush.depositMul * strokeFade);
  }
}

// 散锋：一束分叉的笔毫
function makeBristles() {
  const { bristleMul } = brushProfile();
  const arr = [];
  const clumps = Math.max(2, Math.round((3 + (Math.random() * 2 | 0)) * bristleMul));
  for (let c = 0; c < clumps; c++) {
    const center = ((c + 0.5) / clumps * 2 - 1) * 0.72 + gauss() * 0.08;
    const hairs = Math.max(1, Math.round((2 + (Math.random() * 3 | 0)) * Math.sqrt(bristleMul)));
    for (let h = 0; h < hairs; h++) {
      arr.push({
        off: clamp(center + gauss() * 0.07, -0.85, 0.85),
        w: rand(0.5, 1.6),
        a: rand(0.35, 1),
        gap: Math.random() < 0.12,
      });
    }
  }
  return arr;
}

function drawBristles(p0, p1, w) {
  const { wet, color } = state;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;

  // 笔腹墨体：散锋中心一层极淡的墨，让笔毫连成"一笔"而非毛刷
  const midx = (p0.x + p1.x) / 2, midy = (p0.y + p1.y) / 2;
  const ba = 0.14 * strokeFade;
  const bg = sctx.createRadialGradient(midx, midy, 0, midx, midy, w * 0.5);
  bg.addColorStop(0, rgbaInk(color, ba));
  bg.addColorStop(1, rgbaInk(color, 0));
  sctx.fillStyle = bg;
  sctx.beginPath();
  sctx.arc(midx, midy, w * 0.5, 0, TAU);
  sctx.fill();

  const side = state.stroke.side || 1;
  sctx.lineCap = 'round';
  const ph = pigmentHex(color);
  sctx.strokeStyle = ph;
  sctx.fillStyle = ph;
  for (const b of state.stroke.bristles) {
    if (Math.random() < 0.03) b.gap = !b.gap;   // 笔毫起落
    if (b.gap) continue;
    if (Math.random() < 0.16) continue;         // 干擦的断续残痕
    const off = b.off * w * 0.5;
    const jx = gauss() * 0.5, jy = gauss() * 0.5;
    // 侧锋：一侧的笔毫吃墨重、另一侧轻擦
    const sideW = clamp(1 + b.off * side * 0.55, 0.35, 1.6);
    sctx.globalAlpha = 0.8 * b.a * sideW * rand(0.6, 1) * strokeFade;
    sctx.lineWidth = b.w * (0.55 + w * 0.04) * (0.8 + sideW * 0.25);
    sctx.beginPath();
    sctx.moveTo(p0.x + nx * off + jx, p0.y + ny * off + jy);
    sctx.lineTo(p1.x + nx * off + jx, p1.y + ny * off + jy);
    sctx.stroke();
    // 毫边碎墨：沿笔毫拖出细碎颗粒，皴擦的粗粝肌理
    if (Math.random() < 0.5) {
      sctx.globalAlpha = 0.5 * b.a * sideW * strokeFade;
      sctx.fillRect(midx + nx * off + gauss() * 2.2, midy + ny * off + gauss() * 2.2,
        rand(0.5, 1.4), rand(0.5, 1.4));
    }
  }
  sctx.globalAlpha = 1;
  strokePending = true;
  markInkAge(p1.x, p1.y);

  if (wet.bleed > 0) {
    const { depositMul } = brushProfile();
    deposit(p1.x + gauss() * w * 0.3, p1.y + gauss() * w * 0.3, w * 0.45, 0.6 * depositMul * strokeFade);
  }
}

function stampSegment(p0, p1, vel, optT0, optT1) {
  const st = state.stroke;
  const brush = brushProfile();
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const d = Math.hypot(dx, dy) || 0.01;
  const explicit = optT0 !== undefined && optT1 !== undefined;
  const segT0 = explicit ? optT0 : strokeTProg(st, 0);
  const segT1 = explicit ? optT1 : strokeTProg(st, d);
  const tMid = (segT0 + segT1) * 0.5;
  const target = strokeWidth(vel) * strokeTaperMul(tMid);
  if (st.curW === undefined) st.curW = target;
  if (d > 0.5) st.dir = Math.atan2(dy, dx);
  const ang = st.dir || 0;

  if (brush.type === 'bristle') {
    st.curW += (target - st.curW) * 0.3;
    drawBristles(p0, p1, st.curW);
  } else {
    if (brush.type === 'fine') {
      sctx.lineCap = 'round';
      sctx.strokeStyle = pigmentHex(state.color);
      sctx.globalAlpha = 0.65 * strokeFade;
      sctx.lineWidth = Math.max(0.8, target * 0.72);
      sctx.beginPath();
      sctx.moveTo(p0.x, p0.y);
      sctx.lineTo(p1.x, p1.y);
      sctx.stroke();
      sctx.globalAlpha = 1;
      strokePending = true;
    }
    const spacing = Math.max(1.2, st.curW * (brush.type === 'fine' ? 0.16 : 0.22) * brush.spacingMul);
    const steps = Math.max(1, Math.ceil(d / spacing));
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const tStep = explicit ? lerp(segT0, segT1, u) : strokeTProg(st, d * u);
      const wTarget = strokeWidth(vel) * strokeTaperMul(tStep);
      st.curW += (wTarget - st.curW) * 0.12;
      stamp(lerp(p0.x, p1.x, u), lerp(p0.y, p1.y, u), st.curW / 2, vel, ang);
    }
  }
  if (!explicit) st.dist = (st.dist || 0) + d;
  dirty = true;
}

// 沿二次贝塞尔曲线戳印：以上一中点为起点、上一采样点为控制点，
// 鼠标折线被自然圆化；刻意的大转折仍保留方向变化
function stampQuadratic(a, c, b, vel) {
  const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
  const n = Math.max(1, Math.ceil(len / 3));
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const pt = {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
    stampSegment(prev, pt, vel);
    prev = pt;
  }
}

// 收笔出锋：抬笔后顺势带出一小段渐淡的墨尾，含蓄不抢戏
function finishStroke() {
  const st = state.stroke;
  if (!st || state.washing || !state.last || st.refined) return;
  if (brushProfile().type === 'broad') return;
  const cw = st.curW || strokeWidth(state.vel);
  if (cw < 2.5) return;
  // 缓慢提笔几乎无尾，快速甩笔才略带出锋
  const speed = clamp(state.vel / 3, 0, 1);
  if (speed < 0.12) return;
  let x = state.last.x, y = state.last.y;
  let ang = st.dir || 0;
  const len = (cw * 0.7 + state.vel * 5) * speed;
  const steps = Math.max(3, Math.round(len / 2.2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ang += gauss() * 0.03;
    x += Math.cos(ang) * (len / steps);
    y += Math.sin(ang) * (len / steps);
    const tailK = strokeTaperMul(1);
    strokeFade = Math.pow(1 - t, 1.6) * 0.75;
    stamp(x, y, Math.max(0.5, (cw / 2) * tailK * (1 - t * 0.35)), state.vel, ang);
  }
  strokeFade = 1;
  dirty = true;
}

/* ───────────── 停笔顺线（狼毫 / 羊毫 · Phase A/B）───────────── */

const HOLD_REFINE_MS = 1000;
const HOLD_MOVE_EPS = 3.2;
const HOLD_MIN_SPAN = 22;
const HOLD_STRAIGHT_PX = 8;       // 垂距阈值（放宽，手抖仍算直线）
const HOLD_STRAIGHT_RATIO = 0.045; // 垂距 / 弦长
const HOLD_ARC_RATIO = 1.058;      // 路径长 / 弦长，接近 1 即意向直线
const HOLD_SIMPLIFY_EPS = 4.2;      // Douglas–Peucker 去抖（直线判定用）
const HOLD_CURVE_SIMPLIFY_EPS = 12; // 曲线顺线：粗简化，只留大转折
const HOLD_CURVE_SIMPLIFY_MAX = 5;  // 简化后最多保留点数
const HOLD_CHAIKIN_PASSES = 2;

let holdProgress = 0;

function holdRefineOk() {
  const t = brushProfile().type;
  return state.holdRefine && !state.washing && (t === 'fine' || t === 'soft');
}

function restorePreStrokeFluid() {
  const s = undoStack[undoStack.length - 1];
  if (!s) return;
  water.set(s.water);
  pigR.set(s.pr);
  pigG.set(s.pg);
  pigB.set(s.pb);
  fixR.set(s.fr);
  fixG.set(s.fg);
  fixB.set(s.fb);
  inkAge.set(s.age);
  fluidDirty = true;
  fluidIdle = false;
}

function clearStrokeBuffer() {
  sctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
}

function pathLengthPts(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return l;
}

function maxPerpDist(pts, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let max = 0;
  for (const p of pts) {
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    const px = a.x + t * dx, py = a.y + t * dy;
    max = Math.max(max, Math.hypot(p.x - px, p.y - py));
  }
  return max;
}

function pathMetrics(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const length = pathLengthPts(pts);
  const maxPerp = maxPerpDist(pts, a, b);
  const arcRatio = span > 0.01 ? length / span : 1;
  return { a, b, span, length, maxPerp, arcRatio };
}

function perpDistPt(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// 去掉运笔采样抖动，保留大转折
function simplifyPath(pts, eps) {
  if (pts.length <= 2) return pts.map(p => ({ ...p }));
  let maxD = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistPt(pts[i], a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [{ ...a }, { ...b }];
  const left = simplifyPath(pts.slice(0, idx + 1), eps);
  const right = simplifyPath(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function isStraightIntent(m) {
  return m.maxPerp < HOLD_STRAIGHT_PX
    || m.maxPerp / m.span < HOLD_STRAIGHT_RATIO
    || m.arcRatio < HOLD_ARC_RATIO;
}

// Chaikin 角切：起收点不动
function chaikinSmooth(pts) {
  if (pts.length < 3) return pts.map(p => ({ ...p }));
  const out = [{ ...pts[0] }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    if (i > 0) {
      out.push({ x: lerp(p0.x, p1.x, 0.25), y: lerp(p0.y, p1.y, 0.25) });
    }
    if (i < pts.length - 2) {
      out.push({ x: lerp(p0.x, p1.x, 0.75), y: lerp(p0.y, p1.y, 0.75) });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

function chaikinSmoothN(pts, passes = HOLD_CHAIKIN_PASSES) {
  let cur = pts.map(p => ({ ...p }));
  for (let i = 0; i < passes; i++) cur = chaikinSmooth(cur);
  return cur;
}

function simplifyForCurve(pts) {
  let eps = HOLD_CURVE_SIMPLIFY_EPS;
  let cur = simplifyPath(pts, eps);
  while (cur.length > HOLD_CURVE_SIMPLIFY_MAX && eps < 52) {
    eps *= 1.3;
    cur = simplifyPath(pts, eps);
  }
  return cur;
}

// 过点二次贝塞尔链：段间 C1 连续，无 Catmull 尖折
function drawSmoothQuadChain(pts) {
  if (pts.length < 2) return;
  if (pts.length === 2) {
    stampSegment(pts[0], pts[1], 0.45, 0, 1);
    return;
  }

  const vel = 0.45;
  let tPrev = 0;
  let acc = 0;

  let estTotal = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const start = i === 1 ? pts[0] : {
      x: (pts[i - 1].x + pts[i].x) * 0.5,
      y: (pts[i - 1].y + pts[i].y) * 0.5,
    };
    const end = i < pts.length - 2
      ? { x: (pts[i].x + pts[i + 1].x) * 0.5, y: (pts[i].y + pts[i + 1].y) * 0.5 }
      : pts[pts.length - 1];
    estTotal += Math.hypot(end.x - start.x, end.y - start.y) * 1.12;
  }
  estTotal = Math.max(estTotal, 1);

  for (let i = 1; i < pts.length - 1; i++) {
    const cp = pts[i];
    const quadStart = i === 1 ? pts[0] : {
      x: (pts[i - 1].x + pts[i].x) * 0.5,
      y: (pts[i - 1].y + pts[i].y) * 0.5,
    };
    const end = i < pts.length - 2
      ? { x: (pts[i].x + pts[i + 1].x) * 0.5, y: (pts[i].y + pts[i + 1].y) * 0.5 }
      : { ...pts[pts.length - 1] };

    const chord = Math.hypot(end.x - quadStart.x, end.y - quadStart.y);
    const steps = Math.max(3, Math.ceil(chord / 3.5));
    let segPrev = { ...quadStart };

    for (let j = 1; j <= steps; j++) {
      const u = j / steps;
      const r = 1 - u;
      const pt = {
        x: r * r * quadStart.x + 2 * r * u * cp.x + u * u * end.x,
        y: r * r * quadStart.y + 2 * r * u * cp.y + u * u * end.y,
      };
      acc += Math.hypot(pt.x - segPrev.x, pt.y - segPrev.y);
      const tGlobal = clamp(acc / estTotal, 0, 1);
      stampSegment(segPrev, pt, vel, tPrev, tGlobal);
      segPrev = pt;
      tPrev = tGlobal;
    }
  }
}

function recordStrokePoint(p) {
  const st = state.stroke;
  if (!st?.points || st.refined) return;
  const n = st.points.length;
  if (n && Math.hypot(p.x - st.points[n - 1].x, p.y - st.points[n - 1].y) < 1.2) return;
  st.points.push({ x: p.x, y: p.y });
}

function drawRefinedPath(pts) {
  const m = pathMetrics(pts);
  if (m.span < HOLD_MIN_SPAN) return null;

  strokeFade = 1;
  const straight = isStraightIntent(m);

  if (straight) {
    // 意向直线：起收点一条，不再分段戳印
    stampSegment(m.a, m.b, 0.45, 0, 1);
    return 'straight';
  }

  // 曲线：粗简化 → 双 Chaikin → 二次贝塞尔链（无段间尖角）
  const simplified = simplifyForCurve(pts);
  if (simplified.length <= 2 || pathLengthPts(simplified) < HOLD_MIN_SPAN) {
    stampSegment(m.a, m.b, 0.45, 0, 1);
    return 'straight';
  }
  const sm = pathMetrics(simplified);
  if (isStraightIntent(sm)) {
    stampSegment(sm.a, sm.b, 0.45, 0, 1);
    return 'straight';
  }

  drawSmoothQuadChain(chaikinSmoothN(simplified));
  return 'curve';
}

function applyHoldRefine() {
  const st = state.stroke;
  if (!st || st.refined || !holdRefineOk()) return;
  const pts = st.points;
  if (!pts || pts.length < 2 || pathLengthPts(pts) < HOLD_MIN_SPAN) return;

  restorePreStrokeFluid();
  clearStrokeBuffer();
  st.curW = strokeWidth(0.45) * strokeStartWidthMul();
  const kind = drawRefinedPath(pts);
  if (!kind) return;

  st.refined = true;
  st.locked = true;
  holdProgress = 0;
  st.stillSince = null;
  toast(kind === 'straight' ? '笔停 · 已化直' : '笔停 · 已化顺');
  dirty = true;
}

function checkHoldRefine(now, p) {
  const st = state.stroke;
  if (!st || st.refined || st.locked || !holdRefineOk()) {
    holdProgress = 0;
    if (st) st.stillSince = null;
    return;
  }
  const anchor = st.lastMove || state.last;
  if (Math.hypot(p.x - anchor.x, p.y - anchor.y) > HOLD_MOVE_EPS) {
    st.stillSince = null;
    holdProgress = 0;
    return;
  }
  if (!st.stillSince) st.stillSince = now;
  holdProgress = clamp((now - st.stillSince) / HOLD_REFINE_MS, 0, 1);
  if (now - st.stillSince >= HOLD_REFINE_MS) applyHoldRefine();
  syncHoldRingVisual();
}

function syncHoldRingVisual() {
  if (!state.pointerClient || $('#view-paint').classList.contains('hidden')) return;
  const holding = holdProgress > 0 && holdRefineOk() && state.painting && !state.stroke?.locked;
  ring.classList.toggle('hold', holding);
  if (holding) {
    const spread = 2 + holdProgress * 10;
    ring.style.boxShadow = `0 0 0 ${spread}px rgba(161,53,36,${0.12 + holdProgress * 0.38})`;
  } else if (!state.washing) {
    ring.style.boxShadow = '';
  }
}

/* ───────────── 水洗（清水笔） ─────────────
   复用文房设定：笔定水的范围，墨定洗的力度——
   浓墨重洗近似橡皮，清墨轻抚只晕不褪。 */

function washRadius() {
  const { wet } = state;
  const brush = brushProfile();
  return clamp(brush.size * (0.8 + wet.spread * 0.7) * 0.62, 8, WASH_MAX);
}

// 再润湿：把局部笔墨溶入流体网格，随水流动混合
// effect 由墨龄决定：新墨易散，干透的墨咬纸难洗
function rewet(x, y, R, s, effect) {
  const bx = Math.max(0, Math.floor(x - R)), by = Math.max(0, Math.floor(y - R));
  const bw = Math.min(CANVAS_W - bx, Math.ceil(R * 2)), bh = Math.min(CANVAS_H - by, Math.ceil(R * 2));
  if (bw <= 0 || bh <= 0) return;
  const im = ink.getImageData(bx, by, bw, bh).data;

  const x0 = Math.max(1, Math.floor((x - R) / GRID_F)), x1 = Math.min(GW - 2, Math.ceil((x + R) / GRID_F));
  const y0 = Math.max(1, Math.floor((y - R) / GRID_F)), y1 = Math.min(GH - 2, Math.ceil((y + R) / GRID_F));
  const wAmt = 0.45 + state.wet.bleed * 0.65;      // 越湿注水越多，晕得越远
  const remob = 0.05 * effect;                     // 固着颜料仅少量被水重新松动

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const px = cx * GRID_F, py = cy * GRID_F;
      const ddx = px - x, ddy = py - y;
      if (ddx * ddx + ddy * ddy > R * R) continue;
      const i = cy * GW + cx;
      water[i] = Math.min(2.5, water[i] + wAmt * perm[i]);
      if (fixR[i] > 0) { const m = fixR[i] * remob; fixR[i] -= m; pigR[i] += m; }
      if (fixG[i] > 0) { const m = fixG[i] * remob; fixG[i] -= m; pigG[i] += m; }
      if (fixB[i] > 0) { const m = fixB[i] * remob; fixB[i] -= m; pigB[i] += m; }
      // 拾取少量墨色入水（提墨量须大于回写量，水洗才会变淡）
      const ix = px - bx, iy = py - by;
      if (ix < 0 || iy < 0 || ix >= bw || iy >= bh) continue;
      const j = (iy * bw + ix) * 4;
      const a = im[j + 3] / 255;
      if (a < 0.04) continue;
      const pick = a * 0.05 * (0.4 + s) * effect;
      pigR[i] += pick * ((1 - im[j] / 255) * 1.7 + 0.05);
      pigG[i] += pick * ((1 - im[j + 1] / 255) * 1.7 + 0.05);
      pigB[i] += pick * ((1 - im[j + 2] / 255) * 1.7 + 0.05);
    }
  }
  fluidDirty = true;
  fluidIdle = false;
}

function washAt(x, y, mx, my) {
  const R = washRadius();
  const S = Math.ceil((R + WASH_PAD) * 2);
  const s = state.wet.alpha;                       // 墨的轻重 → 水洗力度
  // 干透的墨咬纸：墨龄越老，可被打散的比例越低
  const effect = 0.22 + 0.78 * inkFreshness(x, y);
  const sx = Math.round(x - S / 2), sy = Math.round(y - S / 2);

  // 取局部墨迹做模糊
  wctx.clearRect(0, 0, S, S);
  if (FILTER_OK) {
    wctx.filter = `blur(${Math.max(3, R * 0.1).toFixed(1)}px)`;
    wctx.drawImage(inkC, sx, sy, S, S, 0, 0, S, S);
    wctx.filter = 'none';
  } else {
    // 退化方案：多次低透明度偏移叠印近似模糊
    wctx.globalAlpha = 0.18;
    for (let i = 0; i < 6; i++) {
      wctx.drawImage(inkC, sx + gauss() * 5, sy + gauss() * 5, S, S, 0, 0, S, S);
    }
    wctx.globalAlpha = 1;
  }

  // 软边羽化掩模（中心偏移抖动），避免硬圆边
  wctx.globalCompositeOperation = 'destination-in';
  const cx = S / 2 + gauss() * R * 0.15, cy = S / 2 + gauss() * R * 0.15;
  const mg = wctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  mg.addColorStop(0, 'rgba(0,0,0,1)');
  mg.addColorStop(0.5, 'rgba(0,0,0,0.75)');
  mg.addColorStop(1, 'rgba(0,0,0,0)');
  wctx.fillStyle = mg;
  wctx.fillRect(0, 0, S, S);
  wctx.globalCompositeOperation = 'source-over';

  // 先提墨：多个抖动的软斑点，破除圆形痕迹（净效果必须是变淡）
  ink.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < 3; j++) {
    const ex = x + gauss() * R * 0.4, ey = y + gauss() * R * 0.4;
    const er = R * rand(0.5, 0.95);
    const g = ink.createRadialGradient(ex, ey, 0, ex, ey, er);
    g.addColorStop(0, `rgba(0,0,0,${rand(0.06, 0.1) * (0.35 + s) * effect})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ink.fillStyle = g;
    ink.beginPath();
    ink.arc(ex, ey, er, 0, TAU);
    ink.fill();
  }
  ink.globalCompositeOperation = 'source-over';

  // 再轻回写模糊墨迹：沿运笔方向推移，墨随水走（干墨几乎不随水）
  ink.globalAlpha = 0.18 * (0.35 + s) * (0.35 + 0.65 * effect);
  ink.drawImage(washTmp, 0, 0, S, S,
    sx + mx * 1.1 + gauss() * 2, sy + my * 1.1 + gauss() * 2, S, S);
  ink.globalAlpha = 1;

  rewet(x, y, R, s, effect);
}

function washSegment(p0, p1) {
  const R = washRadius();
  const d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 0.01;
  const steps = Math.max(1, Math.ceil(d / (R * 0.45)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    washAt(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t),
      (p1.x - p0.x) / steps, (p1.y - p0.y) / steps);
  }
  dirty = true;
}

/* ───────────── 题款 · 钤印 ───────────── */

const INS_FONTS = [
  { id: 'brush', name: '行楷', family: "'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi',serif" },
  { id: 'kai',   name: '楷体', family: "'Kaiti SC','STKaiti','KaiTi',serif" },
  { id: 'song',  name: '宋体', family: "'Noto Serif SC','Songti SC','STSong',serif" },
  { id: 'light', name: '细宋', family: "'Noto Serif SC','Songti SC','STSong',serif", weight: '300' },
  { id: 'bold',  name: '粗宋', family: "'Noto Serif SC','Songti SC','STSong',serif", weight: '600' },
  { id: 'cao',   name: '草书', family: "'Zhi Mang Xing','Ma Shan Zheng',cursive" },
  { id: 'li',    name: '隶意', family: "'Long Cang','Ma Shan Zheng',serif" },
];

const INS_FONT_SIZES = { sm: 22, md: 30, lg: 42 };
const SEAL_PX_SIZES = { sm: 88, md: 120, lg: 162 };
// 钤印叠底：略透、纸纹可透，如油印朱砂
function sealInkAlpha() { return rand(0.72, 0.86); }

function drawSealImpression(ctx, px, alpha) {
  const half = px / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.drawImage(sealC, -half, -half, px, px);
  ctx.restore();
}

const SEAL_FONTS = [
  { id: 'brush', name: '篆意', family: "'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi',serif" },
  { id: 'kai',   name: '楷体', family: "'Kaiti SC','STKaiti','KaiTi',serif" },
  { id: 'song',  name: '宋体', family: "'Noto Serif SC','Songti SC','STSong',serif" },
  { id: 'bold',  name: '方劲', family: "'Noto Serif SC','Songti SC','STSong',serif", weight: '600' },
];

const sealC = document.createElement('canvas');
sealC.width = sealC.height = SEAL_PX_SIZES.md;

const insDraft = { fontId: 'brush', sizeId: 'md' };
const sealDraft = { carve: 'yin', fontId: 'brush', sizeId: 'md' };

function markFontStr(fonts, fontId, fs) {
  const f = fonts.find(x => x.id === fontId) || fonts[0];
  const w = f.weight ? `${f.weight} ` : '';
  return `${w}${fs}px ${f.family}`;
}

function insFontStr(fontId, fs) { return markFontStr(INS_FONTS, fontId, fs); }
function sealFontStr(fontId, fs) { return markFontStr(SEAL_FONTS, fontId, fs); }

function sealCanvasPx(sizeId) { return SEAL_PX_SIZES[sizeId] || SEAL_PX_SIZES.md; }

function bindChipRow(rootId, draftKey, draft, onPick) {
  const root = $(rootId);
  if (!root) return;
  const attr = draftKey === 'carve' ? 'carve' : draftKey === 'sizeId' ? 'size' : 'font';
  for (const btn of root.querySelectorAll('.chip')) {
    btn.onclick = () => {
      draft[draftKey] = btn.dataset[attr];
      for (const b of root.querySelectorAll('.chip'))
        b.classList.toggle('sel', b === btn);
      onPick?.();
    };
  }
}

// 题款钤印：简体输入默认转繁体（OpenCC 单字表，见 s2t.js）
const toTrad = typeof toTraditional === 'function' ? toTraditional : s => s;

function sealLayout(chars, s, cx, cy) {
  let fs, pos;
  if (chars.length === 1) {
    fs = s * 0.62; pos = [[cx, cy + 1]];
  } else if (chars.length === 2) {
    fs = s * 0.42; pos = [[cx, cy - s * 0.21], [cx, cy + s * 0.25]];
  } else {
    fs = s * 0.36;
    pos = [[cx + s * 0.22, cy - s * 0.21], [cx + s * 0.22, cy + s * 0.25],
           [cx - s * 0.22, cy - s * 0.21], [cx - s * 0.22, cy + s * 0.25]];
  }
  return { fs, pos };
}

// 生成略变形方印轮廓（每钤一次形状不同）
function buildSealContour(cx, cy, s) {
  const h = s / 2;
  const corners = [{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const c0 = corners[i], c1 = corners[(i + 1) % 4];
    pts.push({
      x: cx + c0.x + gauss() * 2.8,
      y: cy + c0.y + gauss() * 2.8,
    });
    for (let k = 1; k <= 2; k++) {
      const t = k / 3;
      pts.push({
        x: cx + lerp(c0.x, c1.x, t) + gauss() * 2.2,
        y: cy + lerp(c0.y, c1.y, t) + gauss() * 1.8,
      });
    }
  }
  return pts;
}

function sealContourPath(c, pts) {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
}

// 边缘断纹、崩缺
function applySealEdgeBreaks(c, pts) {
  const n = pts.length;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    if (Math.random() < 0.42) {
      c.lineWidth = rand(1.4, 4.2);
      c.beginPath();
      c.moveTo(p.x + gauss() * 1.2, p.y + gauss() * 1.2);
      c.lineTo(p.x + Math.cos(a + gauss() * 0.35) * rand(3, 9),
        p.y + Math.sin(a + gauss() * 0.35) * rand(3, 9));
      c.stroke();
    }
    if (Math.random() < 0.28) {
      c.beginPath();
      c.arc(p.x + gauss() * 2, p.y + gauss() * 2, rand(1, 3.8), 0, TAU);
      c.fill();
    }
  }
  for (let i = 0; i < 5; i++) {
    const p = pts[(Math.random() * n) | 0];
    c.beginPath();
    c.arc(p.x, p.y, rand(2.5, 5.5), 0, TAU);
    c.fill();
  }
  c.restore();
}

function applySealWear(c, pts, carve) {
  const n = pts.length;
  if (carve === 'yang') c.fillStyle = '#a13524';
  for (let i = 0; i < (carve === 'yin' ? 72 : 40); i++) {
    const p = pts[(Math.random() * n) | 0];
    const px = p.x + gauss() * 2.8;
    const py = p.y + gauss() * 2.8;
    c.globalAlpha = carve === 'yin' ? 1 : rand(0.12, 0.4);
    c.beginPath();
    c.arc(px, py, rand(0.35, 2.2), 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

function renderSeal(txt, opts = {}) {
  const carve = opts.carve || 'yin';
  const fontId = opts.fontId || 'brush';
  const px = sealCanvasPx(opts.sizeId || 'md');
  if (sealC.width !== px) sealC.width = sealC.height = px;
  const c = sealC.getContext('2d');
  c.clearRect(0, 0, px, px);
  const s = px * 0.383;
  const cx = px / 2, cy = px / 2;
  const contour = buildSealContour(cx, cy, s);
  const chars = txt.slice(0, 4).split('');
  const { fs, pos } = sealLayout(chars, s, cx, cy);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = sealFontStr(fontId, fs);

  if (carve === 'yin') {
    c.fillStyle = 'rgba(161,53,36,0.94)';
    sealContourPath(c, contour);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    chars.forEach((ch, i) => { if (pos[i]) c.fillText(ch, pos[i][0], pos[i][1]); });
    applySealEdgeBreaks(c, contour);
    applySealWear(c, contour, 'yin');
    c.globalCompositeOperation = 'source-over';
  } else {
    c.fillStyle = 'rgba(161,53,36,0.88)';
    chars.forEach((ch, i) => { if (pos[i]) c.fillText(ch, pos[i][0], pos[i][1]); });
    c.strokeStyle = 'rgba(161,53,36,0.48)';
    c.lineWidth = rand(1.3, 2.1);
    sealContourPath(c, contour);
    c.stroke();
    c.globalCompositeOperation = 'destination-out';
    applySealEdgeBreaks(c, contour);
    applySealWear(c, contour, 'yang');
    c.globalCompositeOperation = 'source-over';
  }
}

function updateSealPreview() {
  const raw = $('#seal-text').value.trim() || '墨韵';
  const txt = toTrad(raw);
  renderSeal(txt, sealDraft);
  const prev = $('#seal-preview');
  if (!prev) return;
  const px = sealCanvasPx(sealDraft.sizeId);
  const pad = Math.round(px * 0.067);
  const inner = 96 - pad * 2;
  const pctx = prev.getContext('2d');
  pctx.clearRect(0, 0, 96, 96);
  pctx.fillStyle = '#f4eedd';
  pctx.fillRect(0, 0, 96, 96);
  pctx.save();
  pctx.translate(pad + inner / 2, pad + inner / 2);
  drawSealImpression(pctx, inner, 0.78);
  pctx.restore();
}

function placeInscription(p) {
  const { text, fontId = 'brush', sizeId = 'md' } = state.placing;
  state.placing = null;
  view.style.cursor = 'none';
  pushUndo();

  const fs = INS_FONT_SIZES[sizeId] || INS_FONT_SIZES.md;
  const lh = fs * 1.14, colGap = fs * 1.35;
  const cols = text.split(/[\s/]+/).filter(Boolean);
  ink.font = insFontStr(fontId, fs);
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillStyle = '#26231f';
  let cx = p.x;
  for (const col of cols) {
    let cy = p.y + fs / 2;
    for (const ch of col) {
      ink.globalAlpha = rand(0.76, 0.9);
      ink.fillText(ch, cx + gauss() * 0.9, cy + gauss() * 0.9);
      cy += lh;
    }
    cx -= colGap;
  }
  ink.globalAlpha = 1;
  state.unsaved = true;
  dirty = true;
  toast('题款已成');
}

function placeSeal(p) {
  const { text, carve, fontId, sizeId = 'md' } = state.placing;
  state.placing = null;
  view.style.cursor = 'none';
  pushUndo();
  renderSeal(text, { carve, fontId, sizeId });
  const px = sealCanvasPx(sizeId);
  ink.save();
  ink.translate(p.x, p.y);
  ink.rotate(gauss() * 0.04);
  drawSealImpression(ink, px, sealInkAlpha());
  ink.restore();
  state.unsaved = true;
  dirty = true;
  toast('钤印已成');
}

function openInscribe() {
  $('#inscribe-modal').classList.remove('hidden');
  $('#ins-text').focus();
}

function closeInscribe() {
  $('#inscribe-modal').classList.add('hidden');
}

function openSeal() {
  $('#seal-modal').classList.remove('hidden');
  $('#seal-text').focus();
  updateSealPreview();
}

function closeSeal() {
  $('#seal-modal').classList.add('hidden');
}

$('#ins-cancel').onclick = closeInscribe;
$('#ins-ok').onclick = () => {
  const text = toTrad($('#ins-text').value.trim());
  if (!text) { toast('请题一两句'); return; }
  closeInscribe();
  state.placing = {
    mode: 'inscribe', text,
    fontId: insDraft.fontId, sizeId: insDraft.sizeId,
  };
  view.style.cursor = 'crosshair';
  toast('点选画面题款处');
};

$('#seal-cancel').onclick = closeSeal;
$('#seal-ok').onclick = () => {
  const text = toTrad($('#seal-text').value.trim() || '墨韵');
  closeSeal();
  state.placing = {
    mode: 'seal', text,
    carve: sealDraft.carve, fontId: sealDraft.fontId, sizeId: sealDraft.sizeId,
  };
  view.style.cursor = 'crosshair';
  toast('点选画面钤印处');
};

$('#inscribe-modal').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#ins-ok').click();
  if (e.key === 'Escape') closeInscribe();
});

$('#seal-modal').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#seal-ok').click();
  if (e.key === 'Escape') closeSeal();
});

$('#seal-text').addEventListener('input', updateSealPreview);

bindChipRow('#ins-font-chips', 'fontId', insDraft);
bindChipRow('#ins-size-chips', 'sizeId', insDraft);
bindChipRow('#seal-carve-chips', 'carve', sealDraft, updateSealPreview);
bindChipRow('#seal-font-chips', 'fontId', sealDraft, updateSealPreview);
bindChipRow('#seal-size-chips', 'sizeId', sealDraft, updateSealPreview);

/* ───────────── 撤销 ───────────── */

// 触屏设备内存预算紧（iOS Safari 易因 ImageData 过多闪退），快照大减
const UNDO_MAX = IS_COARSE ? 5 : 24;
const undoStack = [];

function pushUndo() {
  if (undoStack.length >= UNDO_MAX) undoStack.shift();
  undoStack.push({
    img: ink.getImageData(0, 0, CANVAS_W, CANVAS_H),
    water: water.slice(), pr: pigR.slice(), pg: pigG.slice(), pb: pigB.slice(),
    fr: fixR.slice(), fg: fixG.slice(), fb: fixB.slice(), age: inkAge.slice(),
  });
}

function undo() {
  const s = undoStack.pop();
  if (!s) { toast('已无可撤之笔'); return; }
  ink.putImageData(s.img, 0, 0);
  water.set(s.water); pigR.set(s.pr); pigG.set(s.pg); pigB.set(s.pb);
  fixR.set(s.fr); fixG.set(s.fg); fixB.set(s.fb); inkAge.set(s.age);
  fluidDirty = true;
  fluidIdle = false;
  dirty = true;
}

/* ───────────── 指针交互 ───────────── */

function getPos(e) {
  const r = view.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * CANVAS_W / r.width,
    y: (e.clientY - r.top) * CANVAS_H / r.height,
  };
}

view.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  state.pointerClient = { x: e.clientX, y: e.clientY };
  try { view.setPointerCapture(e.pointerId); } catch { /* 部分浏览器不支持 */ }
  if (state.placing) {
    const p = getPos(e);
    if (state.placing.mode === 'seal') placeSeal(p);
    else placeInscription(p);
    return;
  }
  pushUndo();
  state.painting = true;
  state.unsaved = true;
  state.last = getPos(e);
  state.lastT = performance.now();
  state.vel = 0;
  // 起笔粗细：「锋」仅狼毫/羊毫；斗笔、散锋保持原阔笔逻辑
  const bp = brushProfile();
  state.stroke = {
    bristles: makeBristles(),
    curW: strokeWidth(0) * strokeStartWidthMul(),
    estLen: Math.max(bp.size * 18, 48),
    dist: 0,
    dir: 0,
    side: Math.random() < 0.5 ? -1 : 1,
    points: [{ ...state.last }],
    stillSince: null,
    lastMove: { ...state.last },
    refined: false,
    locked: false,
  };
  state.qMid = { ...state.last };   // 曲线圆滑的起点（上一段中点）
  if (!state.washing) stampSegment(state.last, state.last, 0);
});

window.addEventListener('pointermove', e => {
  state.pointerClient = { x: e.clientX, y: e.clientY };
  updateCursor(e);
  if (!state.painting) return;
  let p = getPos(e);
  const now = performance.now();
  if (!state.washing && holdRefineOk()) {
    if (state.stroke?.locked) return;
    checkHoldRefine(now, p);
    if (state.stroke?.locked) return;
  }
  // 笔随手走而略滞后：指数平滑抹掉鼠标抖动，线条更连贯圆润
  if (!state.washing) {
    p = {
      x: lerp(state.last.x, p.x, brushProfile().type === 'fine' ? 0.55 : 0.7),
      y: lerp(state.last.y, p.y, brushProfile().type === 'fine' ? 0.55 : 0.7),
    };
  }
  const d = Math.hypot(p.x - state.last.x, p.y - state.last.y);
  if (d < 1) return;
  const dt = Math.max(1, now - state.lastT);
  state.vel = state.vel * 0.72 + (d / dt) * 0.28;
  if (state.washing) {
    washSegment(state.last, p);
  } else {
    // 中点平滑：经由上一采样点的二次曲线，笔触圆润不见折角
    const mid = { x: (state.last.x + p.x) / 2, y: (state.last.y + p.y) / 2 };
    stampQuadratic(state.qMid, state.last, mid, state.vel);
    state.qMid = mid;
    recordStrokePoint(p);
    if (state.stroke) state.stroke.lastMove = { x: p.x, y: p.y };
  }
  state.last = p;
  state.lastT = now;
});

window.addEventListener('pointerup', () => {
  if (state.painting) {
    finalizeStrokeLength(state.stroke);
    finishStroke();
    commitStroke();
  }
  state.painting = false;
  holdProgress = 0;
});
window.addEventListener('blur', () => {
  if (state.painting) {
    finalizeStrokeLength(state.stroke);
    commitStroke();
  }
  state.painting = false;
  holdProgress = 0;
});
// 触屏上系统手势可能中断指针流，务必提交未完成的一笔
window.addEventListener('pointercancel', () => {
  if (state.painting) {
    finalizeStrokeLength(state.stroke);
    commitStroke();
  }
  state.painting = false;
  holdProgress = 0;
});

window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' &&
      !$('#view-paint').classList.contains('hidden')) {
    e.preventDefault();
    undo();
  }
  if (e.key === 'Escape' && state.placing) {
    state.placing = null;
    view.style.cursor = 'none';
    toast('已取消');
  }
});

/* ───────────── 笔锋光标 ───────────── */

const ring = $('#cursor-ring');

function updateCursor(e) {
  if (e.pointerType === 'touch' || $('#view-paint').classList.contains('hidden') || state.placing) {
    ring.style.display = 'none';
    return;
  }
  const r = view.getBoundingClientRect();
  const over = e.clientX >= r.left && e.clientX <= r.right &&
               e.clientY >= r.top && e.clientY <= r.bottom;
  if (!over) { ring.style.display = 'none'; return; }
  const scale = r.width / CANVAS_W;
  const d = state.washing ? washRadius() * 2 * scale : strokeWidth(state.vel) * scale;
  ring.style.display = 'block';
  ring.style.width = ring.style.height = Math.max(4, d) + 'px';
  ring.style.left = e.clientX + 'px';
  ring.style.top = e.clientY + 'px';
  ring.classList.toggle('water', state.washing);
  const holding = holdProgress > 0 && holdRefineOk() && state.painting && !state.stroke?.locked;
  ring.classList.toggle('hold', holding);
  if (holding) syncHoldRingVisual();
  else if (!state.washing) ring.style.boxShadow = '';
}

/* ───────────── 渲染循环 ───────────── */

function loop() {
  fluidStep();
  fluidStep();   // 每帧两次渗流，加快晕染混合
  if (state.painting && !state.washing && holdRefineOk() && !state.stroke?.locked) {
    checkHoldRefine(performance.now(), state.stroke?.lastMove || state.last);
  }
  if (fluidDirty) { renderFluid(); fluidDirty = false; dirty = true; }
  if (dirty) {
    vctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    vctx.drawImage(paperC, 0, 0);
    vctx.globalCompositeOperation = 'multiply';
    vctx.drawImage(inkC, 0, 0);
    if (strokePending) {
      // 进行中的一笔：实时按墨级透明度预览
      vctx.globalAlpha = strokeAlpha();
      vctx.drawImage(strokeC, 0, 0);
      vctx.globalAlpha = 1;
    }
    vctx.imageSmoothingEnabled = true;
    vctx.drawImage(fluidC, 0, 0, CANVAS_W, CANVAS_H);
    vctx.globalCompositeOperation = 'source-over';
    dirty = false;
  }
  requestAnimationFrame(loop);
}

/* ───────────── 工具栏 ───────────── */

const toolbar = $('#toolbar');
const toolsLeft = $('#tools-left');
const toolsRight = $('#tools-right');

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function buildToolbar() {
  buildActionBar();
  buildCanvasToolsLeft();
  buildCanvasToolsRight();
  refreshSel();
}

function buildActionBar() {
  toolbar.innerHTML = '';
  const gAct = el('div', 'tool-group action-group');
  const acts = [
    ['撤笔', undo],
    ['涤纸', clearPaper],
    null,
    ['入藏', saveCurrent, true],
    ['成图', exportPNG],
    null,
    ['画廊', backToGallery],
  ];
  for (const a of acts) {
    if (!a) { gAct.append(el('div', 'action-sep')); continue; }
    const btn = el('button', 'action-btn' + (a[2] ? ' primary' : ''), a[0]);
    btn.onclick = a[1];
    gAct.append(btn);
  }
  toolbar.append(gAct);
}

function buildCanvasToolsLeft() {
  toolsLeft.innerHTML = '';

  const gBrush = el('div', 'tool-group');
  gBrush.append(el('div', 'g-label', '笔'));
  for (const b of BRUSHES) {
    const it = el('div', 'brush-item',
      `<span class="b-name">${b.name}</span><span class="b-sub">${b.sub}</span>`);
    it.dataset.kind = 'brush';
    it.dataset.id = b.id;
    it.onclick = () => { state.brush = b; refreshSel(); };
    gBrush.append(it);
  }

  const gSize = el('div', 'tool-group');
  gSize.append(el('div', 'g-label', '毫'));
  for (const t of SIZE_TIERS) {
    const it = el('div', 'brush-item',
      `<span class="b-name">${t.name}</span><span class="b-sub">${t.sub}</span>`);
    it.dataset.kind = 'size';
    it.dataset.id = t.id;
    it.onclick = () => { state.sizeByBrush[state.brush.id] = t.id; refreshSel(); };
    gSize.append(it);
  }

  const gTaper = el('div', 'tool-group');
  gTaper.append(el('div', 'g-label', '锋'));
  for (const t of STROKE_TAPERS) {
    const it = el('div', 'brush-item',
      `<span class="b-name">${t.name}</span><span class="b-sub">${t.sub}</span>`);
    it.dataset.kind = 'taper';
    it.dataset.id = t.id;
    it.onclick = () => {
      state.strokeTaper = t.id;
      refreshSel();
      if (IS_COARSE) toast(`${t.name} · ${t.sub}`);
    };
    gTaper.append(it);
  }

  const gHold = el('div', 'tool-group');
  gHold.append(el('div', 'g-label', '顺'));
  const holdIt = el('div', 'brush-item',
    `<span class="b-name">停笔</span><span class="b-sub">顺线</span>`);
  holdIt.dataset.kind = 'hold';
  holdIt.dataset.id = 'holdrefine';
  holdIt.onclick = () => {
    state.holdRefine = !state.holdRefine;
    refreshSel();
    toast(state.holdRefine ? '停笔顺线 · 开' : '停笔顺线 · 关');
  };
  gHold.append(holdIt);

  const gWet = el('div', 'tool-group');
  gWet.append(el('div', 'g-label', '墨'));
  const wetRow = el('div', 'dot-row');
  for (const w of WETNESS) {
    const it = el('div', 'ink-dot', `<span class="dot-name">${w.name}</span>`);
    it.dataset.id = w.id;
    it.style.background = `rgba(31,29,26,${w.alpha})`;
    it.onclick = () => { state.wet = w; refreshSel(); if (IS_COARSE) toast(w.name); };
    wetRow.append(it);
  }
  gWet.append(wetRow);

  const gColor = el('div', 'tool-group');
  gColor.append(el('div', 'g-label', '色'));
  const colRow = el('div', 'dot-row');
  for (const c of COLORS) {
    const it = el('div', 'color-dot', `<span class="dot-name">${c.name}</span>`);
    it.dataset.id = c.id;
    it.style.background = c.hex;
    it.onclick = () => { state.color = c; state.washing = false; refreshSel(); if (IS_COARSE) toast(c.name); };
    colRow.append(it);
  }
  gColor.append(colRow);

  // 双列：笔|毫、锋|顺、墨|色
  toolsLeft.append(gBrush, gSize, gTaper, gHold, gWet, gColor);
}

function buildCanvasToolsRight() {
  toolsRight.innerHTML = '';

  const gPaper = el('div', 'tool-group');
  gPaper.append(el('div', 'g-label', '纸'));
  for (const p of PAPERS) {
    const it = el('div', 'brush-item',
      `<span class="b-name">${p.name}</span>`);
    it.dataset.id = p.id;
    it.onclick = () => {
      if (state.paper.id === p.id) return;
      state.paper = p;
      genPerm();
      paintPaper();
      refreshSel();
      if (IS_COARSE) toast(p.name);
    };
    gPaper.append(it);
  }
  toolsRight.append(gPaper);

  const gWater = el('div', 'tool-group');
  gWater.append(el('div', 'g-label', '水'));
  const wIt = el('div', 'brush-item',
    `<span class="b-name">清水</span><span class="b-sub">笔</span>`);
  wIt.dataset.id = 'wash';
  wIt.onclick = () => { state.washing = !state.washing; refreshSel(); };
  gWater.append(wIt);
  toolsRight.append(gWater);

  const gMark = el('div', 'tool-group');
  gMark.append(el('div', 'g-label', '款'));
  const insIt = el('div', 'brush-item',
    `<span class="b-name">题款</span><span class="b-sub">题词</span>`);
  insIt.dataset.id = 'inscribe';
  insIt.onclick = () => { state.washing = false; refreshSel(); openInscribe(); };
  gMark.append(insIt);
  const sealIt = el('div', 'brush-item',
    `<span class="b-name">钤印</span><span class="b-sub">印章</span>`);
  sealIt.dataset.id = 'seal';
  sealIt.onclick = () => { state.washing = false; refreshSel(); openSeal(); };
  gMark.append(sealIt);
  toolsRight.append(gMark);
}

function refreshStrokeOptDisabled() {
  const off = !strokeTaperApplies();
  for (const it of toolsLeft.querySelectorAll('.brush-item[data-kind="taper"], .brush-item[data-kind="hold"]'))
    it.classList.toggle('disabled', off);
  for (const g of [toolsLeft.querySelector('.brush-item[data-kind="taper"]'),
                    toolsLeft.querySelector('.brush-item[data-kind="hold"]')]) {
    g?.closest('.tool-group')?.classList.toggle('disabled', off);
  }
}

function refreshSel() {
  const tierId = state.sizeByBrush[state.brush.id] || 'bao';
  for (const it of toolsLeft.querySelectorAll('.brush-item[data-kind="brush"]'))
    it.classList.toggle('sel', it.dataset.id === state.brush.id);
  for (const it of toolsLeft.querySelectorAll('.brush-item[data-kind="taper"]'))
    it.classList.toggle('sel', it.dataset.id === state.strokeTaper);
  for (const it of toolsLeft.querySelectorAll('.brush-item[data-kind="size"]'))
    it.classList.toggle('sel', it.dataset.id === tierId);
  for (const it of toolsLeft.querySelectorAll('.ink-dot'))
    it.classList.toggle('sel', it.dataset.id === state.wet.id);
  for (const it of toolsLeft.querySelectorAll('.color-dot'))
    it.classList.toggle('sel', !state.washing && it.dataset.id === state.color.id);
  for (const it of toolsLeft.querySelectorAll('.brush-item[data-kind="hold"]'))
    it.classList.toggle('sel', state.holdRefine);
  for (const it of toolsRight.querySelectorAll('.brush-item')) {
    if (it.dataset.id === 'wash') it.classList.toggle('sel', state.washing);
    else it.classList.toggle('sel', it.dataset.id === state.paper.id);
  }
  refreshStrokeOptDisabled();
}

function clearPaper() {
  pushUndo();
  ink.clearRect(0, 0, CANVAS_W, CANVAS_H);
  resetFluid();
  state.unsaved = true;
  dirty = true;
}

/* ───────────── 画廊与存储 ───────────── */

const STORE_KEY = 'inkpaint.works';
const titleInput = $('#work-title');

const loadWorks = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
};
const persistWorks = arr => localStorage.setItem(STORE_KEY, JSON.stringify(arr));

function makeComposite(w) {
  const h = Math.round(w * CANVAS_H / CANVAS_W);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(paperC, 0, 0, w, h);
  x.globalCompositeOperation = 'multiply';
  x.drawImage(inkC, 0, 0, w, h);
  x.imageSmoothingEnabled = true;
  x.drawImage(fluidC, 0, 0, w, h);
  return c;
}

function inkDataURL(scale) {
  const flat = flattenInk();
  if (scale >= 1) return flat.toDataURL('image/png');
  const c = document.createElement('canvas');
  c.width = Math.round(CANVAS_W * scale);
  c.height = Math.round(CANVAS_H * scale);
  c.getContext('2d').drawImage(flat, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function saveCurrent() {
  const works = loadWorks();
  const name = titleInput.value.trim() || randomName();
  titleInput.value = name;
  const base = {
    name,
    paper: state.paper.id,
    date: Date.now(),
    thumb: makeComposite(320).toDataURL('image/jpeg', 0.82),
  };

  const tryPersist = scale => {
    const work = { ...base, ink: inkDataURL(scale) };
    if (state.editingId) {
      work.id = state.editingId;
      const i = works.findIndex(w => w.id === work.id);
      if (i >= 0) works[i] = work; else works.push(work);
    } else {
      work.id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      works.push(work);
      state.editingId = work.id;
    }
    persistWorks(works);
  };

  try {
    tryPersist(1);
  } catch {
    try { tryPersist(0.55); }
    catch { toast('画廊存储已满，请先删除旧作'); return; }
  }
  state.unsaved = false;
  toast('已收入画廊');
}

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function exportPNG() {
  const url = makeComposite(CANVAS_W).toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = (titleInput.value.trim() || '墨韵') + '.png';
  a.click();
  toast('已成图');
}

function renderGallery() {
  const grid = $('#gallery-grid');
  for (const old of grid.querySelectorAll('.work-card')) old.remove();
  const works = loadWorks().sort((a, b) => b.date - a.date);
  $('#gallery-empty').classList.toggle('hidden', works.length > 0);

  for (const w of works) {
    const card = el('div', 'work-card');
    const d = new Date(w.date);
    card.innerHTML = `
      <div class="work-thumb"><img src="${w.thumb}" alt="${w.name}"></div>
      <div class="work-meta">
        <span class="work-name">${w.name}</span>
        <span class="work-date">${d.getMonth() + 1}月${d.getDate()}日</span>
      </div>
      <button class="work-del" title="删除">删</button>`;
    card.onclick = () => openWork(w.id);
    card.querySelector('.work-del').onclick = e => {
      e.stopPropagation();
      if (!confirm(`将「${w.name}」从画廊中移除？`)) return;
      persistWorks(loadWorks().filter(x => x.id !== w.id));
      renderGallery();
    };
    grid.append(card);
  }
}

/* ───────────── 视图切换 ───────────── */

function showGallery() {
  renderGallery();
  $('#view-paint').classList.add('hidden');
  $('#view-gallery').classList.remove('hidden');
  ring.style.display = 'none';
}

function showPaint() {
  $('#view-gallery').classList.add('hidden');
  $('#view-paint').classList.remove('hidden');
}

function newWork() {
  state.editingId = null;
  state.unsaved = false;
  state.paper = PAPERS[0];
  state.washing = false;
  undoStack.length = 0;
  ink.clearRect(0, 0, CANVAS_W, CANVAS_H);
  resetFluid();
  genPerm();
  paintPaper();
  titleInput.value = randomName();
  refreshSel();
  showPaint();
}

function openWork(id) {
  const w = loadWorks().find(x => x.id === id);
  if (!w) return;
  state.editingId = id;
  state.unsaved = false;
  state.paper = PAPERS.find(p => p.id === w.paper) || PAPERS[0];
  state.washing = false;
  undoStack.length = 0;
  ink.clearRect(0, 0, CANVAS_W, CANVAS_H);
  resetFluid();
  genPerm();
  paintPaper();
  titleInput.value = w.name;
  const img = new Image();
  img.onload = () => { ink.drawImage(img, 0, 0, CANVAS_W, CANVAS_H); dirty = true; };
  img.src = w.ink;
  refreshSel();
  showPaint();
}

function backToGallery() {
  if (state.unsaved && !confirm('尚有笔墨未收入画廊，离开后将散佚。仍要返回？')) return;
  showGallery();
}

/* ───────────── 提示 ───────────── */

let toastTimer = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ───────────── 移动端抽屉 ───────────── */

// 两侧文房抽屉 + 底部功能栏，把手随时收展（桌面端把手隐藏，不受影响）
document.body.classList.add('m-actions-open');
$('#handle-left').onclick = () => document.body.classList.toggle('m-left-open');
$('#handle-right').onclick = () => document.body.classList.toggle('m-right-open');
$('#handle-actions').onclick = () => document.body.classList.toggle('m-actions-open');

/* ───────────── 启动 ───────────── */

$('#btn-new').onclick = newWork;
buildToolbar();
genPerm();
paintPaper();
renderGallery();
loop();
