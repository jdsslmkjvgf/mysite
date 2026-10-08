// ===== 游戏配置：加作物、菜谱、调数值都在这里 =====
// 脚本出错时把错误显示在页面上，方便排查
window.addEventListener('error', (e) => { const m = document.getElementById('msg'); if (m) m.textContent = '脚本出错：' + e.message; });


const CROPS = {
  carrot: { name: '胡萝卜', icon: '🥕', seed: 5,  time: 15, sell: 8,  rare: { name: '金胡萝卜', icon: '🥕✨' } },
  tomato: { name: '番茄',   icon: '🍅', seed: 15, time: 40, sell: 25, rare: { name: '彩虹番茄', icon: '🍅🌈' } },
  corn:   { name: '玉米',   icon: '🌽', seed: 30, time: 70, sell: 50, rare: { name: '黄金玉米', icon: '🌽👑' } },
};
const RARE_MULT = 10; // 稀有作物卖价倍数

const RECIPES = [
  { id: 'cake',   name: '胡萝卜蛋糕', icon: '🍰', need: { carrot: 3 },                     price: 40 },
  { id: 'salad',  name: '蔬菜沙拉',   icon: '🥗', need: { carrot: 2, tomato: 1 },          price: 50 },
  { id: 'juice',  name: '番茄汁',     icon: '🧃', need: { tomato: 2 },                     price: 70 },
  { id: 'popcorn',name: '爆米花',     icon: '🍿', need: { corn: 1 },                       price: 75 },
  { id: 'curry',  name: '咖喱饭',     icon: '🍛', need: { carrot: 2, corn: 1 },            price: 100 },
  { id: 'stew',   name: '蔬菜炖锅',   icon: '🥘', need: { carrot: 1, tomato: 1, corn: 1 }, price: 110 },
  { id: 'sauce',  name: '番茄酱',     icon: '🥫', need: { tomato: 3 },                     price: 110 },
  { id: 'cornpie',name: '玉米饼',     icon: '🫓', need: { corn: 2 },                       price: 130 },
  { id: 'pizza',  name: '披萨',       icon: '🍕', need: { tomato: 2, corn: 1 },            price: 140 },
  { id: 'soup',   name: '玉米浓汤',   icon: '🍲', need: { corn: 2, carrot: 1 },            price: 150 },
];
const WHO = ['🧑', '👩', '👨', '🧓', '👧', '👦', '👵', '🧔']; // 顾客形象

const ORDER_REWARD = 1.5;   // 订单奖励 = 菜价 × 1.5
const ORDER_TIME = 120;     // 顾客等待秒数
const ORDER_GAP = 20;       // 新顾客间隔秒数
const MAX_ORDERS = 3;
const SHOP_DISH_MARKUP = 1.3; // 商城卖菜价 = 菜价 × 1.3
const SHOP_ING_MARKUP = 2.5;  // 商城卖食材价 = 卖价 × 2.5

// 转盘：[权重, 显示名, 倍数]，期望约 0.95，长期略亏
const GAMBLE = [[54, '全输', 0], [15, '×0.5', 0.5], [20, '×2', 2], [9, '×3', 3], [2, '×10', 10]];

// 24 节气（月, 日, 名称），日期为近似值
const TERMS = [[1,5,'小寒'],[1,20,'大寒'],[2,4,'立春'],[2,19,'雨水'],[3,6,'惊蛰'],[3,21,'春分'],
  [4,5,'清明'],[4,20,'谷雨'],[5,6,'立夏'],[5,21,'小满'],[6,6,'芒种'],[6,21,'夏至'],
  [7,7,'小暑'],[7,23,'大暑'],[8,7,'立秋'],[8,23,'处暑'],[9,8,'白露'],[9,23,'秋分'],
  [10,8,'寒露'],[10,23,'霜降'],[11,7,'立冬'],[11,22,'小雪'],[12,7,'大雪'],[12,22,'冬至']];

