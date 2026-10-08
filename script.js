// ===== 游戏配置：以后加作物、菜谱，只需要在这里加几行 =====
const CROPS = {
  carrot: { name: '胡萝卜', icon: '🥕', seed: 5,  time: 15, sell: 8 },
  tomato: { name: '番茄',   icon: '🍅', seed: 15, time: 40, sell: 25 },
  corn:   { name: '玉米',   icon: '🌽', seed: 30, time: 70, sell: 50 },
};

const RECIPES = [
  { id: 'salad', name: '蔬菜沙拉', icon: '🥗', need: { carrot: 2, tomato: 1 }, price: 50 },
  { id: 'soup',  name: '玉米浓汤', icon: '🍲', need: { corn: 2, carrot: 1 },   price: 150 },
];

const SAVE_KEY = 'farm_game_v1';
const START_PLOTS = 6;
const MAX_PLOTS = 12;

// ===== 状态与存档 =====
function newState() {
  return {
    gold: 30,
    inv: { carrot: 0, tomato: 0, corn: 0 },
    plots: Array.from({ length: START_PLOTS }, () => null), // null 或 { crop, t: 种下的时间戳 }
    selected: 'carrot',
  };
}

function load() {
  const s = newState();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && Array.isArray(saved.plots)) {
      s.gold = saved.gold ?? s.gold;
      s.inv = Object.assign(s.inv, saved.inv);
      s.plots = saved.plots;
      s.selected = saved.selected in CROPS ? saved.selected : 'carrot';
    }
  } catch (e) { /* 存档损坏就用新游戏 */ }
  return s;
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}

let state = load();

// ===== 工具函数 =====
const $ = (id) => document.getElementById(id);

function say(text) { $('msg').textContent = text; }

function plotInfo(p) {
  const c = CROPS[p.crop];
  const elapsed = (Date.now() - p.t) / 1000; // 用时间戳算，关掉网页作物也会继续长
  return { c, left: Math.max(0, Math.ceil(c.time - elapsed)), ready: elapsed >= c.time };
}

function plotCost() { return (state.plots.length - START_PLOTS + 1) * 100; }

// ===== 操作 =====
function clickPlot(i) {
  const p = state.plots[i];
  if (!p) {
    const c = CROPS[state.selected];
    if (state.gold < c.seed) return say('金币不够买' + c.name + '种子！');
    state.gold -= c.seed;
    state.plots[i] = { crop: state.selected, t: Date.now() };
    say('种下了' + c.icon + c.name);
  } else {
    const info = plotInfo(p);
    if (!info.ready) return say('还没成熟，再等 ' + info.left + ' 秒');
    state.inv[p.crop]++;
    state.plots[i] = null;
    say('收获了' + info.c.icon + info.c.name + '！');
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

function sellRaw(key) {
  if (state.inv[key] < 1) return;
  state.inv[key]--;
  state.gold += CROPS[key].sell;
  say('卖出 ' + CROPS[key].icon + ' +' + CROPS[key].sell);
  render();
}

function cook(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  for (const k in r.need) if (state.inv[k] < r.need[k]) return say('食材不够！');
  for (const k in r.need) state.inv[k] -= r.need[k];
  state.gold += r.price;
  say(r.icon + r.name + ' 卖给了顾客，+' + r.price + ' 金币！');
  render();
}

// ===== 界面 =====
function buildSeeds() {
  const box = $('seeds');
  box.innerHTML = '';
  for (const key in CROPS) {
    const c = CROPS[key];
    const b = document.createElement('button');
    b.className = 'seed';
    b.dataset.key = key;
    b.textContent = c.icon + ' ' + c.name + '（' + c.seed + '💰 / ' + c.time + '秒）';
    box.appendChild(b);
  }
}

function buildPlots() {
  const box = $('plots');
  box.innerHTML = '';
  state.plots.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'plot';
    b.dataset.i = i;
    box.appendChild(b);
  });
}

// 每秒只更新地块上的文字和颜色，不重建按钮，避免点击丢失
function updatePlots() {
  const btns = $('plots').children;
  state.plots.forEach((p, i) => {
    const b = btns[i];
    if (!b) return;
    if (!p) {
      b.className = 'plot';
      b.textContent = '空地';
    } else {
      const info = plotInfo(p);
      b.className = 'plot ' + (info.ready ? 'ready' : 'growing');
      b.textContent = info.ready
        ? info.c.icon + ' 可收获！'
        : '🌱 ' + info.c.icon + ' ' + info.left + '秒';
    }
  });
}

function render() {
  $('gold').textContent = state.gold;

  document.querySelectorAll('.seed').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === state.selected);
  });

  const full = state.plots.length >= MAX_PLOTS;
  const buy = $('buyPlot');
  buy.textContent = full ? '地块已满' : '买一块新地（' + plotCost() + '💰）';
  buy.disabled = full;

  $('inventory').innerHTML = Object.keys(CROPS).map((k) => {
    const c = CROPS[k];
    return '<div class="item"><span>' + c.icon + ' ' + c.name + ' × ' + state.inv[k] + '</span>' +
      '<button data-sell="' + k + '"' + (state.inv[k] < 1 ? ' disabled' : '') + '>卖出1个 +' + c.sell + '💰</button></div>';
  }).join('');

  $('recipes').innerHTML = RECIPES.map((r) => {
    const need = Object.keys(r.need).map((k) => CROPS[k].icon + '×' + r.need[k]).join(' ');
    const ok = Object.keys(r.need).every((k) => state.inv[k] >= r.need[k]);
    return '<div class="item"><span>' + r.icon + ' ' + r.name + '（' + need + '）</span>' +
      '<button data-cook="' + r.id + '"' + (ok ? '' : ' disabled') + '>制作 +' + r.price + '💰</button></div>';
  }).join('');

  updatePlots();
  save();
}

// ===== 事件 =====
$('seeds').addEventListener('click', (e) => {
  const b = e.target.closest('.seed');
  if (!b) return;
  state.selected = b.dataset.key;
  render();
});
$('plots').addEventListener('click', (e) => {
  const b = e.target.closest('.plot');
  if (b) clickPlot(Number(b.dataset.i));
});
$('inventory').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sell]');
  if (b) sellRaw(b.dataset.sell);
});
$('recipes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cook]');
  if (b) cook(b.dataset.cook);
});
$('buyPlot').addEventListener('click', buyPlot);
$('reset').addEventListener('click', () => {
  if (confirm('确定要清空进度重新开始吗？')) {
    state = newState();
    buildPlots();
    render();
    say('已重置，重新开始！');
  }
});

// ===== 启动 =====
buildSeeds();
buildPlots();
render();

setInterval(() => {
  updatePlots();
  // 防卡死：没钱、没菜、地里也没种东西时，送一点启动金
  const nothingPlanted = state.plots.every((p) => !p);
  const nothingInInv = Object.values(state.inv).every((n) => n === 0);
  if (state.gold < 5 && nothingPlanted && nothingInInv) {
    state.gold += 10;
    say('农场补贴了你 10 金币，继续加油！');
    render();
  }
}, 1000);