// HALO LINK — 保存（この端末のブラウザに保存。v0.3でIndexedDBと書き出し・読み込みに移す）
'use strict';
const Save = (() => {
  const KEY = 'halolink-save-v1';
  const DEF = () => ({
    rank:1, exp:0, stone:100, coin:0,
    owned:{ noa:{sl:1}, yuuka:{sl:1}, hoshino:{sl:1}, kisaki:{sl:1} },   // 最初に持っているキャラ
    party:['noa', 'yuuka', 'hoshino', 'kisaki', null], friend:'mika', home:'noa',
    cleared:{},
  });
  let d = DEF();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) d = Object.assign(DEF(), s); } catch (e) {}
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  // ランクに必要な経験値
  const need = r => 100 + (r - 1) * 60;
  function addExp(x) {
    d.exp += x; let up = 0;
    while (d.exp >= need(d.rank)) { d.exp -= need(d.rank); d.rank++; d.stone += 5; up++; }
    put(); return up;
  }
  // スキルLvを反映した、スキルのターン数
  const cdOf = c => Math.max(1, c.sk.cd - ((d.owned[c.id]?.sl || 1) - 1));
  return { get d() { return d; }, put, need, addExp, cdOf, reset() { d = DEF(); put(); } };
})();