// 六爻：上卦(行) × 下卦(列)，顺序：乾 兑 离 震 巽 坎 艮 坤
const HEX = [
  ['乾','履','同人','无妄','姤','讼','遁','否'],
  ['夬','兑','革','随','大过','困','咸','萃'],
  ['大有','睽','离','噬嗑','鼎','未济','旅','晋'],
  ['大壮','归妹','丰','震','恒','解','小过','豫'],
  ['小畜','中孚','家人','益','巽','涣','渐','观'],
  ['需','节','既济','屯','井','坎','蹇','比'],
  ['大畜','损','贲','颐','蛊','蒙','艮','剥'],
  ['泰','临','明夷','复','升','师','谦','坤'],
];
const LUCK_TEXT = { '-1': '凶', 0: '平', 1: '吉', 2: '大吉' };

const SAVE_KEY = 'farm_game_v1';
const START_PLOTS = 6;
const MAX_PLOTS = 12;

// ===== 工具 =====
const $ = (id) => document.getElementById(id);
const say = (t) => { $('msg').textContent = t; };
const row = (l, r) => '<div class="item"><span>' + l + '</span>' + r + '</div>';
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const zero = (obj) => Object.fromEntries(Object.keys(obj).map((k) => [k, 0]));

function seeded(str) { // 同一天同一种子 -> 同一串随机数
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solarTerm(d) {
  const m = d.getMonth() + 1, day = d.getDate();
  let cur = TERMS[TERMS.length - 1];
  for (const t of TERMS) if (m > t[0] || (m === t[0] && day >= t[1])) cur = t;
  return cur[2];
}

function favored() { // 当季作物，卖价 +20%
  const m = new Date().getMonth() + 1;
  return m >= 6 && m <= 8 ? 'tomato' : m >= 9 && m <= 11 ? 'corn' : 'carrot';
}
const sellPrice = (k) => Math.round(CROPS[k].sell * (favored() === k ? 1.2 : 1));
const reward = (r) => Math.round(r.price * ORDER_REWARD);
const dishShopPrice = (r) => Math.round(r.price * SHOP_DISH_MARKUP);
const ingShopPrice = (k) => Math.round(CROPS[k].sell * SHOP_ING_MARKUP);
const plotCost = () => (state.plots.length - START_PLOTS + 1) * 100;

function luck() { return state.div && state.div.date === todayStr() ? state.div.luck : 0; }

// ===== 状态与存档 =====
function newState() {
  return {
    gold: 30,
    inv: zero(CROPS), rare: zero(CROPS), dishes: Object.fromEntries(RECIPES.map((r) => [r.id, 0])),
    plots: Array.from({ length: START_PLOTS }, () => null), // null 或 { crop, t, dur }
    selected: 'carrot', dex: {}, book: {}, orders: [], nextOrder: 0, div: null,
  };
}

function load() {
  const s = newState();
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (v && Array.isArray(v.plots)) {
      for (const k of ['inv', 'rare', 'dishes', 'dex', 'book']) Object.assign(s[k], v[k]);
      s.gold = v.gold ?? s.gold;
      s.plots = v.plots;
      s.selected = v.selected in CROPS ? v.selected : 'carrot';
      s.orders = v.orders || [];
      s.nextOrder = v.nextOrder || 0;
      s.div = v.div || null;
    }
  } catch (e) { /* 存档损坏就用新游戏 */ }
  return s;
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

let state = load();

// ===== 天气（按日历和当月气候生成，每 6 小时变化一次，不需要联网）=====
const MONTH_TEMP = [-12, -8, 0, 10, 18, 23, 25, 24, 17, 9, -1, -9]; // 各月平均气温
const MONTH_WET  = [1, 1, 2, 3, 3, 4, 5, 5, 3, 2, 2, 1];            // 各月降水倾向（夏季多雨）
let weather = { text: '晴', icon: '☀️', temp: 10, factor: 1, flood: false, name: '今日' };
let weatherKey = '';

function makeWeather(d) {
  const rnd = seeded('wx' + todayStr() + Math.floor(d.getHours() / 6)); // 同一时段结果固定
  const m = d.getMonth();
  const t = Math.round(MONTH_TEMP[m] + (rnd() - 0.5) * 10);
  const wet = MONTH_WET[m] * 0.06, r = rnd(), r2 = rnd();
  let text = '晴', icon = '☀️', f = 1, flood = false;
  if (r < wet) {
    if (t <= 0) { text = '下雪'; icon = '❄️'; f = 0.7; }
    else if (m >= 5 && m <= 7 && r2 < 0.25) { text = '暴雨洪涝'; icon = '🌊'; f = 0.5; flood = true; }
    else { text = '下雨'; icon = '🌧️'; f = 1.2; }
  } else if (r < wet + 0.3) { text = '多云'; icon = '⛅'; }
  if (!flood && text !== '下雪') {
    if (t <= 0) { text += '·霜冻'; f = Math.min(f, 0.6); }
    else if (t >= 30) { text += '·高温'; f = Math.min(f, 0.8); }
  }
  return { text, icon, temp: t, factor: f, flood, name: '今日' };
}

function refreshWeather() { // 时段变了才重新生成
  const d = new Date(), key = todayStr() + Math.floor(d.getHours() / 6);
  if (key === weatherKey) return;
  weatherKey = key; weather = makeWeather(d); renderWeather();
}

function renderWeather() {
  const d = new Date(), f = favored();
  $('weather').innerHTML =
    weather.icon + ' ' + weather.name + '：' + weather.text + ' ' + weather.temp + '°C' +
    '　📅 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + solarTerm(d) +
    '<br>🌱 种植速度 ×' + weather.factor + '（种下时按当前天气计算）　🌟 当季：' + CROPS[f].icon + CROPS[f].name + ' 卖价 +20%' +
    (weather.flood ? '<br>⚠️ 洪涝预警！现在种菜会很慢' : '');
}

// ===== 农田 =====
function plotInfo(p) {
  const c = CROPS[p.crop], dur = p.dur || c.time;
  const elapsed = (Date.now() - p.t) / 1000; // 用时间戳算，关掉网页作物也继续长
  return { c, left: Math.max(0, Math.ceil(dur - elapsed)), ready: elapsed >= dur };
}

function clickPlot(i) {
  const p = state.plots[i];
  if (!p) {
    const c = CROPS[state.selected];
    if (state.gold < c.seed) return say('金币不够买' + c.name + '种子！');
    state.gold -= c.seed;
    state.plots[i] = { crop: state.selected, t: Date.now(), dur: Math.round(c.time / weather.factor) };
    say('种下了' + c.icon + c.name + (weather.factor !== 1 ? '（天气影响：×' + weather.factor + '）' : ''));
  } else {
    const info = plotInfo(p);
    if (!info.ready) return say('还没成熟，再等 ' + info.left + ' 秒');
    const lk = luck(), c = info.c;
    state.dex[p.crop] = true;
    if (Math.random() < 0.05 + 0.03 * lk) { // 稀有
      state.rare[p.crop]++;
      state.dex[p.crop + '_rare'] = true;
      say('✨ 稀有！获得 ' + c.rare.icon + c.rare.name + '（可卖 ' + c.sell * RARE_MULT + '💰）');
    } else if (Math.random() < 0.15 + 0.05 * lk) { // 双倍
      state.inv[p.crop] += 2;
      say('🎉 双倍收成！' + c.icon + c.name + ' ×2');
    } else {
      state.inv[p.crop]++;
      say('收获了' + c.icon + c.name + '！');
    }
    state.plots[i] = null;
  }
  render();
}

function buyPlot() {
  const cost = plotCost();
  if (state.plots.length >= MAX_PLOTS) return;
  if (state.gold < cost) return say('金币不够，需要 ' + cost);
  state.gold -= cost;
  state.plots.push(null);
  say('买下了一块新地！');
  buildPlots();
  render();
}

// ===== 买卖 / 做菜 / 订单 =====
function sellRaw(k) {
  if (state.inv[k] < 1) return;
  state.inv[k]--; state.gold += sellPrice(k);
  say('卖出 ' + CROPS[k].icon + ' +' + sellPrice(k)); render();
}
function sellRare(k) {
  if (state.rare[k] < 1) return;
  state.rare[k]--; state.gold += CROPS[k].sell * RARE_MULT;
  say('卖出 ' + CROPS[k].rare.icon + ' +' + CROPS[k].sell * RARE_MULT + ' 💰'); render();
}

function cook(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  for (const k in r.need) if (state.inv[k] < r.need[k]) return say('食材不够！');
  for (const k in r.need) state.inv[k] -= r.need[k];
  state.dishes[id]++;
  state.book[id] = (state.book[id] || 0) + 1;
  say('做好了 ' + r.icon + r.name + '，放进库存');
  render();
}

function buy(s) {
  const [t, id] = s.split(':');
  if (t === 'dish') {
    const r = RECIPES.find((x) => x.id === id), p = dishShopPrice(r);
    if (state.gold < p) return say('金币不够！');
    state.gold -= p; state.dishes[id]++; say('从商城买了 ' + r.icon + r.name);
  } else {
    const p = ingShopPrice(id);
    if (state.gold < p) return say('金币不够！');
    state.gold -= p; state.inv[id]++; say('从商城买了 ' + CROPS[id].icon + CROPS[id].name);
  }
  render();
}

function serve(i) {
  const o = state.orders[i];
  if (!o) return;
  const r = RECIPES.find((x) => x.id === o.dish);
  if (state.dishes[o.dish] < 1) return say('没有 ' + r.name + '！去商城买或者自己做');
  state.dishes[o.dish]--;
  state.gold += reward(r);
  state.orders.splice(i, 1);
  say('顾客满意！' + r.icon + r.name + ' +' + reward(r) + ' 金币');
  render();
}

function spawnOrders() { // 返回订单列表是否变化
  const now = Date.now();
  const n = state.orders.length;
  state.orders = state.orders.filter((o) => o.exp > now);
  let changed = state.orders.length !== n;
  if (state.orders.length < MAX_ORDERS && now >= state.nextOrder) {
    const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    state.orders.push({ dish: r.id, who: WHO[Math.floor(Math.random() * WHO.length)], exp: now + ORDER_TIME * 1000 });
    state.nextOrder = now + ORDER_GAP * 1000;
    changed = true;
  }
  return changed;
}

// ===== 赌局（转盘）=====
let spinning = false;
function gamble(all) {
  if (spinning) return;
  const bet = all ? state.gold : 1;
  if (bet < 1 || state.gold < bet) return ($('gambleMsg').textContent = '没有金币可押了');
  spinning = true;
  state.gold -= bet; $('gold').textContent = state.gold;
  const total = GAMBLE.reduce((a, g) => a + g[0], 0);
  let r = Math.random() * total, hit = GAMBLE[0];
  for (const g of GAMBLE) { if (r < g[0]) { hit = g; break; } r -= g[0]; }
  let n = 0;
  const timer = setInterval(() => { // 转盘动画
    $('gambleMsg').textContent = '🎡 ' + GAMBLE[n++ % GAMBLE.length][1] + ' …';
    if (n > 14) {
      clearInterval(timer);
      const win = Math.floor(bet * hit[2]);
      state.gold += win; spinning = false;
      $('gambleMsg').textContent = (all ? '梭哈 ' : '') + '押 ' + bet + '：' +
        (hit[2] === 0 ? '💸 全输了！' : '🎉 ' + hit[1] + '，拿回 ' + win + '（' + (win >= bet ? '净赚 ' + (win - bet) : '亏 ' + (bet - win)) + '）');
      render();
    }
  }, 80);
}

// ===== 六爻（只做本卦，纯娱乐）=====
function castHexagram() {
  const day = todayStr();
  if (state.div && state.div.date === day) return say('今天已经起过卦了，明天再来');
  const rnd = seeded('liuyao' + day);
  const lines = []; // 每爻三枚硬币：6 老阴 7 少阳 8 少阴 9 老阳
  for (let i = 0; i < 6; i++) { let s = 0; for (let k = 0; k < 3; k++) s += rnd() < 0.5 ? 2 : 3; lines.push(s); }
  const y = lines.map((v) => (v % 2 === 1 ? 1 : 0)); // 从下往上
  const lower = 7 - (y[0] * 4 + y[1] * 2 + y[2]);
  const upper = 7 - (y[3] * 4 + y[4] * 2 + y[5]);
  const r = rnd();
  state.div = { date: day, lines, name: HEX[upper][lower], luck: r < 0.15 ? -1 : r < 0.45 ? 0 : r < 0.85 ? 1 : 2 };
  say('起卦完成：' + state.div.name + '卦');
  render();
}

function renderDiv() {
  const d = state.div, done = d && d.date === todayStr();
  $('castBtn').disabled = !!done;
  if (!done) { $('hex').textContent = '今日尚未起卦'; return; }
  const rows = [...d.lines].reverse().map((v) =>
    (v % 2 === 1 ? '━━━━━' : '━━  ━━') + (v === 9 ? ' ○' : v === 6 ? ' ×' : '')).join('\n');
  const lk = d.luck;
  $('hex').textContent = '《' + d.name + '》 ' + LUCK_TEXT[lk] + '\n' + rows +
    '\n稀有率 ' + Math.round((0.05 + 0.03 * lk) * 100) + '%　双倍率 ' + Math.round((0.15 + 0.05 * lk) * 100) + '%';
}

// ===== 界面 =====
function buildSeeds() {
  $('seeds').innerHTML = '';
  for (const key in CROPS) {
    const c = CROPS[key], b = document.createElement('button');
    b.className = 'seed'; b.dataset.key = key;
    b.textContent = c.icon + ' ' + c.name + '（' + c.seed + '💰 / ' + c.time + '秒）';
    $('seeds').appendChild(b);
  }
}

function buildPlots() {
  $('plots').innerHTML = '';
  state.plots.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'plot'; b.dataset.i = i;
    $('plots').appendChild(b);
  });
}

