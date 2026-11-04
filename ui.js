// HALO LINK — 画面（ホーム・クエスト・編成・ガチャ・結果）と切り替え
'use strict';
const UI = (() => {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const stars = n => '★'.repeat(n);
  let cur = 'home';

  // ---------- 画面の切り替え（ノイズが走る） ----------
  async function go(id, arg) {
    if (id === cur && id !== 'battle') return;
    const gl = $('glitch'); gl.classList.remove('on'); void gl.offsetWidth; gl.classList.add('on');
    await sleep(160);
    document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));
    document.body.dataset.scr = id; cur = id;
    $('nav').classList.toggle('hide', id === 'battle');
    document.querySelectorAll('#nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id));
    if (id === 'home') home();
    if (id === 'quest') quest();
    if (id === 'party') party();
    if (id === 'gacha') gacha();
    if (id === 'battle') Battle.start(arg);
    hud();
  }
  function hud() {
    const s = Save.d;
    document.querySelectorAll('[data-hud=rank]').forEach(e => e.textContent = s.rank);
    document.querySelectorAll('[data-hud=stone]').forEach(e => e.textContent = s.stone.toLocaleString());
    document.querySelectorAll('[data-hud=exp]').forEach(e => e.style.transform = `scaleX(${s.exp / Save.need(s.rank)})`);
  }
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }

  // ---------- ホーム ----------
  function home() {
    const c = charById(Save.d.home) || CHARS[0];
    const art = $('homeArt'); art.src = 'ch_' + c.id + '.webp';
    $('homeName').innerHTML = `<i class="dot" style="background:${ATTR[c.attr].c}"></i>${c.name}`;
    setTimeout(talk, 600);
  }
  function talk() {
    const c = charById(Save.d.home) || CHARS[0];
    const t = $('talk'); t.querySelector('p').textContent = c.lines[Math.floor(Math.random() * c.lines.length)];
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(talk.t); talk.t = setTimeout(() => t.classList.remove('on'), 4000);
  }

  // ---------- クエスト ----------
  function quest() {
    $('qList').innerHTML = DUNGEONS.map((d, i) => {
      const n = Save.d.cleared[d.id] || 0, boss = d.floors.flat().map(k => ENEMIES[k]).find(e => e.boss);
      const face = boss || ENEMIES[d.floors[d.floors.length - 1][0]];
      return `<button class="qcard cut" data-q="${i}">
        <img src="${face.img}.webp" alt="">
        <div><em>${d.lv} ・ ${d.floors.length}F</em><b>${d.name}</b><small>${n ? `クリア ${n}回` : '<span class="new">NEW</span> 初回クリアで石+10'}</small></div>
        <span class="go">GO</span></button>`;
    }).join('');
  }

  // ---------- 編成 ----------
  let pick = null;   // 選び中の枠（0〜4、'f'＝フレンド）
  function party() {
    const s = Save.d;
    const slot = (id, k, lab) => {
      if (!id) return `<button class="slot empty cut" data-slot="${k}"><span>＋</span><em>${lab}</em></button>`;
      const c = charById(id);
      return `<button class="slot cut" data-slot="${k}" style="--c:${ATTR[c.attr].c}"><img src="ic_${id}.webp" alt=""><i class="dot" style="background:${ATTR[c.attr].c}"></i><em>${lab}</em></button>`;
    };
    $('pSlots').innerHTML = s.party.map((id, i) => slot(id, i, i === 0 ? 'LEADER' : 'SUB')).join('') + slot(s.friend, 'f', 'FRIEND');
    // 編成の合計とリーダースキル
    const ld = charById(s.party[0]), fr = charById(s.friend);
    const mem = [...s.party.filter(Boolean), s.friend].filter(Boolean).map(charById);
    $('pInfo').innerHTML = `<div class="ps"><span>HP</span><b>${mem.reduce((a, c) => a + c.hp, 0).toLocaleString()}</b></div>
      <div class="ps"><span>回復</span><b>${mem.reduce((a, c) => a + c.rcv, 0).toLocaleString()}</b></div>
      <div class="pl"><em>LEADER</em>${ld ? ld.ls.txt : '―'}</div><div class="pl"><em>FRIEND</em>${fr ? fr.ls.txt : '―'}</div>`;
    pick = null; $('pPick').classList.remove('on');
  }
  function openPick(k) {
    pick = k; const s = Save.d;
    const list = k === 'f' ? CHARS : CHARS.filter(c => s.owned[c.id]);
    const cur = k === 'f' ? s.friend : s.party[k];
    $('pPickT').textContent = k === 'f' ? 'フレンドを選ぶ（全キャラから）' : k === 0 ? 'リーダーを選ぶ' : 'メンバーを選ぶ';
    $('pPickL').innerHTML = (k !== 0 && k !== 'f' && cur ? `<button class="prow off" data-c="">この枠をはずす</button>` : '') + list.map(c => {
      const a = ATTR[c.attr], inP = k !== 'f' && s.party.includes(c.id) && c.id !== cur;
      const sl = s.owned[c.id]?.sl;
      return `<button class="prow ${c.id === cur ? 'cur' : ''}" data-c="${c.id}">
        <img src="ic_${c.id}.webp" alt=""><div><b>${c.name}</b><small><i class="dot" style="background:${a.c}"></i>${a.n} ・ <span class="st">${stars(c.rar)}</span>${sl ? ` ・ スキルLv${sl}` : ''}${inP ? ' ・ <u>編成中</u>' : ''}</small>
        <p><em>L</em>${c.ls.txt}</p><p><em>S</em>${c.sk.nm}：${c.sk.txt}（${Save.cdOf(c)}ターン）</p></div></button>`;
    }).join('');
    $('pPick').classList.add('on'); $('pPickL').scrollTop = 0;
  }
  function choose(id) {
    const s = Save.d;
    if (pick === 'f') s.friend = id || s.friend;
    else {
      const k = pick;
      if (!id) { if (k !== 0) s.party[k] = null; }
      else {
        const was = s.party.indexOf(id);
        if (was >= 0 && was !== k) s.party[was] = s.party[k];   // 入れ替え
        s.party[k] = id;
      }
    }
    Save.put(); party(); Sfx.play('ok');
  }

  // ---------- ガチャ ----------
  function gacha() {
    $('gOwned').innerHTML = CHARS.map(c => `<span class="${Save.d.owned[c.id] ? 'have' : ''}"><img src="ic_${c.id}.webp" alt=""></span>`).join('');
  }
  function roll() {
    const r = Math.random() * 100; let acc = 0, rar = 5;
    for (const [k, v] of Object.entries(GACHA.rate).sort((a, b) => b[0] - a[0])) { acc += v; if (r < acc) { rar = +k; break; } }
    const pool = CHARS.filter(c => c.rar === rar);
    return (pool.length ? pool : CHARS)[Math.floor(Math.random() * (pool.length || CHARS.length))];
  }
  async function pull(n) {
    const s = Save.d, cost = n === 1 ? GACHA.cost1 : GACHA.cost10;
    if (s.stone < cost) { toast(`石が足りません（あと${cost - s.stone}個）`); Sfx.play('back'); return; }
    s.stone -= cost;
    const res = [];
    for (let i = 0; i < n; i++) {
      const c = roll(), o = s.owned[c.id];
      let tag;
      if (!o) { s.owned[c.id] = {sl:1}; tag = 'NEW'; }
      else if (o.sl < GACHA.maxSl) { o.sl++; tag = 'SKILL Lv' + o.sl; }
      else { s.coin += 1000; tag = 'コイン +1000'; }
      res.push({c, tag});
    }
    Save.put(); hud();
    await show(res);
    gacha(); hud();
  }
  // 演出：ゲートが光る → 1枚ずつ開く → まとめ
  async function show(res) {
    const ov = $('gx'), best = Math.max(...res.map(r => r.c.rar));
    ov.className = 'on charge r' + best; ov.innerHTML = `<div class="gring"></div><div class="gring b"></div><div class="gstream"></div><p class="gtx">DOWNLOADING<span>...</span></p><button class="gskip">SKIP</button>`;
    Sfx.play('gate'); vib(30);
    let skip = false; ov.querySelector('.gskip').onclick = e => { e.stopPropagation(); skip = true; };
    await sleep(1500);
    if (!skip) for (let i = 0; i < res.length; i++) {
      if (skip) break;
      const {c, tag} = res[i];
      ov.className = 'on reveal r' + c.rar;
      ov.innerHTML = `<div class="gburst"></div><img class="gart" src="ch_${c.id}.webp" alt="">
        <div class="gcard"><span class="st">${stars(c.rar)}</span><b>${c.name}</b><small><i class="dot" style="background:${ATTR[c.attr].c}"></i>${ATTR[c.attr].n}属性 ・ ${c.type}</small><em class="${tag === 'NEW' ? 'nw' : ''}">${tag}</em></div>
        <p class="gnext">${i + 1} / ${res.length}　タップで次へ</p>${res.length > 1 ? '<button class="gskip">SKIP</button>' : ''}`;
      Sfx.play('rare', c.rar); vib(c.rar >= 6 ? 60 : 20);
      const sk = ov.querySelector('.gskip'); if (sk) sk.onclick = e => { e.stopPropagation(); skip = true; ov.click(); };
      await new Promise(r => { ov.onclick = () => { ov.onclick = null; r(); }; });
      Sfx.play('tap');
    }
    // まとめ
    ov.className = 'on sum';
    ov.innerHTML = `<h3>RESULT</h3><div class="gsum">${res.map(({c, tag}) => `<div class="r${c.rar}"><img src="ic_${c.id}.webp" alt=""><span class="st">${stars(c.rar)}</span><em class="${tag === 'NEW' ? 'nw' : ''}">${tag}</em></div>`).join('')}</div><button class="big cut" id="gOk">OK</button>`;
    await new Promise(r => { $('gOk').onclick = r; });
    ov.className = ''; ov.innerHTML = ''; Sfx.play('ok');
  }

  // ---------- 結果 ----------
  function result(win, html, retry) {
    const o = $('over');
    o.innerHTML = `<div class="ovbox cut ${win ? 'win' : 'lose'}"><h2>${win ? 'CLEAR' : 'GAME OVER'}</h2>${html}
      <button class="big cut" data-r>${win ? 'もう一度' : 'やり直す'}</button><button class="sub cut" data-h>ホームへ</button></div>`;
    o.classList.add('on');
    o.querySelector('[data-r]').onclick = () => { o.classList.remove('on'); retry(); };
    o.querySelector('[data-h]').onclick = () => { o.classList.remove('on'); go('home'); };
    hud();
  }

  // ---------- つなぎこみ ----------
  function init() {
    $('nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { Sfx.play('tap'); go(b.dataset.go); } });
    $('homeTap').onclick = () => { talk(); Sfx.play('tap'); };
    $('homeGo').onclick = () => { Sfx.play('ok'); go('quest'); };
    $('qList').addEventListener('click', e => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      if (!Save.d.party[0]) { toast('リーダーを編成してください'); return; }
      Sfx.play('ok'); go('battle', DUNGEONS[+b.dataset.q]);
    });
    $('pSlots').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; Sfx.play('tap'); const k = b.dataset.slot; openPick(k === 'f' ? 'f' : +k); });
    $('pPickL').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) choose(b.dataset.c); });
    $('pPickX').onclick = () => { $('pPick').classList.remove('on'); Sfx.play('back'); };
    $('pHome').onclick = () => { if (!Save.d.party[0]) return; Save.d.home = Save.d.party[0]; Save.put(); toast('リーダーをホームに置きました'); Sfx.play('ok'); };
    $('g1').onclick = () => pull(1);
    $('g10').onclick = () => pull(10);
    document.body.dataset.scr = 'home';
    home(); hud();
  }
  return { init, go, result, toast };
})();

Battle.init();
UI.init();
