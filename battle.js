// HALO LINK — バトル（計算・敵の行動・スキル・演出）
'use strict';
const Battle = (() => {
  const B = {};
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lenMult = n => 1 + (n - 3) * .25;          // 4個で1.25倍、7個で2倍
  const comboMult = c => 1 + (c - 1) * .25;        // 2コンボで1.25倍、5コンボで2倍

  // ---------- 開始 ----------
  function start(dg) {
    const s = Save.d;
    const ids = [...s.party.filter(Boolean), s.friend].filter(Boolean);
    const mem = ids.map((id, i) => { const c = charById(id); const cd = Save.cdOf(c); return {...c, cd, cdNow:Math.ceil(cd / 2), friend:i === ids.length - 1}; });
    const leads = [mem[0].ls, mem[mem.length - 1].ls];
    let maxHp = 0;
    mem.forEach(m => { let h = m.hp; leads.forEach(l => { if (l.hp && l.attrs.includes(m.attr)) h *= l.hp; }); maxHp += Math.round(h); });
    Object.assign(B, {dg, mem, leads, maxHp, hp:maxHp, floor:0, busy:true, buffs:[], target:null, lines:[], combos:0, running:false, turn:0});
    $('bBg').style.backgroundImage = `url(${dg.bg}.webp)`;
    $('bName').textContent = dg.name;
    paintParty(); paintHp(); Board.fit(); Board.fill();
    loadFloor();
  }

  // ---------- 入力の時間 ----------
  function limit() { return 5 + B.buffs.filter(b => b.t === 'time').reduce((s, b) => s + b.sec, 0); }
  function begin() {
    if (B.running) return;
    B.running = true; B.lines = []; B.combos = 0; B.end = performance.now() + limit() * 1000;
    closeSheet(); tick();
  }
  function tick() {
    if (!B.running) return;
    const left = Math.max(0, B.end - performance.now());
    $('tBar').style.transform = `scaleX(${left / (limit() * 1000)})`;
    $('tNum').textContent = (left / 1000).toFixed(1);
    if (left <= 0) return endInput();
    requestAnimationFrame(tick);
  }
  function endInput() {
    B.running = false; Board.finish();
    $('tBar').style.transform = 'scaleX(0)'; $('tNum').textContent = '';
    if (B.lines.length) resolve();
  }
  // 1本つないだとき：コンボ表示と、玉がキャラへ飛ぶ演出
  function onLine(t, n, pos) {
    B.lines.push({t, n}); B.combos++;
    const cb = $('combo'); cb.innerHTML = `<b>${B.combos}</b><span>COMBO</span>${n >= 5 ? `<em>${n} LINK</em>` : ''}`;
    cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop');
    Sfx.play('clear', B.combos); vib(12);
    const icons = [...$('pt').children].filter((el, i) => t === 'heart' ? false : B.mem[i].attr === t);
    const goal = icons.length ? icons : [$('hp')];
    pos.forEach((p, i) => goal.forEach(el => fly(p, el, ATTR[t].c, i * 25)));
  }
  function fly(from, toEl, col, delay) {
    const r = toEl.getBoundingClientRect(), d = document.createElement('i');
    d.className = 'spark'; d.style.background = col; d.style.boxShadow = `0 0 10px ${col},0 0 4px #fff`;
    document.body.appendChild(d);
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    d.animate([{transform:`translate(${from.x}px,${from.y}px) scale(1.2)`}, {transform:`translate(${(from.x + tx) / 2 + (Math.random() - .5) * 80}px,${Math.min(from.y, ty) - 40}px) scale(1)`, offset:.45}, {transform:`translate(${tx}px,${ty}px) scale(.4)`, opacity:.3}],
      {duration:520, delay, easing:'cubic-bezier(.4,0,.2,1)', fill:'both'}).onfinish = () => d.remove();
  }

  // ---------- 計算 ----------
  function lsMult(m, kind) {
    let x = 1;
    B.leads.forEach(l => {
      if (kind === 'atk') {
        if (l.t === 'attr' && l.attrs.includes(m.attr)) x *= l.atk;
        if (l.t === 'combo' && B.combos >= l.min) x *= l.atk;
        if (l.t === 'len' && B.lines.some(v => v.n >= l.min)) x *= l.atk;
        if (l.t === 'all') x *= l.atk;
      }
      if (kind === 'rcv' && l.rcv && (l.t === 'all' || l.attrs?.includes(m.attr))) x *= l.rcv;
    });
    return x;
  }
  async function resolve() {
    B.busy = true;
    await sleep(380);
    const cm = comboMult(B.combos);
    // 回復
    const hearts = B.lines.filter(l => l.t === 'heart');
    if (hearts.length) {
      const rcv = B.mem.reduce((s, m) => s + m.rcv * lsMult(m, 'rcv'), 0);
      const heal = Math.round(hearts.reduce((s, l) => s + rcv * lenMult(l.n), 0) * cm);
      B.hp = Math.min(B.maxHp, B.hp + heal); paintHp(); popAt($('hp'), '+' + heal.toLocaleString(), '#7dffa8', 'heal'); Sfx.play('heal');
      await sleep(320);
    }
    // 攻撃：キャラごとに順番に撃つ
    const shots = [];
    B.mem.forEach((m, i) => {
      const mine = B.lines.filter(l => l.t === m.attr); if (!mine.length) return;
      let dmg = mine.reduce((s, l) => s + m.atk * lenMult(l.n), 0) * cm * lsMult(m, 'atk');
      B.buffs.filter(b => b.t === 'boost' && b.attr === m.attr).forEach(b => dmg *= b.atk);
      shots.push({m, i, dmg});
    });
    for (const s of shots) {
      const tg = pickTarget(); if (!tg) break;
      shoot(s.i, tg, s.m.attr, s.dmg);
      await sleep(190);
    }
    $('combo').classList.remove('pop');
    await sleep(520);
    if (!alive()) return floorClear();
    await enemyTurn(); if (B.hp <= 0) return;
    // ターン経過
    B.turn++;
    B.mem.forEach(m => { if (m.cdNow > 0) m.cdNow--; });
    B.buffs.forEach(b => b.turns--); B.buffs = B.buffs.filter(b => b.turns > 0);
    paintParty(); paintHp(); paintBuffs();
    B.busy = false;
  }
  function pickTarget() {
    const al = B.enemies.filter(e => e.hp > 0);
    return al.find(e => e === B.target) || al[0];
  }
  // キャラのアイコンから敵へ、光の弾を飛ばす
  function shoot(i, e, attr, dmg) {
    const pm = $('pt').children[i]; pm.classList.remove('atk'); void pm.offsetWidth; pm.classList.add('atk');
    const a = pm.getBoundingClientRect(), b = e.el.querySelector('img').getBoundingClientRect();
    const d = document.createElement('i'); d.className = 'shot'; const col = ATTR[attr].c;
    d.style.background = `radial-gradient(circle,#fff 0 25%,${col} 45%,transparent 70%)`;
    document.body.appendChild(d); Sfx.play('shot');
    const ax = a.left + a.width / 2, ay = a.top, bx = b.left + b.width / 2 + (Math.random() - .5) * b.width * .3, by = b.top + b.height * .5;
    d.animate([{transform:`translate(${ax}px,${ay}px) scale(.6)`}, {transform:`translate(${bx}px,${by}px) scale(1.4)`}], {duration:260, easing:'cubic-bezier(.5,0,.9,.6)', fill:'both'})
      .onfinish = () => { d.remove(); hit(e, dmg, attr); burst(bx, by, col); };
  }
  function burst(x, y, col) {
    for (let k = 0; k < 8; k++) {
      const p = document.createElement('i'); p.className = 'spark'; p.style.background = k % 2 ? '#fff' : col; document.body.appendChild(p);
      const an = Math.random() * 6.28, r = 30 + Math.random() * 40;
      p.animate([{transform:`translate(${x}px,${y}px)`}, {transform:`translate(${x + Math.cos(an) * r}px,${y + Math.sin(an) * r}px) scale(.2)`, opacity:0}], {duration:420, easing:'ease-out', fill:'both'}).onfinish = () => p.remove();
    }
  }
  function hit(e, dmg, attr) {
    let mark = '';
    if (STRONG[attr] === e.attr) { dmg *= 2; mark = 'weak'; }
    else if (STRONG[e.attr] === attr) { dmg /= 2; mark = 'resist'; }
    dmg = Math.round(dmg);
    e.hp = Math.max(0, e.hp - dmg);
    const el = e.el; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    popAt(el.querySelector('img'), dmg.toLocaleString(), ATTR[attr].c, mark);
    Sfx.play('hit'); vib(10);
    paintEnemy(e);
    if (e.hp <= 0) { el.classList.add('dead'); if (B.target === e) B.target = null; }
  }

  // ---------- 敵の番 ----------
  async function enemyTurn() {
    for (const e of B.enemies) {
      if (e.hp <= 0) continue;
      e.cdNow--;
      if (e.cdNow <= 0) {
        e.cdNow = e.cd;
        e.el.classList.remove('lunge'); void e.el.offsetWidth; e.el.classList.add('lunge');
        await sleep(240);
        let d = e.atk; B.buffs.filter(b => b.t === 'shield').forEach(b => d *= (1 - b.rate)); d = Math.round(d);
        B.hp = Math.max(0, B.hp - d);
        const sc = $('battle'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
        $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
        popAt($('hp'), '-' + d.toLocaleString(), '#ff6a5a', 'dmg'); Sfx.play('enemy'); vib(45);
        paintHp(); await sleep(480);
        if (B.hp <= 0) { lose(); return; }
      }
      paintEnemy(e);
    }
  }

  // ---------- スキル：アイコンを押すと説明、使えるときは「使う」 ----------
  function openSheet(i) {
    const m = B.mem[i], a = ATTR[m.attr], ready = m.cdNow <= 0;
    const sl = Save.d.owned[m.id]?.sl || 1;
    const lead = i === 0 ? 'リーダー' : m.friend ? 'フレンド' : '';
    $('sheet').innerHTML = `<div class="sh-hd"><img src="ic_${m.id}.webp" alt=""><div><b>${m.name}</b><small><i class="dot" style="background:${a.c}"></i>${a.n}属性 ${lead ? '・' + lead : ''}</small></div><button class="x" data-x>閉じる</button></div>
      <div class="sh-sk"><em>SKILL <span>Lv${sl}</span></em><b>${m.sk.nm}</b><p>${m.sk.txt}</p></div>
      ${(i === 0 || m.friend) ? `<div class="sh-ls"><em>LEADER SKILL</em><p>${m.ls.txt}</p></div>` : ''}
      <button class="sh-go ${ready ? 'on' : ''}" ${ready ? '' : 'disabled'} data-use="${i}">${ready ? 'スキルを使う' : `あと ${m.cdNow} ターン`}</button>`;
    $('sheet').classList.add('on'); Sfx.play('tap');
  }
  function closeSheet() { $('sheet').classList.remove('on'); }
  async function useSkill(i) {
    const m = B.mem[i]; if (m.cdNow > 0 || B.busy || B.running) return;
    closeSheet(); B.busy = true;
    await cutin(m);
    const s = m.sk; let msg = '';
    if (s.t === 'board') { Board.morph(() => s.colors[Math.floor(Math.random() * s.colors.length)]); msg = '盤面が ' + s.colors.map(c => ATTR[c].n).join('・') + ' になった'; }
    if (s.t === 'conv') { Board.morph(t => t === s.from ? s.to : null); msg = `${ATTR[s.from].n}の玉が${ATTR[s.to].n}になった`; }
    if (s.t === 'heal') { const h = B.maxHp - B.hp; B.hp = B.maxHp; popAt($('hp'), '+' + h.toLocaleString(), '#7dffa8', 'heal'); Sfx.play('heal'); msg = 'HPが全回復した'; }
    if (s.t === 'shield') { B.buffs.push({t:'shield', rate:s.rate, turns:s.turns, nm:'盾'}); msg = `${s.turns}ターン、受けるダメージ半減`; }
    if (s.t === 'time') { B.buffs.push({t:'time', sec:s.sec, turns:s.turns, nm:'時間'}); msg = `${s.turns}ターン、操作時間 +${s.sec}秒`; }
    if (s.t === 'boost') { B.buffs.push({t:'boost', attr:s.attr, atk:s.atk, turns:s.turns, nm:'攻撃'}); msg = `${ATTR[s.attr].n}属性の攻撃力 ${s.atk}倍`; }
    m.cdNow = m.cd; paintParty(); paintHp(); paintBuffs();
    note(msg);
    if (s.t === 'nuke') {
      for (const e of B.enemies.filter(x => x.hp > 0)) { shoot(i, e, s.attr, m.atk * s.mult); await sleep(240); }
      await sleep(600);
    }
    B.busy = false;
    if (!alive()) floorClear();
  }
  // カットイン：キャラを大きく出して、スキル名と効果を見せる（タップで飛ばせる）
  function cutin(m) {
    const c = $('cut'), col = ATTR[m.attr].c;
    c.style.setProperty('--c', col);
    c.querySelector('img').src = 'ch_' + m.id + '.webp';
    c.querySelector('.cn').textContent = m.name;
    c.querySelector('.cs').textContent = m.sk.nm;
    c.querySelector('.cd').textContent = m.sk.txt;
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    Sfx.play('skill'); vib(25);
    return new Promise(res => {
      const done = () => { clearTimeout(t); c.onclick = null; c.classList.add('out'); setTimeout(() => { c.classList.remove('on', 'out'); res(); }, 260); };
      const t = setTimeout(done, 1900); c.onclick = done;
    });
  }
  function note(t) { if (!t) return; const n = $('note'); n.textContent = t; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on'); }

  // ---------- フロア ----------
  async function loadFloor() {
    B.busy = true;
    const fl = B.dg.floors[B.floor], last = B.floor === B.dg.floors.length - 1;
    $('bFloor').textContent = `${B.floor + 1}/${B.dg.floors.length}`;
    B.enemies = fl.map(k => { const d = ENEMIES[k]; return {...d, key:k, hp:d.hp, max:d.hp, cdNow:d.cd}; });
    B.target = null;
    const box = $('enemies'); box.innerHTML = ''; box.classList.toggle('boss', B.enemies.some(e => e.boss));
    const bar = $('bossBar'); bar.classList.toggle('on', B.enemies.some(e => e.boss));
    B.enemies.forEach(e => {
      const el = document.createElement('div'); el.className = 'en' + (e.boss ? ' big' : '');
      const col = ATTR[e.attr].c;
      el.innerHTML = `<div class="ecd">あと<b>${e.cdNow}</b></div>
        <img src="${e.img}.webp" alt="" style="filter:${e.hue ? `hue-rotate(${e.hue}deg) ` : ''}drop-shadow(0 0 12px ${col}88)">
        <div class="ehp"><i class="dot" style="background:${col}"></i><span><b></b></span></div>`;
      el.onclick = () => { if (e.hp <= 0) return; B.target = B.target === e ? null : e; B.enemies.forEach(x => x.el.classList.toggle('tgt', x === B.target)); Sfx.play('tap'); };
      e.el = el; box.appendChild(el); paintEnemy(e);
      el.animate([{opacity:0, transform:'translateY(-30px) scale(.9)'}, {opacity:1, transform:'none'}], {duration:420, delay:120, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
    });
    await banner(last && B.enemies.some(e => e.boss) ? 'WARNING' : `FLOOR ${B.floor + 1}`, last && B.enemies.some(e => e.boss));
    B.busy = false;
  }
  function banner(t, warn) {
    const b = $('banner'); b.textContent = t; b.className = warn ? 'warn on' : 'on';
    Sfx.play(warn ? 'warn' : 'floor');
    return sleep(warn ? 1300 : 800).then(() => { b.className = ''; });
  }
  async function floorClear() {
    B.busy = true; await sleep(500);
    B.floor++;
    if (B.floor >= B.dg.floors.length) return win();
    B.mem.forEach(m => { if (m.cdNow > 0) m.cdNow--; }); paintParty();
    loadFloor();
  }
  const alive = () => B.enemies && B.enemies.some(e => e.hp > 0);

  // ---------- 終わり ----------
  function win() {
    const s = Save.d, first = !s.cleared[B.dg.id];
    const st = B.dg.reward.stone + (first ? 10 : 0);
    s.stone += st; s.cleared[B.dg.id] = (s.cleared[B.dg.id] || 0) + 1;
    const up = Save.addExp(B.dg.reward.exp);
    Sfx.play('win');
    UI.result(true, `<div class="rw"><span>経験値</span><b>+${B.dg.reward.exp}</b></div><div class="rw"><span>石</span><b>+${st}</b>${first ? '<em>初回クリア +10</em>' : ''}</div>${up ? `<div class="rw up"><span>RANK UP</span><b>${s.rank}</b><em>石 +${up * 5}</em></div>` : ''}`, () => start(B.dg));
  }
  function lose() { B.busy = true; Sfx.play('lose'); UI.result(false, '<p>パーティーが倒れました</p>', () => start(B.dg)); }

  // ---------- 表示 ----------
  function paintParty() {
    $('pt').innerHTML = B.mem.map((m, i) => `<button class="pm ${m.cdNow <= 0 ? 'ready' : ''} ${i === 0 ? 'ld' : ''} ${m.friend ? 'fr' : ''}" data-i="${i}" style="--c:${ATTR[m.attr].c}">
      <img src="ic_${m.id}.webp" alt=""><i class="dot" style="background:${ATTR[m.attr].c}"></i><span>${m.cdNow <= 0 ? 'SKILL' : m.cdNow}</span></button>`).join('');
  }
  function paintHp() {
    const r = B.hp / B.maxHp, el = $('hp');
    el.querySelector('i').style.transform = `scaleX(${r})`; el.classList.toggle('low', r < .3);
    el.querySelector('span').textContent = `${B.hp.toLocaleString()} / ${B.maxHp.toLocaleString()}`;
  }
  function paintBuffs() { $('buffs').innerHTML = B.buffs.map(b => `<span>${b.nm} ${b.turns}</span>`).join(''); }
  function paintEnemy(e) {
    const r = e.hp / e.max;
    e.el.querySelector('.ehp span').style.setProperty('--r', r);
    const cd = e.el.querySelector('.ecd'); cd.querySelector('b').textContent = e.cdNow; cd.classList.toggle('warn', e.cdNow <= 1);
    if (e.boss) { const bb = $('bossBar'); bb.querySelector('i').style.transform = `scaleX(${r})`; bb.querySelector('b').textContent = e.n; bb.querySelector('span').textContent = e.hp.toLocaleString(); }
  }
  function popAt(el, txt, col, kind = '') {
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'pop ' + kind; p.textContent = txt; p.style.color = col;
    p.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 36) + 'px';
    p.style.top = (r.top + r.height * (kind === 'heal' || kind === 'dmg' ? -.2 : .35)) + 'px';
    if (kind === 'weak') p.dataset.t = 'WEAK'; if (kind === 'resist') p.dataset.t = 'RESIST';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1000);
  }

  // ---------- つなぎこみ ----------
  function init() {
    Board.init($('board'), { allowed:() => !B.busy && alive() && !!B.mem, start:begin, line:onLine });
    $('pt').addEventListener('click', e => { const pm = e.target.closest('.pm'); if (!pm || B.running) return; openSheet(+pm.dataset.i); });
    $('sheet').addEventListener('click', e => { if (e.target.closest('[data-x]')) { closeSheet(); Sfx.play('back'); } const u = e.target.closest('[data-use]'); if (u) useSkill(+u.dataset.use); });
    $('retreat').onclick = () => { if (B.running) return; if (confirmRetreat()) UI.go('home'); };
    addEventListener('resize', () => { if (B.mem && $('battle').classList.contains('on')) Board.fit(); });
  }
  let retreatAt = 0;
  function confirmRetreat() { const n = Date.now(); if (n - retreatAt < 2000) return true; retreatAt = n; note('もう一度押すと撤退します'); return false; }
  return { init, start, dbg:() => B };
})();