function updatePlots() { // 每秒只改文字和颜色，不重建按钮
  const btns = $('plots').children;
  state.plots.forEach((p, i) => {
    const b = btns[i];
    if (!b) return;
    if (!p) { b.className = 'plot'; b.textContent = '空地'; return; }
    const info = plotInfo(p);
    b.className = 'plot ' + (info.ready ? 'ready' : 'growing');
    b.textContent = info.ready ? info.c.icon + ' 可收获！' : '🌱 ' + info.c.icon + ' ' + info.left + '秒';
  });
}

function updateTimers() {
  document.querySelectorAll('.t').forEach((s) => {
    s.textContent = Math.max(0, Math.ceil((Number(s.dataset.exp) - Date.now()) / 1000)) + '秒';
  });
}

function render() {
  $('gold').textContent = state.gold;
  document.querySelectorAll('.seed').forEach((b) => b.classList.toggle('active', b.dataset.key === state.selected));

  const full = state.plots.length >= MAX_PLOTS;
  $('buyPlot').textContent = full ? '地块已满' : '买一块新地（' + plotCost() + '💰）';
  $('buyPlot').disabled = full;

  $('inventory').innerHTML = Object.keys(CROPS).map((k) => {
    const c = CROPS[k];
    let h = row(c.icon + ' ' + c.name + ' × ' + state.inv[k],
      '<button data-sell="' + k + '"' + (state.inv[k] < 1 ? ' disabled' : '') + '>卖1个 +' + sellPrice(k) + '💰</button>');
    if (state.rare[k] > 0) h += row(c.rare.icon + ' ' + c.rare.name + ' × ' + state.rare[k],
      '<button data-sellrare="' + k + '">卖1个 +' + c.sell * RARE_MULT + '💰</button>');
    return h;
  }).join('');

  $('orders').innerHTML = state.orders.length ? state.orders.map((o, i) => {
    const r = RECIPES.find((x) => x.id === o.dish), have = state.dishes[o.dish];
    return row((o.who || '🧑') + ' ' + r.icon + r.name + ' 奖励' + reward(r) + '💰　⏳<span class="t" data-exp="' + o.exp + '"></span>　库存 ' + have,
      '<button data-serve="' + i + '"' + (have < 1 ? ' disabled' : '') + '>出餐</button>');
  }).join('') : row('暂时没有顾客，稍等一下…', '');

  $('recipes').innerHTML = RECIPES.map((r) => {
    const need = Object.keys(r.need).map((k) => CROPS[k].icon + '×' + r.need[k]).join(' ');
    const ok = Object.keys(r.need).every((k) => state.inv[k] >= r.need[k]);
    return row(r.icon + ' ' + r.name + '（' + need + '）库存 ' + state.dishes[r.id],
      '<button data-cook="' + r.id + '"' + (ok ? '' : ' disabled') + '>制作</button>');
  }).join('');

  $('shop').innerHTML = RECIPES.map((r) => row(r.icon + ' ' + r.name + '（成品）',
    '<button data-buy="dish:' + r.id + '">' + dishShopPrice(r) + '💰</button>')).join('') +
    Object.keys(CROPS).map((k) => row(CROPS[k].icon + ' ' + CROPS[k].name + '（食材）',
      '<button data-buy="ing:' + k + '">' + ingShopPrice(k) + '💰</button>')).join('');

  $('dex').innerHTML = Object.keys(CROPS).map((k) => {
    const c = CROPS[k];
    return row(state.dex[k] ? c.icon + ' ' + c.name : '❓ 未发现', state.dex[k + '_rare'] ? c.rare.icon + ' ' + c.rare.name : '❓ 稀有种未发现');
  }).join('');

  $('book').innerHTML = RECIPES.map((r) => {
    const need = Object.keys(r.need).map((k) => CROPS[k].icon + '×' + r.need[k]).join(' ');
    return row(state.book[r.id] ? r.icon + ' ' + r.name + '（' + need + '）' : '❓ 未解锁（' + need + '）',
      state.book[r.id] ? '做过 ' + state.book[r.id] + ' 次' : '');
  }).join('');

  $('badge-orders').textContent = state.orders.length || '';
  renderDiv();
  updatePlots();
  updateTimers();
  save();
}

