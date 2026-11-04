// HALO LINK — 盤面（7×6）と一筆書きのなぞり
'use strict';
const Board = (() => {
  const COLS = 7, ROWS = 6;
  let cv, g, cell = 54, dpr = 1, grid = [], path = [], fx = [], drawing = false, hooks = {};
  const img = {};
  ORBS.forEach(t => { const i = new Image(); i.src = 'orb_' + t + '.webp'; img[t] = i; });
  const rnd = () => ORBS[Math.floor(Math.random() * ORBS.length)];

  function init(canvas, h) {
    cv = canvas; g = cv.getContext('2d'); hooks = h;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    requestAnimationFrame(loop);
  }
  function fit() {
    cell = Math.floor(Math.min(innerWidth, 480) / COLS);
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = cell * COLS * dpr; cv.height = cell * ROWS * dpr;
    cv.style.width = cell * COLS + 'px'; cv.style.height = cell * ROWS + 'px';
  }
  // 新しい盤面：上から降ってくる
  function fill() {
    grid = [];
    for (let r = 0; r < ROWS; r++) { grid.push([]); for (let c = 0; c < COLS; c++) grid[r].push({t:rnd(), oy:-(ROWS + 1) * cell - r * 8, vy:0}); }
  }
  // スキルで色を変える（少し跳ねさせる）
  function morph(fn) { grid.forEach(row => row.forEach(o => { const t = fn(o.t); if (t && t !== o.t) { o.t = t; o.oy = -cell * .35; o.vy = 0; o.flash = 1; } })); }

  // 画面上の座標（玉が飛ぶ演出用）
  function pagePos(r, c) { const b = cv.getBoundingClientRect(); return {x:b.left + c * cell + cell / 2, y:b.top + r * cell + cell / 2}; }

  // ---------- 描画 ----------
  function loop() {
    requestAnimationFrame(loop);
    if (!grid.length || !cv.offsetParent) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cell * COLS, H = cell * ROWS;
    g.clearRect(0, 0, W, H);
    // 下地：暗いマスと細い格子
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(20,32,70,.92)' : 'rgba(14,22,52,.92)'; g.fillRect(c * cell, r * cell, cell, cell);
    }
    g.strokeStyle = 'rgba(79,243,255,.08)'; g.lineWidth = 1; g.beginPath();
    for (let c = 1; c < COLS; c++) { g.moveTo(c * cell + .5, 0); g.lineTo(c * cell + .5, H); }
    for (let r = 1; r < ROWS; r++) { g.moveTo(0, r * cell + .5); g.lineTo(W, r * cell + .5); }
    g.stroke();

    const head = path.length ? grid[path[0].r][path[0].c].t : null;
    // なぞった線（光る太い線＋白い芯）。長いほど太く
    if (path.length > 1) {
      const col = ATTR[head].c, w = cell * (.16 + Math.min(path.length, 12) * .012);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.save(); g.shadowColor = col; g.shadowBlur = 18;
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      path.forEach((p, i) => { const x = p.c * cell + cell / 2, y = p.r * cell + cell / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = w * .35; g.stroke();
    }
    // 玉
    const sel = new Set(path.map(p => p.r * COLS + p.c)), now = performance.now();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const o = grid[r][c]; if (!o) continue;
      // 落下：重力と、着地で小さく跳ねる
      if (o.oy < 0 || o.vy) { o.vy += cell * .045; o.oy += o.vy; if (o.oy >= 0) { o.oy = 0; o.vy = o.vy > cell * .12 ? -o.vy * .28 : 0; } }
      const on = sel.has(r * COLS + c);
      const dim = head && !on && o.t !== head;
      const x = c * cell + cell / 2, y = r * cell + cell / 2 + o.oy;
      let s = cell * (on ? .5 : .44);
      if (on) s *= 1 + Math.sin(now / 90) * .03;
      g.globalAlpha = dim ? .28 : 1;
      if (on) { g.save(); g.shadowColor = ATTR[o.t].c; g.shadowBlur = 16; }
      if (img[o.t].complete && img[o.t].naturalWidth) g.drawImage(img[o.t], x - s, y - s, s * 2, s * 2);
      else { g.fillStyle = ATTR[o.t].c; g.beginPath(); g.arc(x, y, s * .9, 0, 7); g.fill(); }
      if (on) g.restore();
      if (o.flash) { g.globalAlpha = o.flash * .8; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * .9, 0, 7); g.fill(); o.flash = Math.max(0, o.flash - .06); }
      g.globalAlpha = 1;
    }
    // 消えたときの光（輪と粒）
    fx = fx.filter(f => f.life > 0);
    fx.forEach(f => {
      f.life -= f.ring ? .05 : .035;
      g.globalAlpha = Math.max(0, f.life);
      if (f.ring) { g.strokeStyle = f.c; g.lineWidth = 3 * f.life; g.beginPath(); g.arc(f.x, f.y, cell * (.55 - f.life * .3), 0, 7); g.stroke(); }
      else { f.x += f.vx; f.y += f.vy; f.vy += .18; g.fillStyle = f.c; g.fillRect(f.x - 2, f.y - 2, 4 * f.life + 1, 4 * f.life + 1); }
    });
    g.globalAlpha = 1;
  }

  // ---------- なぞる ----------
  function cellAt(e, strict) {
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    // 斜めに通りやすいよう、マスの中心付近だけを当たりにする
    if (strict) { const dx = x - (c * cell + cell / 2), dy = y - (r * cell + cell / 2); if (dx * dx + dy * dy > (cell * .44) ** 2) return null; }
    return {r, c};
  }
  function down(e) {
    if (!hooks.allowed()) return;
    const p = cellAt(e, false); if (!p) return;
    cv.setPointerCapture(e.pointerId);
    hooks.start();
    drawing = true; path = [p]; vib(5); Sfx.play('link', 0);
  }
  function move(e) {
    if (!drawing) return;
    const p = cellAt(e, true); if (!p) return;
    const last = path[path.length - 1];
    if (p.r === last.r && p.c === last.c) return;
    // 一つ前のマスに戻ったら取り消し
    if (path.length > 1) { const pv = path[path.length - 2]; if (pv.r === p.r && pv.c === p.c) { path.pop(); Sfx.play('link', path.length - 1); return; } }
    if (Math.abs(p.r - last.r) > 1 || Math.abs(p.c - last.c) > 1) return;
    if (path.some(q => q.r === p.r && q.c === p.c)) return;
    if (grid[p.r][p.c].t !== grid[path[0].r][path[0].c].t) return;
    path.push(p); vib(4); Sfx.play('link', path.length - 1);
  }
  function up() { if (!drawing) return; drawing = false; commit(); }
  // 時間切れのとき、なぞり途中の線も確定する
  function finish() { if (drawing) { drawing = false; commit(); } path = []; }

  function commit() {
    const p = path; path = [];
    if (p.length < 3) return;
    const t = grid[p[0].r][p[0].c].t;
    const pos = p.map(q => pagePos(q.r, q.c));
    p.forEach(q => {
      const x = q.c * cell + cell / 2, y = q.r * cell + cell / 2;
      fx.push({x, y, ring:true, life:1, c:ATTR[t].c});
      for (let i = 0; i < 5; i++) fx.push({x, y, vx:(Math.random() - .5) * 5, vy:-Math.random() * 4 - 1, life:1, c:i % 2 ? '#fff' : ATTR[t].c});
      grid[q.r][q.c] = null;
    });
    // 残った玉を下に詰め、空いたところに上から補充
    for (let c = 0; c < COLS; c++) {
      const keep = [];
      for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) keep.push({o:grid[r][c], from:r});
      const miss = ROWS - keep.length;
      for (let k = 0, r = ROWS - 1; r >= 0; r--, k++) {
        if (k < keep.length) { const {o, from} = keep[k]; o.oy += (from - r) * cell; grid[r][c] = o; }
        else grid[r][c] = {t:rnd(), oy:-miss * cell - (k - keep.length) * 6, vy:0};
      }
    }
    hooks.line(t, p.length, pos);
  }
  return { init, fit, fill, morph, finish, peek:() => grid.map(r => r.map(o => o && o.t)), get drawing() { return drawing; } };
})();
