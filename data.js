// HALO LINK — データ（キャラ・敵・ダンジョン・ガチャ）。追加はこのファイルだけで済むようにしている
'use strict';

// 属性：玉の色と名前。heart は回復の玉
const ATTR = {
  fire:{n:'火', c:'#ff5a4a'}, water:{n:'水', c:'#3ea8ff'}, wood:{n:'木', c:'#46e07a'},
  light:{n:'光', c:'#ffd64a'}, dark:{n:'闇', c:'#b862ff'}, heart:{n:'回復', c:'#ff6fc0'},
};
const ORBS = ['fire', 'water', 'wood', 'light', 'dark', 'heart'];
// 有利属性（2倍）：火→木→水→火、光⇔闇
const STRONG = { fire:'wood', wood:'water', water:'fire', light:'dark', dark:'light' };

// ===== キャラ =====
// rar：レア度（星の数）
// ls：リーダースキル
//   attr {attrs, atk, hp, rcv}  指定属性の能力を倍
//   combo {min, atk}            ○コンボ以上で攻撃力を倍
//   len {min, atk}              ○個以上つなぐと攻撃力を倍
//   all {atk, rcv}              全員の能力を倍
// sk：スキル（cd＝使えるまでのターン。スキルLvが1上がるごとに1短くなる）
//   board {colors}              盤面を指定の色だけにする
//   conv {from, to}             色を変える
//   nuke {mult, attr}           敵全体に、攻撃力×倍率のダメージ
//   heal {}                     HPを全回復
//   shield {rate, turns}        受けるダメージを減らす
//   time {sec, turns}           操作時間をのばす
//   boost {attr, atk, turns}    指定属性の攻撃力を上げる
const CHARS = [
  { id:'noa', name:'乃亜', rar:6, attr:'light', type:'バランス', hp:3100, atk:1250, rcv:320,
    ls:{t:'attr', attrs:['light', 'dark'], atk:2.5, txt:'光と闇属性の攻撃力が2.5倍'},
    sk:{t:'board', colors:['light', 'dark', 'heart'], cd:12, nm:'ねこの手ルーレット', txt:'盤面を光・闇・回復の3色に変える'},
    lines:['今日も来てくれたんですね。', 'お疲れさまです。少しだけ休んでいきませんか。', 'そんなに見られると、照れます。', '準備はできています。いつでもどうぞ。'] },
  { id:'mika', name:'ミカ', rar:6, attr:'light', type:'攻撃', hp:2800, atk:1550, rcv:260,
    ls:{t:'len', min:7, atk:4, txt:'7個以上つなぐと、攻撃力が4倍'},
    sk:{t:'nuke', mult:40, attr:'light', cd:12, nm:'星降りの祈り', txt:'敵全体に、攻撃力の40倍の光属性ダメージ'},
    lines:['ねえ、今日はどこに連れていってくれるの？', '星がきれいな夜は、ちょっと特別な気分になるよね。'] },
  { id:'ellen', name:'エレン・ジョー', rar:5, attr:'dark', type:'攻撃', hp:2900, atk:1450, rcv:200,
    ls:{t:'attr', attrs:['dark'], atk:3, txt:'闇属性の攻撃力が3倍'},
    sk:{t:'conv', from:'fire', to:'dark', cd:8, nm:'片付けの時間', txt:'火の玉を、すべて闇の玉に変える'},
    lines:['……仕事だから、やるだけ。', '早く終わらせて、甘いものでも食べたい。'] },
  { id:'yuuka', name:'ユウカ', rar:5, attr:'water', type:'バランス', hp:3400, atk:1050, rcv:280,
    ls:{t:'combo', min:5, atk:3, txt:'5コンボ以上で、攻撃力が3倍'},
    sk:{t:'time', sec:3, turns:2, cd:9, nm:'演算サポート', txt:'2ターンの間、操作時間を3秒のばす'},
    lines:['計算なら任せてください。', '無駄な動きは減らしましょう。効率よく。'] },
  { id:'hoshino', name:'ホシノ', rar:5, attr:'fire', type:'体力', hp:3800, atk:1150, rcv:240,
    ls:{t:'attr', attrs:['fire'], atk:2, hp:1.5, txt:'火属性のHPが1.5倍、攻撃力が2倍'},
    sk:{t:'shield', rate:.5, turns:2, cd:9, nm:'盾を構える', txt:'2ターンの間、受けるダメージを半分にする'},
    lines:['前は任せて。後ろは頼んだよ。', 'のんびりいこう。急いでも疲れるだけだし。'] },
  { id:'kisaki', name:'キサキ', rar:5, attr:'wood', type:'回復', hp:3000, atk:1100, rcv:440,
    ls:{t:'all', atk:1.5, rcv:1.5, txt:'全員の攻撃力と回復力が1.5倍'},
    sk:{t:'heal', cd:10, nm:'お茶の時間', txt:'HPを全回復する'},
    lines:['お茶でもいかがかしら。', '焦らずに。盤面はよく見て。'] },
];
const charById = id => CHARS.find(c => c.id === id);

// ===== 敵 =====
// img：画像ファイル名。hue：色相をずらす角度（色違いを作る）
const ENEMIES = {
  fox:   {n:'ホロ狐',         img:'en_01', attr:'water', hp:9000,  atk:1300, cd:2},
  drake: {n:'回路竜',         img:'en_02', attr:'water', hp:14000, atk:1800, cd:2},
  owl:   {n:'光翼フクロウ',   img:'en_03', attr:'light', hp:10000, atk:1500, cd:3},
  golem: {n:'苔むすゴーレム', img:'en_04', attr:'wood',  hp:22000, atk:2400, cd:3},
  slime: {n:'うさスライム',   img:'en_05', attr:'water', hp:7000,  atk:1100, cd:1},
  cat:   {n:'夜猫',           img:'en_06', attr:'dark',  hp:9500,  atk:1600, cd:2},
  // 色違い（画像は同じで、色と属性だけ変える）
  slimeR:{n:'うさスライム（赤）', img:'en_05', attr:'fire',  hp:7000, atk:1100, cd:1, hue:150},
  slimeG:{n:'うさスライム（緑）', img:'en_05', attr:'wood',  hp:7000, atk:1100, cd:1, hue:-90},
  slimeY:{n:'うさスライム（金）', img:'en_05', attr:'light', hp:7000, atk:1100, cd:1, hue:200},
  foxR:  {n:'焔狐',               img:'en_01', attr:'fire',  hp:9000, atk:1300, cd:2, hue:150},
  // ボス
  crystal:{n:'結晶竜ヘイロン',    img:'boss_01', attr:'dark', hp:180000, atk:6000, cd:3, boss:true},
};

// ===== ダンジョン =====
// floors：フロアごとの敵の並び
const DUNGEONS = [
  { id:'d1', name:'試しの回廊', lv:'初級', bg:'bg_battle', reward:{stone:5, exp:120},
    floors:[['slime', 'slimeR'], ['slimeG', 'fox', 'slimeY'], ['golem']] },
  { id:'d2', name:'結晶竜の巣', lv:'中級', bg:'bg_battle', reward:{stone:10, exp:300},
    floors:[['fox', 'cat'], ['owl', 'drake'], ['foxR', 'golem', 'cat'], ['crystal']] },
];

// ===== ガチャ =====
// 星ごとの出る確率（合計100）。同じ星の中は均等
const GACHA = { cost1:5, cost10:50, rate:{6:10, 5:90}, maxSl:5 };