// ===== 事件 =====
function on(id, sel, attr, fn) {
  $(id).addEventListener('click', (e) => { const b = e.target.closest(sel); if (b) fn(b.dataset[attr]); });
}
on('seeds', '.seed', 'key', (k) => { state.selected = k; render(); });
on('plots', '.plot', 'i', (i) => clickPlot(Number(i)));
on('inventory', '[data-sell]', 'sell', sellRaw);
on('inventory', '[data-sellrare]', 'sellrare', sellRare);
on('orders', '[data-serve]', 'serve', (i) => serve(Number(i)));
on('recipes', '[data-cook]', 'cook', cook);
on('shop', '[data-buy]', 'buy', buy);
$('buyPlot').addEventListener('click', buyPlot);

// 侧边图标 -> 弹出面板
function closePanels() {
  document.querySelectorAll('.panel.open').forEach((p) => p.classList.remove('open'));
  $('backdrop').classList.remove('show');
}
document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => {
  closePanels();
  $('p-' + b.dataset.panel).classList.add('open');
  $('backdrop').classList.add('show');
}));
document.querySelectorAll('.close').forEach((b) => b.addEventListener('click', closePanels));
$('backdrop').addEventListener('click', closePanels);
$('bet1').addEventListener('click', () => gamble(false));
$('betAll').addEventListener('click', () => gamble(true));
$('castBtn').addEventListener('click', castHexagram);
$('reset').addEventListener('click', () => {
  if (confirm('确定要清空进度重新开始吗？')) {
    state = newState(); buildPlots(); render(); say('已重置，重新开始！');
  }
});

// ===== 启动 =====
buildSeeds();
buildPlots();
spawnOrders();
render();
refreshWeather();

setInterval(() => {
  refreshWeather();
  updatePlots();
  if (spawnOrders()) render(); else updateTimers();
  // 防卡死：没钱、没菜、地里没种东西时，送一点启动金
  const idle = state.plots.every((p) => !p) && Object.values(state.inv).every((n) => n === 0);
  if (state.gold < 5 && idle) { state.gold += 10; say('农场补贴了你 10 金币，继续加油！'); render(); }
}, 1000);