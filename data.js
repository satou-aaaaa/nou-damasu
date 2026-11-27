// 脳がだます？（錯視）の問題を作る（ブラウザと node の両方で使う）。
// 1問は、ゲームの中で SVG で描いた錯視の図を見て「どちらが長い？」「AとB、明るいのは？」などに答える（1段目・3つから）。
// 正解したら2段目「こう変えたら、錯覚は？」（強くなる・弱くなる・変わらない）を選ぶ。
// 図の長さ・明るさ・ずれはここで整数で決め、答えもここで計算する（目で見た感じでは決めない）。
// 答え合わせの図（rev）は、まわり（矢羽・円・線・影）を薄くし、補助線・取り出した色で本当の値を見せる。
// 名前・年・2段目の答えの出どころは下の SRC（論文・The Illusions Index・スタンフォード哲学百科事典・MIT のページ・大学の教科書）。
// 錯覚の量（何％長く見えるか）の数字は使わない。Dewar 1967 から使うのは「矢羽の角度がせまいほど錯覚が大きい」という向きだけ。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS は最後に足すだけにし、足す種類には since:"YYYY-MM-DD"（出し始める日・公開の翌日以降）を付ける。
// 日の抽選はその日にあった種類だけから選ぶので、過去の日と今日の5問は変わらない。各種類の値の並び（DIFF・M2 など）も最後に足すだけ。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」と「このゲームについて」に出す）
  const SRC = {
    ml: ["Müller-Lyer 1889「Optische Urtheilstäuschungen」Archiv für Physiologie Suppl. 263–270（書誌）", "https://vlp-new.ur.de/records/lit5535"],
    mlx: ["The Illusions Index「Müller-Lyer Illusion」（グラスゴー大学）", "https://www.illusionsindex.org/i/mueller-lyer"],
    dewar: ["Dewar 1967「Stimulus determinants of the magnitude of the Mueller-Lyer illusion」Perceptual and Motor Skills 24", "https://www.appstate.edu/~steelekm/classes/psy4215/Documents/Dewar1967-muller-lyer.pdf"],
    sep: ["スタンフォード哲学百科事典「The Problem of Perception」§3.3.2", "https://plato.stanford.edu/entries/perception-problem/"],
    ebb: ["The Illusions Index「Ebbinghaus Illusion」（Titchener 1901 が広めた）", "https://www.illusionsindex.org/i/ebbinghaus-illusion"],
    ponzo: ["The Illusions Index「Ponzo Illusion」（Ponzo 1910）", "https://www.illusionsindex.org/i/ponzo-illusion"],
    hering: ["The Illusions Index「Hering Illusion」（Hering 1861）", "https://www.illusionsindex.org/i/hering-illusion"],
    pogg: ["The Illusions Index「Poggendorff Illusion」（1860）", "https://www.illusionsindex.org/i/poggendorff-illusion"],
    cafe: ["Gregory & Heard 1979「Border locking and the Café Wall illusion」Perception 8: 365–380", "https://richardgregory.org/papers/cafe_wall/cafe-wall_all.htm"],
    cafex: ["The Illusions Index「Café Wall Illusion」", "https://www.illusionsindex.org/i/cafe-wall-illusion"],
    adelx: ["The Illusions Index「Adelson's Checker-Shadow Illusion」（Adelson の MIT のページ ©1995 を引く）", "https://illusionsindex.org/ir/20-checkershadow"],
    olman: ["Olman 編『Introduction to Sensation and Perception』10.4 Simultaneous Contrast（ミネソタ大学）", "https://open.lib.umn.edu/sensationandperception/chapter/simultaneous-contrast/"],
  };

  // 2段目「こう変えたら、錯覚は？」の3つ（いつもこの順で出す）
  const GROUPS = {
    up: { name: "強くなる", sub: "もっとだまされる" },
    down: { name: "弱くなる", sub: "だまされにくい" },
    same: { name: "変わらない", sub: "見え方はそのまま" },
  };
  // 図はまるごと同じ形になる（上下・左右を入れかえる）→ 変わらない
  const SAMEWHY = "入れかえても、図はもとと同じ形です。同じ図なら、錯覚も同じだけ起きます。";

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end

  // ---- SVG の小さな部品（図の数は整数。data-t は答えに使う部分。QA はここから長さ・明るさを測り直す）----
  const W = 320, H = 200, BG = "#fbf8f0", INK = "#222", HI = "#1f5fae";
  const svg = (body, label) => `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>${body}</svg>`;
  const line = (x1, y1, x2, y2, w, c, extra = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
  const dash = (x1, y1, x2, y2) => line(x1, y1, x2, y2, 1.5, HI, ` stroke-dasharray="5 4"`);
  const label = (x, y, t) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="${INK}" stroke-width="1.5"/><text x="${x}" y="${y + 5}" font-size="14" font-weight="700" text-anchor="middle" fill="${INK}">${t}</text>`;
  const gray = (g) => { const h = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, "0"); return `#${h}${h}${h}`; };
  const cmp = (a, b, A, B, S) => (a === b ? S : a > b ? A : B);
  const pct = (R, xs) => xs[ri(R, 0, xs.length - 1)];

  // ---- ミュラー・リヤー：2本の横線。片方は外向きの矢羽（><）、片方は内向き（<>）----
  function mlFig(L1, L2, outTop, deg, fade) {
    const f = 22, a = (deg / 2) * Math.PI / 180, dx = Math.round(f * Math.cos(a)), dy = Math.round(f * Math.sin(a));
    const one = (L, y, out, t) => {
      const x1 = 160 - Math.floor(L / 2), x2 = x1 + L, s = out ? 1 : -1, op = fade ? ` opacity=".25"` : "";
      return line(x1, y, x2, y, fade ? 4 : 3, fade ? HI : INK, ` data-t="${t}"`) +
        line(x1, y, x1 - s * dx, y - dy, 3, INK, op) + line(x1, y, x1 - s * dx, y + dy, 3, INK, op) +
        line(x2, y, x2 + s * dx, y - dy, 3, INK, op) + line(x2, y, x2 + s * dx, y + dy, 3, INK, op);
    };
    return one(L1, 60, outTop, 1) + one(L2, 140, !outTop, 2);
  }
  const ML_M2 = [
    { t: "矢羽どうしの角度を、もっとせまくする（30°）", a: "up", why: "Dewar（1967）は、矢羽どうしの角度が小さいほど錯覚が大きいと測りました（30°でいちばん大きく、120°でいちばん小さい）。", src: ["dewar"] },
    { t: "矢羽どうしの角度を、広くする（120°）", a: "down", why: "Dewar（1967）は、矢羽どうしの角度が大きいほど錯覚が小さいと測りました。", src: ["dewar"] },
    { t: "この図で、長さを合わせる練習を何度もくり返す", a: "down", why: "Dewar（1967）では、くり返し合わせるうちに錯覚が小さくなりました。", src: ["dewar"] },
    { t: "矢羽を消して、線だけにする", a: "down", why: "錯覚を起こしているのは両はしの矢羽です。矢羽が無ければ、ただの2本の線です。", src: ["mlx"] },
    { t: "上の図と下の図を入れかえる", a: "same", why: SAMEWHY, src: ["mlx"] },
  ];
  function mlMake(diffs) {
    return (R) => {
      const L = pct(R, [130, 140, 150, 160]), d = pct(R, diffs), outTop = R() < 0.5, m = ri(R, 0, ML_M2.length - 1);
      const L1 = L, L2 = Math.round(L * (1 + d / 100));
      return {
        q: "長いのはどっち？", opts: ["上", "下", "同じ"], ans: cmp(L1, L2, "上", "下", "同じ"),
        svg: svg(mlFig(L1, L2, outTop, 60, false), "2本の横線。両はしに矢羽"),
        rev: svg(mlFig(L1, L2, outTop, 60, true) + dash(160 - Math.floor(L1 / 2), 40, 160 - Math.floor(L1 / 2), 160) + dash(160 - Math.floor(L1 / 2) + L1, 40, 160 - Math.floor(L1 / 2) + L1, 160), "矢羽を薄くし、線の両はしに補助線を引いた図"),
        real: `上の線 ${L1}・下の線 ${L2}`, m2: ML_M2[m], v: [L, d, outTop ? 1 : 0, m].join(","),
      };
    };
  }

  // ---- エビングハウス：まん中の円。片方は大きな円に、片方は小さな円にかこまれる ----
  function ebbFig(r1, r2, bigLeft, fade) {
    const ring = (cx, r, big) => {
      const n = big ? 6 : 8, ir = big ? 22 : 7, d = r + ir + (big ? 8 : 5), op = fade ? ` opacity=".2"` : "";
      let s = "";
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; s += `<circle cx="${Math.round(cx + d * Math.cos(a))}" cy="${Math.round(100 + d * Math.sin(a))}" r="${ir}" fill="#8a8a8a"${op}/>`; }
      return s;
    };
    return ring(80, r1, bigLeft) + ring(240, r2, !bigLeft) +
      `<circle cx="80" cy="100" r="${r1}" fill="${fade ? HI : "#d9622b"}" data-t="1"/><circle cx="240" cy="100" r="${r2}" fill="${fade ? HI : "#d9622b"}" data-t="2"/>`;
  }
  const EBB_M2 = [
    { t: "まわりの円を全部消す", a: "down", why: "まん中の円の大きさを変えて見せているのは、まわりの円です。消すと、くらべるのは2つの円だけになります。", src: ["ebb"] },
    { t: "左と右の図を入れかえる", a: "same", why: SAMEWHY, src: ["ebb"] },
  ];
  function ebbMake(diffs) {
    return (R) => {
      const r = pct(R, [16, 17, 18, 19]), d = pct(R, diffs), bigLeft = R() < 0.5, m = ri(R, 0, EBB_M2.length - 1);
      const r1 = r, r2 = Math.round(r * (1 + d / 100));
      return {
        q: "まん中の円、大きいのはどっち？", opts: ["左", "右", "同じ"], ans: cmp(r1, r2, "左", "右", "同じ"),
        svg: svg(ebbFig(r1, r2, bigLeft, false), "まん中の円が2つ。まわりを大きな円と小さな円がかこむ"),
        rev: svg(ebbFig(r1, r2, bigLeft, true) + dash(80 - r1, 100, 240 + r2, 100), "まわりの円を薄くし、まん中の円の大きさを見せた図"),
        real: `左の円の半径 ${r1}・右の円の半径 ${r2}`, m2: EBB_M2[m], v: [r, d, bigLeft ? 1 : 0, m].join(","),
      };
    };
  }

  // ---- 明るさの対比：暗い地と明るい地の上に、灰色の四角 A・B ----
  function brFig(g1, g2, darkLeft, fade) {
    const bl = darkLeft ? 40 : 230, br = darkLeft ? 230 : 40;
    return (fade ? `<rect x="0" y="0" width="320" height="200" fill="#c8c8c8"/>` : `<rect x="0" y="0" width="160" height="200" fill="${gray(bl)}"/><rect x="160" y="0" width="160" height="200" fill="${gray(br)}"/>`) +
      `<rect x="50" y="60" width="60" height="60" fill="${gray(g1)}" data-t="1" data-g="${g1}"/><rect x="210" y="60" width="60" height="60" fill="${gray(g2)}" data-t="2" data-g="${g2}"/>` + label(80, 150, "A") + label(240, 150, "B");
  }
  const BR_M2 = [
    { t: "左右の地を、1つの色にそろえる", a: "down", why: "灰色は、より暗いものの隣で明るく見えます。地がそろえば、くらべるのは2つの四角だけです。", src: ["olman"] },
    { t: "左と右の図を入れかえる", a: "same", why: SAMEWHY, src: ["olman"] },
  ];
  function brMake(diffs) {
    return (R) => {
      const g = pct(R, [110, 120, 128, 136]), d = pct(R, diffs), darkLeft = R() < 0.5, m = ri(R, 0, BR_M2.length - 1);
      const g1 = g, g2 = Math.round(g * (1 + d / 100));
      return {
        q: "A と B、明るいのはどっち？", opts: ["A", "B", "同じ"], ans: cmp(g1, g2, "A", "B", "同じ"),
        svg: svg(brFig(g1, g2, darkLeft, false), "暗い地と明るい地の上に、灰色の四角 A と B"),
        rev: svg(brFig(g1, g2, darkLeft, true), "地を同じ灰色にそろえた図"),
        real: `明るさ（0〜255）A ${g1}・B ${g2}`, m2: BR_M2[m], v: [g, d, darkLeft ? 1 : 0, m].join(","),
      };
    };
  }

  // ---- ポンゾ：上で近づく2本の斜めの線の中に、2本の横線 ----
  function ponzoFig(L1, L2, fade) {
    const op = fade ? ` opacity=".2"` : "";
    return line(40, 196, 140, 4, 3, INK, op) + line(280, 196, 180, 4, 3, INK, op) +
      line(160 - Math.floor(L1 / 2), 55, 160 - Math.floor(L1 / 2) + L1, 55, fade ? 5 : 4, fade ? HI : "#d9622b", ` data-t="1"`) +
      line(160 - Math.floor(L2 / 2), 160, 160 - Math.floor(L2 / 2) + L2, 160, fade ? 5 : 4, fade ? HI : "#d9622b", ` data-t="2"`);
  }
  const PONZO_M2 = [
    { t: "斜めの2本の線を消す", a: "down", why: "上の横線を長く見せているのは、上で近づく斜めの線です。消すと、くらべるのは2本の横線だけです。", src: ["ponzo"] },
    { t: "図を左右反対（鏡うつし）にする", a: "same", why: SAMEWHY, src: ["ponzo"] },
  ];
  function ponzoMake(diffs) {
    return (R) => {
      const L = pct(R, [60, 64, 68, 72]), d = pct(R, diffs), m = ri(R, 0, PONZO_M2.length - 1);
      const L1 = L, L2 = Math.round(L * (1 + d / 100));
      return {
        q: "横の線、長いのはどっち？", opts: ["上", "下", "同じ"], ans: cmp(L1, L2, "上", "下", "同じ"),
        svg: svg(ponzoFig(L1, L2, false), "上で近づく2本の斜めの線と、その中の2本の横線"),
        rev: svg(ponzoFig(L1, L2, true) + dash(160 - Math.floor(L1 / 2), 40, 160 - Math.floor(L1 / 2), 175) + dash(160 - Math.floor(L1 / 2) + L1, 40, 160 - Math.floor(L1 / 2) + L1, 175), "斜めの線を薄くし、横線の両はしに補助線を引いた図"),
        real: `上の線 ${L1}・下の線 ${L2}`, m2: PONZO_M2[m], v: [L, d, m].join(","),
      };
    };
  }

  // ---- ヘリング：まん中から広がる線の上に、2本の縦の線。b は線のまん中のふくらみ（外向きが +）----
  function heringFig(b, fade) {
    const op = fade ? ` opacity=".2"` : "";
    let s = "";
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI; s += line(Math.round(160 - 200 * Math.cos(a)), Math.round(100 - 200 * Math.sin(a)), Math.round(160 + 200 * Math.cos(a)), Math.round(100 + 200 * Math.sin(a)), 1.5, "#666", op); }
    const c = (x, s2) => `<path d="M${x} 12 Q${x + s2 * 2 * b} 100 ${x} 188" fill="none" stroke="${fade ? HI : "#d9622b"}" stroke-width="4" data-t="${s2 < 0 ? 1 : 2}" data-b="${s2 * b}"/>`;
    return s + c(115, -1) + c(205, 1) + (fade ? dash(115, 8, 115, 192) + dash(205, 8, 205, 192) : "");
  }
  const HER_M2 = [
    { t: "まん中から広がる線を消す", a: "down", why: "縦の線を曲げて見せているのは、まん中から広がる線です。消すと、縦の線だけが残ります。", src: ["hering"] },
    { t: "図を上下さかさまにする", a: "same", why: SAMEWHY, src: ["hering"] },
  ];
  function heringMake(bs) {
    return (R) => {
      const b = pct(R, bs), m = ri(R, 0, HER_M2.length - 1);
      return {
        q: "2本の縦の線は？", opts: ["まっすぐ", "外へふくらむ", "内へへこむ"], ans: b === 0 ? "まっすぐ" : b > 0 ? "外へふくらむ" : "内へへこむ",
        svg: svg(heringFig(b, false), "まん中から広がる線の上に、2本の縦の線"), rev: svg(heringFig(b, true), "広がる線を薄くし、まっすぐの補助線を重ねた図"),
        real: b === 0 ? "縦の線は、まっすぐ（まん中のふくらみ 0）" : `まん中で ${Math.abs(b)} だけ${b > 0 ? "外へふくらむ" : "内へへこむ"}`, m2: HER_M2[m], v: [b, m].join(","),
      };
    };
  }

  // ---- ポッゲンドルフ：斜めの線が帯の後ろを通る。右の A・B・C のどれにつながる？ ----
  function poggFig(y0, k, off, right, fade) {
    // 左の線は (60, y0) から傾き k（右へ10進むと上へ k）。帯は x=140〜190。点の x はどれも 60 から10の倍数なので、y は割り切れて丸めない（同じ直線の上に乗る）
    const yAt = (x) => y0 - ((x - 60) / 10) * k, y1 = yAt(190);
    let s = line(60, y0, 140, yAt(140), 3, INK, ` data-t="0"`);
    // A（上）・B・C（下）の3本。本当の続き（y1）を right の位置に置き、ほかは off ずつずらす
    const pos = [0, 1, 2].map((i) => y1 + (i - right) * off);
    pos.forEach((y, i) => { const x2 = 230 + 30 * i, y2 = y - ((x2 - 190) / 10) * k; s += line(190, y, x2, y2, 3, fade && i !== right ? "#999" : fade ? HI : INK, ` data-t="${i + 1}"`) + label(x2 + 14, y2, "ABC"[i]); });
    s += `<rect x="140" y="0" width="50" height="200" fill="#9aa7b4"${fade ? ` opacity=".35"` : ""}/>`;
    if (fade) s += dash(60, y0, 290, yAt(290));
    return s;
  }
  const POGG_M2 = [
    { t: "間の帯を消して、線を見せる", a: "down", why: "線のずれを生むのは、線をさえぎる帯です。帯が無ければ、1本の線かどうかがそのまま見えます。", src: ["pogg"] },
  ];
  function poggMake(offs) {
    return (R) => {
      const y0 = pct(R, [184, 188, 192]), k = pct(R, [4, 5, 6]), off = pct(R, offs), right = ri(R, 0, 2), m = 0;
      return {
        q: "左の線は、右のどれにつながる？", opts: ["A", "B", "C"], ans: "ABC"[right],
        svg: svg(poggFig(y0, k, off, right, false), "斜めの線が灰色の帯の後ろを通る。右に A・B・C の3本"), rev: svg(poggFig(y0, k, off, right, true), "帯を薄くし、左の線をまっすぐのばした補助線"),
        real: `左の線をまっすぐのばすと ${"ABC"[right]} に重なる`, m2: POGG_M2[m], v: [y0, k, off, right].join(","),
      };
    };
  }

  // ---- カフェウォール：白黒のタイルが1段ごとにずれる。横の線（目地）はみんな平行 ----
  function cafeFig(shift, mort, fade) {
    let s = "";
    for (let row = 0; row < 6; row++) {
      const y = 10 + row * 30, o = row % 2 ? shift : 0;
      for (let x = -40 + o; x < 320; x += 40) s += `<rect x="${x}" y="${y}" width="20" height="${30 - mort}" fill="${INK}"${fade ? ` opacity=".2"` : ""}/>`;
      s += `<rect x="0" y="${y + 30 - mort}" width="320" height="${mort}" fill="#8a8a8a" data-t="${row + 1}"/>`;
    }
    if (fade) for (let row = 0; row < 6; row++) s += dash(0, 40 - mort / 2 + row * 30, 320, 40 - mort / 2 + row * 30);
    return s;
  }
  const CAFE_M2 = [
    { t: "目地（タイルの間の灰色の線）を、もっと細くする", a: "up", why: "Gregory と Heard（1979）は、いちばん細い目地でいちばん強くゆがむと書いています。", src: ["cafe"] },
    { t: "目地を、ずっと太くする", a: "down", why: "Gregory と Heard（1979）：目地が太くなるほど、錯覚は小さくなります。", src: ["cafe"] },
    { t: "目地を、白いタイルより明るくする", a: "down", why: "Gregory と Heard（1979）：目地の明るさが黒と白のタイルの間にあるときだけ、ゆがみます。", src: ["cafe"] },
    { t: "白と黒のタイルを、どちらも1つの灰色にする", a: "down", why: "Gregory と Heard（1979）：タイルの明るさが同じだと、どんな目地でも錯覚は出ません。", src: ["cafe"] },
    { t: "図を上下さかさまにする", a: "same", why: SAMEWHY, src: ["cafex"] },
  ];
  function cafeMake() {
    return (R) => {
      const shift = pct(R, [10, 12, 14]), mort = pct(R, [2, 3]), m = ri(R, 0, CAFE_M2.length - 1);
      return {
        q: "横の灰色の線（目地）は？", opts: ["平行", "右へひらく", "右へせばまる"], ans: "平行",
        svg: svg(cafeFig(shift, mort, false), "白黒のタイルが1段ごとにずれた壁"), rev: svg(cafeFig(shift, mort, true), "タイルを薄くし、目地に平行な補助線を重ねた図"),
        real: "目地はみんな水平で、間は同じ 30", m2: CAFE_M2[m], v: [shift, mort, m].join(","),
      };
    };
  }

  // ---- チェッカーの影：明るいマスと暗いマス。円柱の影の中の明るいマス B と、影の外の暗いマス A ----
  // 色は1マスずつ決めて塗る（重ねて暗くしない）ので、A・B の明るさはこの数のとおり
  function adelFig(gA, gB, fade) {
    // A は影の外の暗いマス（1段目・2列目）、B は影の中の明るいマス（4段目・4列目）。影は B のまわり（円柱のある側）で、そのふちはうすい影
    const LT = 200, DK = 110, x0 = 30, y0 = 10, z = 36, A = [0, 1], B = [3, 3];
    const sh = (c, r) => { const d = Math.hypot(c - B[1], r - B[0]); return d <= 1.5 ? 0.55 : d <= 2.3 ? 0.75 : 1; };
    let s = "";
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const isA = r === A[0] && c === A[1], isB = r === B[0] && c === B[1], base = (r + c) % 2 ? DK : LT;
      const g = isA ? gA : isB ? gB : Math.round(base * sh(c, r));
      s += `<rect x="${x0 + c * z}" y="${y0 + r * z}" width="${z}" height="${z}" fill="${gray(g)}"${isA ? ` data-t="1" data-g="${gA}"` : isB ? ` data-t="2" data-g="${gB}"` : ""}${fade && !isA && !isB ? ` opacity=".15"` : ""}/>`;
    }
    // 円柱（影を作る物）
    s += `<g${fade ? ` opacity=".15"` : ""}><rect x="232" y="70" width="54" height="110" fill="#7c8a7c"/><ellipse cx="259" cy="180" rx="27" ry="9" fill="#6c786c"/><ellipse cx="259" cy="70" rx="27" ry="9" fill="#a3b0a3"/></g>`;
    // 答え合わせ：A と同じ灰色の帯を、A から B までつなぐ（つないだ所に境目が見えなければ同じ灰色）
    const cx = (c) => x0 + c * z + z / 2, cy = (r) => y0 + r * z + z / 2;
    if (fade) s += `<path d="M${cx(A[1])} ${cy(A[0])} H${cx(B[1])} V${cy(B[0]) - z / 2}" fill="none" stroke="${gray(gA)}" stroke-width="14"/>`;
    s += label(cx(A[1]), cy(A[0]), "A") + label(cx(B[1]), cy(B[0]), "B");
    return s;
  }
  const ADEL_M2 = [
    { t: "まわりのマスと影を紙でかくし、A と B だけを見る", a: "down", why: "目は、影の中の B を「影の中の明るいマス」と読み、明るく見せます。手がかりをかくすと、ただの灰色どうしをくらべることになります。", src: ["adelx"] },
  ];
  function adelMake(diffs) {
    return (R) => {
      const g = pct(R, [104, 110, 116]), d = pct(R, diffs), m = 0, gA = g, gB = Math.round(g * (1 + d / 100));
      return {
        q: "A と B、明るいのはどっち？", opts: ["A", "B", "同じ"], ans: cmp(gA, gB, "A", "B", "同じ"),
        svg: svg(adelFig(gA, gB, false), "白黒のチェッカー盤と円柱。円柱の影が右下にかかる。マス A とマス B"), rev: svg(adelFig(gA, gB, true), "まわりを薄くし、A と同じ灰色の帯を B までのばした図"),
        real: `明るさ（0〜255）A ${gA}・B ${gB}`, m2: ADEL_M2[m], v: [g, d].join(","),
      };
    };
  }

  // id：種類、lv：難しさ、ill：錯視の名前（帳の見出し）、src：出典、name：帳に出す名前、look：1回目のヒント、key：2回目のヒント、why：説明、make：問題を作る
  const K = (id, lv, src, name, look, key, why, make) => ({ id, lv, src, name, look, key, why, make });
  const KINDS = [
    K("ml0", 0, ["ml", "mlx", "sep"], "ミュラー・リヤー", "矢羽は見ないで、線の両はしだけを見よう。", "指で矢羽をかくして、くらべてみよう。", "矢羽の向きだけで、同じ線が長くも短くも見えます。長さを知っていても、そう見えます。Müller-Lyer が1889年に発表しました。", mlMake([0, 0, 20, -20])),
    K("ebb0", 0, ["ebb"], "エビングハウスの円", "まわりの円は見ないで、まん中の円だけを見よう。", "大きな円にかこまれると、小さく見えやすい。", "大きな円にかこまれた円は小さく、小さな円にかこまれた円は大きく見えます。Ebbinghaus が見つけ、Titchener が1901年の本で広めました。", ebbMake([0, 0, 20, -20])),
    K("br0", 0, ["olman"], "明るさの対比", "地の色は見ないで、四角だけを見よう。", "暗い地の上の灰色は、明るく見えやすい。", "同じ灰色でも、暗いものの隣では明るく、明るいものの隣では暗く見えます（明るさの対比）。", brMake([0, 0, 25, -25])),
    K("ml1", 1, ["ml", "mlx"], "ミュラー・リヤー（ふつう）", "矢羽は見ないで、線の両はしだけを見よう。", "外向きの矢羽（><）は線を長く見せやすい。", "外向きの矢羽は線を長く、内向きの矢羽は短く見せます。", mlMake([0, 0, 10, -10])),
    K("ponzo1", 1, ["ponzo"], "ポンゾ", "斜めの線は見ないで、横線だけを見よう。", "線が近づく所（上）にある横線は、長く見えやすい。", "近づく2本の線は、線路のように奥行きを感じさせます。奥にある横線は長く見えます。Ponzo が1910年に発表しました。", ponzoMake([0, 0, 12, -12])),
    K("her1", 1, ["hering"], "ヘリング", "広がる線は見ないで、縦の線のはしとまん中を見よう。", "まん中から広がる線の上では、まっすぐな線が外へふくらんで見えやすい。", "まん中から広がる線の上では、まっすぐな線が曲がって見えます。Hering が1861年に発表しました。", heringMake([0, 0, 6, -6])),
    K("pogg1", 1, ["pogg"], "ポッゲンドルフ", "帯は見ないで、線の向きだけをたどろう。", "定規を線に当てるつもりで、まっすぐのばそう。", "帯の後ろを通る斜めの線は、続きがずれて見えます。1860年に Poggendorff の雑誌に載りました。", poggMake([14, 16])),
    K("cafe1", 1, ["cafe", "cafex"], "カフェウォール", "タイルは見ないで、灰色の線のはしとはしを見よう。", "画面の左右のはしで、線と線の間をくらべよう。", "白黒のタイルが1段ごとにずれると、平行な目地がくさびのように傾いて見えます。Gregory が喫茶店の壁で気づき、Heard と1979年に調べました。", cafeMake()),
    K("adel2", 2, ["adelx"], "チェッカーの影", "まわりのマスと影は見ないで、A と B の灰色だけを見よう。", "影の中のマスは、目が「本当は明るい」と読みかえる。", "影の中の明るいマスと、影の外の暗いマスが、同じ灰色になることがあります。Adelson が1995年に作りました。", adelMake([0, 0, 0, 12, -12])),
    K("ml2", 2, ["ml", "mlx", "dewar"], "ミュラー・リヤー（むずかしい）", "矢羽は見ないで、線の両はしだけを見よう。", "見た感じと反対のこともある。はしをたてにそろえて見よう。", "錯覚は、本当の少しの差をかくすこともあります。矢羽の向きが、見た感じを本当と反対にすることもあります。", mlMake([0, 6, -6])),
    K("ebb2", 2, ["ebb"], "エビングハウスの円（むずかしい）", "まわりの円は見ないで、まん中の円だけを見よう。", "見た感じと反対のこともある。円のはばを指でくらべよう。", "まわりの円は、本当の少しの差をかくしたり、反対に見せたりします。", ebbMake([0, 8, -8])),
    K("br2", 2, ["olman"], "明るさの対比（むずかしい）", "地の色は見ないで、四角だけを見よう。", "見た感じと反対のこともある。", "地の明るさは、本当の少しの差をかくしたり、反対に見せたりします。", brMake([0, 10, -10])),
    K("ponzo2", 2, ["ponzo"], "ポンゾ（むずかしい）", "斜めの線は見ないで、横線だけを見よう。", "見た感じと反対のこともある。", "奥行きの手がかりは、本当の少しの差をかくしたり、反対に見せたりします。", ponzoMake([0, 6, -6])),
    K("her2", 2, ["hering"], "ヘリング（むずかしい）", "広がる線は見ないで、縦の線だけを見よう。", "少しへこんだ線は、まっすぐに見えることがある。", "広がる線は、本当に少し曲がった線を、まっすぐに見せることもあります。", heringMake([0, 3, -3])),
    K("pogg2", 2, ["pogg"], "ポッゲンドルフ（むずかしい）", "帯は見ないで、線の向きだけをたどろう。", "定規を線に当てるつもりで、まっすぐのばそう。", "ずれが小さいほど、目は帯の後ろの続きを読みちがえやすくなります。", poggMake([9, 10])),
  ];
  for (const k of KINDS) if (!SRC[k.src[0]] || !k.src.every((s) => SRC[s])) throw new Error("出典がない: " + k.id);
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv, date) => KINDS.filter((k) => k.lv === lv && (!date || !k.since || k.since <= date)).map((k) => k.id);

  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end

  // 1問を作る。tag は「種類|種」（例 "ml0|2026-11-28:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, src: [...new Set([...k.src, ...p.m2.src])].map((s) => SRC[s]),
      q: p.q, opts: p.opts, ans: p.ans, svg: p.svg, rev: p.rev, real: p.real, v: p.v, m2: p.m2.t, grp: p.m2.a, gwhy: p.m2.why };
  }
  // 同じ問題かを見分ける鍵（種類・図の値・2段目）
  const keyOf = (P) => `${P.kind}:${P.v}`;

  // 今日の5問（やさしい2・ふつう2・むずかしい1）。種類は重ねない
  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0, date), 2), n = pickN(R, kindsOf(1, date), 2), h = pickN(R, kindsOf(2, date), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  // 上級の3問（むずかしいだけ・今日の5問のむずかしいとは別の種類）
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2, date).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const NDM = { KINDS, BY, GROUPS, LV, SRC, kindsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = NDM; else root.NDM = NDM;
})(typeof self !== "undefined" ? self : this);
