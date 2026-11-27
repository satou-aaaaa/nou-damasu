// 脳がだます？の検査。問題の作り方（15種類×3000問：図の長さ・明るさ・ずれを SVG から測り直して答えが合う・選び肢3つ・2段目が表どおり・出典がある）・
// 今日の5問と上級の組み方（3年分）・とことんの並び（何百回作って1回の中で重ならない）・通しで遊ぶ・まちがい・ヒント・続きから・
// 上級・練習・とことん・錯視の帳・実績・カレンダー・あとから・文字の大きさ・言い方（図はゲームで描いた・点滅しない）・スマホ幅・PWA・引き継ぎ・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";
import { checkDepth } from "./depth-check.mjs";
import { checkCore } from "./core-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const firstClose = async (q) => { if (await q.locator("#howto[open]").count()) await q.click("#howto-ok"); if (await q.evaluate(() => !!(window.Core && Core.coach && Core.coach.active()))) { await q.evaluate(() => { Core.coach.leave(); scrollTo(0, 0); }); await q.waitForTimeout(100); } }; // はじめての練習の吹き出しをやめてホームへ（sync-template の migrateFirstQa が足した）
const G = createRequire(import.meta.url)(path.join(root, "data.js"));

const PIN = "ml0:150,20,1,4"; // 第1回の1問目（変わったら過去の日の問題が変わった印）
// ---- 1. 問題の作り方（ブラウザを使わない）----
// 答えは data.js の ans を信じず、描いた SVG の data-t の形（線の長さ・円の半径・灰色・曲がり・線の続き）から測り直す（ゲームとは別に書いた計算）
const num = (t, a) => +((t.match(new RegExp(`\\b${a}="(-?[\\d.]+)"`)) || [])[1]);
const parts = (svg) => { const o = {}; for (const m of svg.matchAll(/<(line|circle|rect|path)\b([^>]*?)data-t="(\d)"([^>]*)>/g)) o[m[3]] = m[1] + " " + m[2] + " " + m[4]; return o; };
function measure(P) {
  const t = parts(P.svg), len = (x) => Math.hypot(num(x, "x2") - num(x, "x1"), num(x, "y2") - num(x, "y1")), pick = (a, b, A, B) => (Math.abs(a - b) < 1e-9 ? "同じ" : a > b ? A : B);
  const id = P.kind.replace(/\d$/, "");
  if (id === "ml" || id === "ponzo") return pick(len(t[1]), len(t[2]), "上", "下");
  if (id === "ebb") return pick(num(t[1], "r"), num(t[2], "r"), "左", "右");
  if (id === "br" || id === "adel") { const g = (x) => parseInt((x.match(/fill="#([0-9a-f]{2})\1\1"/) || [])[1], 16); return pick(g(t[1]), g(t[2]), "A", "B"); }
  if (id === "her") { const b = (x) => { const m = x.match(/d="M(\d+) 12 Q(-?[\d.]+) 100 \1 188"/); return m ? (+m[2] - +m[1]) / 2 : NaN; }, l = -b(t[1]), r = b(t[2]); if (l !== r) return "左右でちがう"; return l === 0 ? "まっすぐ" : l > 0 ? "外へふくらむ" : "内へへこむ"; }
  if (id === "pogg") { const x1 = num(t[0], "x1"), y1 = num(t[0], "y1"), x2 = num(t[0], "x2"), y2 = num(t[0], "y2"), k = (y2 - y1) / (x2 - x1); const hit = [1, 2, 3].filter((i) => { const sx = num(t[i], "x1"), sy = num(t[i], "y1"), k2 = (num(t[i], "y2") - sy) / (num(t[i], "x2") - sx); return Math.abs(y1 + k * (sx - x1) - sy) < 1e-9 && Math.abs(k2 - k) < 1e-9; }); return hit.length === 1 ? "ABC"[hit[0] - 1] : "続きが1本でない"; } // 続きは丸めずに同じ直線の上（ずれを許さない。PR #1 の CodeRabbit）
  if (id === "cafe") { const ys = [1, 2, 3, 4, 5, 6].map((i) => num(t[i], "y")), hs = [1, 2, 3, 4, 5, 6].map((i) => num(t[i], "height")); return ys.every((y, i) => !i || y - ys[i - 1] === 30) && new Set(hs).size === 1 && /width="320"/.test(t[1]) ? "平行" : "平行でない"; }
  return "種類が分からない";
}
// 2段目の答えの表（出典で確かめたものだけ。data.js とは別に書く）。変える → 答え
const M2 = {
  // SRC.dewar（Dewar 1967：角度が小さいほど大きい・くり返しで小さくなる）
  "矢羽どうしの角度を、もっとせまくする（30°）": "up", "矢羽どうしの角度を、広くする（120°）": "down", "この図で、長さを合わせる練習を何度もくり返す": "down",
  // SRC.cafe（Gregory & Heard 1979：細い目地ほど強い・太いと弱い・目地が明暗の間にあるときだけ・タイルが同じ明るさなら出ない）
  "目地（タイルの間の灰色の線）を、もっと細くする": "up", "目地を、ずっと太くする": "down", "目地を、白いタイルより明るくする": "down", "白と黒のタイルを、どちらも1つの灰色にする": "down",
  // 錯覚を起こす「まわり」を消す（各錯視の定義）：SRC.mlx・SRC.ebb・SRC.olman・SRC.ponzo・SRC.hering・SRC.pogg・SRC.adelx の順
  "矢羽を消して、線だけにする": "down", "まわりの円を全部消す": "down", "左右の地を、1つの色にそろえる": "down", "斜めの2本の線を消す": "down", "まん中から広がる線を消す": "down", "間の帯を消して、線を見せる": "down", "まわりのマスと影を紙でかくし、A と B だけを見る": "down",
  // 図がもとと同じ形のまま（上下・左右の入れかえ・鏡うつし・さかさま）：SRC.mlx・SRC.ebb・SRC.olman・SRC.ponzo・SRC.hering・SRC.cafex
  "上の図と下の図を入れかえる": "same", "左と右の図を入れかえる": "same", "図を左右反対（鏡うつし）にする": "same", "図を上下さかさまにする": "same",
  // 「定規で測って本当の長さを知ってから見る」は入れない：SEP §3.3.2 は「知っていても錯覚が残る」までで、強さが同じとは言っていない（PR #1 の CodeRabbit）
};
const OPTS = { ml: "上,下,同じ", ponzo: "上,下,同じ", ebb: "左,右,同じ", br: "A,B,同じ", adel: "A,B,同じ", her: "まっすぐ,外へふくらむ,内へへこむ", pogg: "A,B,C", cafe: "平行,右へひらく,右へせばまる" };
const URLRE = /^https:\/\/(vlp-new\.ur\.de\/records\/lit5535|www\.illusionsindex\.org\/i\/(mueller-lyer|ebbinghaus-illusion|ponzo-illusion|hering-illusion|poggendorff-illusion|cafe-wall-illusion)|illusionsindex\.org\/ir\/20-checkershadow|www\.appstate\.edu\/~steelekm\/classes\/psy4215\/Documents\/Dewar1967-muller-lyer\.pdf|plato\.stanford\.edu\/entries\/perception-problem\/|richardgregory\.org\/papers\/cafe_wall\/cafe-wall_all\.htm|open\.lib\.umn\.edu\/sensationandperception\/chapter\/simultaneous-contrast\/)$/;
{
  const bad = {}, seen = {}, N = 3000, ansSeen = {};
  for (const k of G.KINDS) {
    seen[k.id] = new Set(); ansSeen[k.id] = new Set();
    for (let s = 0; s < N; s++) {
      const P = G.make(`${k.id}|qa${s}`), why = [], id = k.id.replace(/\d$/, "");
      if (P.opts.join() !== OPTS[id] || !P.opts.includes(P.ans)) why.push("選び肢が3つ（いつもの順）でない・答えを含まない");
      if ([P.q, P.real, P.m2, P.gwhy, ...P.opts].some((x) => typeof x !== "string" || !x || /undefined|NaN|null|\$\{/.test(x)) || /undefined|NaN/.test(P.svg + P.rev)) why.push("中身が空・NaN");
      const m = measure(P);
      if (m !== P.ans) why.push(`測り直した答え（${m}）とちがう`);
      if (M2[P.m2] !== P.grp) why.push("2段目が表とちがう：" + P.m2);
      if (/同じ|長い|短い|明るい|暗い|まっすぐ|平行|大きい|小さい/.test(P.m2)) why.push("2段目の文に1段目の答えの言葉が出ている");
      if (!P.src.length || P.src.some((x) => !Array.isArray(x) || !URLRE.test(x[1]))) why.push("出典が無い・知らない URL");
      if ((P.svg.match(/<animate|<set |@keyframes|animation/g) || []).length) why.push("図が動く");
      if (JSON.stringify(G.make(`${k.id}|qa${s}`)) !== JSON.stringify(P)) why.push("同じ種で同じ問題にならない");
      seen[k.id].add(G.keyOf(P)); ansSeen[k.id].add(P.ans);
      if (why.length && !bad[k.id]) bad[k.id] = why.join("・") + "：" + P.v;
    }
  }
  check(`問題：${G.KINDS.length}種類×${N}問で、図から測り直した答えと合う・選び肢3つ・2段目が表どおり・2段目の文に1段目の答えの言葉が無い・出典がある・図が動かない`, Object.keys(bad).length === 0, JSON.stringify(bad));
  const total = Object.values(seen).reduce((a, s) => a + s.size, 0), few = G.KINDS.filter((k) => seen[k.id].size < 6).map((k) => `${k.id}:${seen[k.id].size}`);
  check("問題の数：全部で300通り以上・どの種類も6通り以上（好きなだけ遊んでも同じ問題が続かない。game-dev.md F6）", total >= 300 && few.length === 0, `${total}通り ${few.join(",")}`);
  check("問題：種類は15（やさしい3・ふつう5・むずかしい7）", G.KINDS.length === 15 && [0, 1, 2].map((l) => G.kindsOf(l).length).join() === "3,5,7");
  const one = G.KINDS.filter((k) => k.id !== "cafe1" && ansSeen[k.id].size < 3).map((k) => k.id);
  check("答えは1つにかたよらない：カフェウォール（いつも平行）のほかは、どの種類も3つの答えが全部出る", one.length === 0, one.join());
  const m2used = new Set(G.KINDS.flatMap((k) => [...Array(300)].map((_, i) => G.make(`${k.id}|m${i}`).grp)));
  check("2段目の答えは3つ（強くなる・弱くなる・変わらない）とも出る", Object.keys(G.GROUPS).join() === "up,down,same" && m2used.size === 3);
  const longWhy = [], longLook = [];
  for (const k of G.KINDS) { if ([...k.why].length > 100) longWhy.push(k.id); if ([...k.look].length > 45 || [...k.key].length > 60) longLook.push(k.id); }
  const longM2 = Object.keys(M2).filter((t) => [...t].length > 40);
  check("説明は100字以内・ヒントは45字・60字以内・2段目の文は40字以内（やさしい日本語。一文を短く）", !longWhy.length && !longLook.length && !longM2.length, longWhy.concat(longLook, longM2).join(","));
  check("出典はどれも確かめた URL（論文・The Illusions Index・SEP・MIT・ミネソタ大学）で、どれも使う", Object.values(G.SRC).every(([, u]) => URLRE.test(u)) && Object.keys(G.SRC).every((x) => G.KINDS.some((k) => G.make(`${k.id}|s1`).src.some((s) => s[1] === G.SRC[x][1])) || [...Array(200)].some((_, i) => G.KINDS.some((k) => G.make(`${k.id}|u${i}`).src.some((s) => s[1] === G.SRC[x][1])))));
  check("名前と年は確かめたもの（Müller-Lyer 1889・Titchener 1901・Ponzo 1910・Hering 1861・1860・Gregory と Heard 1979・Adelson 1995）", /1889/.test(G.BY.ml0.why) && /1901/.test(G.BY.ebb0.why) && /1910/.test(G.BY.ponzo1.why) && /1861/.test(G.BY.her1.why) && /1860/.test(G.BY.pogg1.why) && /1979/.test(G.BY.cafe1.why) && /1995/.test(G.BY.adel2.why));
}
{
  // 今日の5問・上級の組み方（3年分）
  const bad = [], cover = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-27");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const dk = dl.map((t) => t.split("|")[0]), hk = hl.map((t) => t.split("|")[0]);
    if (dl.length !== 5 || new Set(dk).size !== 5 || dk.map((k) => G.BY[k].lv).join() !== "0,0,1,1,2") bad.push(d + " 今日");
    if (hl.length !== 3 || new Set(hk).size !== 3 || hk.some((k) => G.BY[k].lv !== 2) || hk.includes(dk[4])) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    if (dk.join() === prev) sameAsPrev++; prev = dk.join();
    if (i < 60) [...dk, ...hk].forEach((k) => cover.add(k));
  }
  check("今日の5問（やさしい2・ふつう2・むずかしい1、種類は重ねない）と上級（むずかしい3・今日のむずかしいと別）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  check(`2か月のうちに${G.KINDS.length}種類が全部出る・前の日と同じ組の日が少ない`, cover.size === G.KINDS.length && sameAsPrev < 20, `${cover.size}種類・前の日と同じ ${sameAsPrev}日`);
  // 過去の日の問題が変わらない（data.js を直したときの見張り。値は 2026-11-27 に作ったもの）
  const P0 = G.make(G.dailyTags("2026-11-27")[0]);
  check("第1回（2026-11-27）の1問目が作ったときのまま（並べ替え・削除で過去の日の問題を変えない）", `${P0.kind}:${P0.v}` === PIN, `${P0.kind}:${P0.v}`);
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
// ひな形の写し（<!-- 名前:begin〜end -->）はゲームの言葉ではないので外し、Core.kofi・Core.KOFI は写す前の形にもどして見る（shared-workflows の sync-template が足した）
const gameOwn = (t) => t.replace(/<!-- ([a-z0-9-]+):begin[\s\S]*?<!-- \1:end -->/g, "").split("${Core.KOFI}").join("https://ko-fi.com/satouaaaaa").replace(/Core\.kofi\(("(?:[^"\\]|\\.)*"), ("(?:[^"\\]|\\.)*")\)/g, (m, a, b) => "`<p class=\"note kofi\">" + JSON.parse(a) + "、<a href=\"https://ko-fi.com/satouaaaaa\" target=\"_blank\" rel=\"noopener\">Ko-fi でコーヒー1杯の応援</a>をもらえると、" + JSON.parse(b) + "の励みになります（任意・遊ぶのはずっと無料）。</p>`");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている（connect-src は 'self' だけ。CodeRabbit menkyo-nenrei#1）", (html.match(/connect-src[^;"]*/g) || []).map((s) => s.trim()).join("|") === "connect-src 'self'");
check("Math.random は練習・とことんの種だけ（今日の5問・上級は日付の乱数。data.js には無い）", (html.match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
{ const inl = html.split("<script>").slice(1).map((x) => x.split("</" + "script>")[0]).join("\n"); // index.html の中の script も見る（nemuri-kotsu#1 で行の途中に // を入れて画面が動かなくなった）
  check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04・nemuri-kotsu#1）", !/;\s*\/\/[^\n]*;\s*\w/.test((gen + "\n" + inl).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"))); }
check("言い方：「必ず」「絶対」と言い切らない・画像を入れない（図はゲームの中で SVG で描く）", !/絶対に|必ず(当て|わか|見分|だま)/.test(gameOwn(html) + gen + readme) && !/<img/.test(gameOwn(html)) && !/\.(png|jpe?g|gif|webp|svg)["']/i.test(gen));
{ const howto = (html.match(/<dialog id="howto"[\s\S]*?<\/dialog>/) || [""])[0], ab = (html.match(/function about\(\)[\s\S]*?\n}/) || [""])[0], dis = (t) => /(ゲームの中で|このゲームで)描/.test(t) && /(点滅|ちらつ)/.test(t);
  check("言い方：遊び方・「このゲームについて」・README のどれにも、図はゲームで描いたこと・点滅や速い動きが無いことがある", dis(howto) && dis(ab) && dis(readme), `遊び方 ${dis(howto)}・について ${dis(ab)}・README ${dis(readme)}`); }
check("光の点滅・速い動きを使わない：図に animate・keyframes が無く、ゲームの keyframes は shake・stamp・up だけ（「動きを減らす」で止まる）", !/<animate|<set\b/.test(html + gen) && [...gameOwn(html).matchAll(/@keyframes (\w+)/g)].map((m) => m[1]).join() === "shake,stamp,up" && /prefers-reduced-motion:reduce\)\{\*\{animation:none!important/.test(html));
check("図は暗い画面でも色を変えない（明るさを問うので data-a11y-keepcolor）", (html.match(/class="fig[^"]*"[^>]*data-a11y-keepcolor/g) || []).length === 2);
check("写し元（感想フォームも見る・たまたま当たった？・その元のどこの裁判所？ほか）の言葉が残っていない（共通部品 store の中は除く・game-dev.md A 手順5）", !/たまたま|当たった|ゲティア|Gettier|ラッセル|Russell|止まった時計|羊|かげろう|ダルモッタラ|札|理由の|知っていた|外れていた|話の帳|tamatama|tmt|TMT|knowledge-analysis|3326922|裁判所|saibansho|ssd|SSD|控訴|三審制|管轄|e-Gov|e-gov|courts|条文|訴え/.test(gameOwn(html).replace(/<!-- (store|core|a11y|kiroku):begin[\s\S]*?<!-- \1:end -->/g, "") + gen + readme + readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8") + readFileSync(path.join(root, "manifest.webmanifest"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + gen));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキー（記録・文字・復習）だけで読む・depth.js も前に読む", /<script src="transfer\.js" data-game="nou-damasu" data-keys="ndm-v1,ndm-fs,ndm-depth"><\/script>\s*<script src="depth\.js" data-game="nou-damasu" data-key="ndm-depth"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
check("好きなだけ遊べる：チケット・回数の上限・🔒で開くモードを入れない（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒/.test(gameOwn(html)) && !/\blife\b|ELIFE/.test(gameOwn(html)));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/nou-damasu/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const mk = readFileSync(path.join(root, "tools/make-og.cjs"), "utf8");
  check("SNS の絵に今日の問題と答えを出さない：問題の文・正解の印を make-og に書かない（CodeRabbit mansion-kimari#1）", !/line\([^)]*,\s*1\)/.test(mk) && G.KINDS.every((k) => !mk.includes(k.name) && [...Array(30)].every((_, j) => !mk.includes(G.make(`${k.id}|o${j}`).q))));
}
{ const mk = readFileSync(path.join(root, "tools/make-og.cjs"), "utf8"), og = [...mk.matchAll(/line\("([^"]+)"\)/g)].map((m) => m[1]);
  check("共有画像（tools/make-og.cjs）の選び肢は、このゲームのミュラー・リヤーの答え（上・下・同じ。写し元の場面が残らない）", og.join() === "上,下,同じ" && /ml0/.test(mk), og.join()); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js・深さの depth.js も）、取り直して保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./transfer-qr.js", "./depth.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  { const st = await checkSwStall(sw); check("PWA：通信が止まっても4秒ほどで保存した画面に切り替わり、少しずつ届く受信は待ち、何も無ければ60秒で返す（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "脳がだます？" && /錯視|錯覚/.test(mf.description) && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
// ブラウザの時計を TODAY の正午（日本時間）に合わせる（検査の途中で0時をまたいでも、画面の「今日」と期待値がずれない。PR #1 の CodeRabbit）
// 足すだけの形なので、あとから時計を進める addInitScript（カレンダーの検査）とも重ねられる
const CLOCK = Date.parse(TODAY + "T03:00:00Z") - Date.now(), newCtx0 = browser.newContext.bind(browser);
browser.newContext = async (...a) => { const c = await newCtx0(...a); await c.addInitScript((d) => { const o = Date.now; Date.now = () => o() + d; }, CLOCK); return c; };
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { await firstClose(p); };
const ansIdx = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.opts.indexOf(c.P.ans); });
const wrongIdx = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.opts.findIndex((o) => o !== c.P.ans && !c.wrong.includes(o)); });
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("ndm-v1") || "{}"));
// 2段目「こう変えたら、錯覚は？」が出たら、正しい答えを押す
const why = async (p) => { await p.waitForSelector(".verdict, .why button"); if (await p.locator(".verdict").count()) return; await p.click(`.why button[data-g="${await p.evaluate(() => __nm.cur().P.grp)}"]`); };
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  await why(p);
  await p.waitForSelector(".verdict");
}

try {
  // はじめて：遊び方が出る・文字の大きさ
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#core-coach").waitFor({ timeout: 3000 }).then(() => true, () => false));
  { const c = await browser.newContext(); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(200); let again = 0;
    for (let i = 0; i < 10; i++) { await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.reload(); await r.waitForTimeout(200); again += await r.locator("#howto[open]").count() + await r.locator("#core-coach").count(); }
    check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0);
  { const c = await browser.newContext(); const r = await c.newPage(); const big = []; // 題が h1{flex:1} で縦に伸び（伸びない形と比べて4pxより高ければ失敗）、iPad の縦で大きなすき間が出た（shared-workflows incidents/2026-11-07-title-stretched.md）
    for (const [w, h] of [[820, 1180], [390, 844], [1280, 800]]) { await r.setViewportSize({ width: w, height: h }); await r.goto(url); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.waitForTimeout(100);
      const v = await r.evaluate(() => { const e = [...document.querySelectorAll(".title")].find((x) => x.offsetParent); if (!e) return null; const h = e.getBoundingClientRect().height; const f = e.style.flex; e.style.flex = "none"; const n = e.getBoundingClientRect().height; e.style.flex = f; return h - n; });
      if (v === null || v > 4) big.push(`${w}x${h}:${v === null ? "題なし" : "+" + Math.round(v) + "px"}`); }
    check("ホームの題は縦長の画面でも縦に伸びない（820×1180・390×844・1280×800）", big.length === 0, big.join(" ")); await c.close(); }
    await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200);
    check("はじめての練習が始まったその場で「見た」が残る", await r.evaluate(() => { return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); })); await firstClose(r);
    await r.reload(); await r.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない（その場で残す）", await r.locator("#howto[open]").count() === 0); await c.close(); }
  { // はじめての練習の案内のまま ← でホームへ戻っても、案内は終わり、今日の5問に吹き出しが付かない（PR #1 の CodeRabbit）
    const c = await browser.newContext({ viewport: { width: 390, height: 800 } }); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(300);
    const on0 = await r.evaluate(() => Core.coach.active());
    await r.evaluate(() => document.getElementById("back").click()); await r.waitForTimeout(200);
    const on1 = await r.evaluate(() => Core.coach.active()), home1 = await r.locator("#go-d").count();
    await r.click("#go-d"); await r.waitForTimeout(300);
    check("はじめての練習の案内のまま ← でホームへ戻ると案内が終わり、今日の5問に吹き出しが出ない", on0 && !on1 && home1 === 1 && await r.locator("#core-coach").count() === 0 && !(await r.evaluate(() => Core.coach.active())), `${on0}/${on1}/${home1}`);
    await c.close(); }
  await firstClose(p);
  check("文字の大きさ：はじめは「大きい」（19px）", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "19px");
  await p.click('.fsrow button[data-fs="3"]');
  check("文字の大きさを押しても、押したボタンにフォーカスが残る（描き直さない。PR #1 の CodeRabbit）", await p.evaluate(() => document.activeElement && document.activeElement.dataset.fs === "3" && document.activeElement.getAttribute("aria-pressed") === "true"));
  await p.reload(); await p.waitForTimeout(150);
  check("文字の大きさ：「とても大きい」にすると開き直しても残る", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "23px" && await p.locator('.fsrow button[data-fs="3"][aria-pressed="true"]').count() === 1);
  await p.click('.fsrow button[data-fs="2"]');
  check("ホームに今日のきほんが出る", (await p.textContent("#tip")).includes("今日のきほん"));

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __nm.load().runs.d.list);
  check("今日の5問は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：場面の問いと、押せる行3つか4つ（高さ56px以上）", await p.locator("#card").count() === 1 && (await p.$$eval(".ch", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 56) && await p.locator(".ch").count() === await p.evaluate(() => __nm.cur().P.opts.length) && await p.locator(".ch").count() >= 3 && (await p.textContent("#card .sit")).length > 5);
  check("押せる行には読み上げ用の名前がある", (await p.$$eval(".ch", (t) => t.filter((x) => !x.getAttribute("aria-label")).length)) === 0);
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と「ちがう」の文字（色だけで分けない）・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("ちがう") && /✕/.test(await p.textContent("#msg")) && await p.getAttribute("#msg", "role") === "status");
  // 開き直しても、まちがえた選び肢は残る
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた印のまま）", await p.locator(".ch.ng").count() === 1 && await p.evaluate(() => __nm.cur().i) === 0);
  await solve(p);
  check("正解すると「正解」の判・なぜの説明・出典のリンク・★2（まちがい1回）", await p.locator(".ch.ok").count() === 1 && /正解/.test(await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ok"), "::after").content)) && (await p.textContent(".verdict .why")).length > 20 && await p.locator(".verdict .src a").count() >= 1 && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ");
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は見るところを言う（答えは言わない）", (await p.textContent("#hintbox")).includes("💡") && await p.locator(".ch.ng").count() === 0);
  await p.click("#hint");
  check("ヒント2はまちがいを消して2つにしぼり、表の言葉も見せる・ヒントは2回まで", await p.locator(".ch:not(.ng)").count() === 2 && (await p.textContent("#hintbox")).includes(await p.evaluate(() => __nm.cur().P.key)) && await p.locator("#hint:disabled").count() === 1);
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  check("次の問題へ進むと、フォーカスが問題（#card）に移る", await p.evaluate(() => document.activeElement && document.activeElement.id) === "card");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]");
  const share = await p.textContent(".share");
  check("シェアの文に答え・問題を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !G.KINDS.some((k) => share.includes(k.name)) && !/上|下|同じ|明るい|長い/.test(share.replace(/^脳がだます？/, "")), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  check("錯視の帳に解いた種類が載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」と上級", (await p.textContent("#go-d")).includes("結果") && await p.locator("#go-h").count() === 1);
  // 上級：ヒントなし・3問
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3問", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __nm.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-t="2"]');
  const before = await mem(p);
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（錯視の帳の数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 5);
  // 錯視の帳からその種類だけで練習
  await p.click("#back"); await p.click("#go-dex");
  const firstKind = await p.getAttribute(".book button", "data-k");
  await p.click(".book button");
  check("錯視の帳の種類を押すと、その種類だけで練習", (await p.evaluate(() => __nm.load().runs.p.list)).every((t) => t.startsWith(firstKind + "|")));
  // とことん：まちがえてもヒントを使っても続き、「ここで降りる」で終わる（game-dev.md F1）
  await p.click("#back"); await p.click("#go-e");
  check("とことんは60問の並びから・ライフ（🌸・🎫）が無い", (await p.evaluate(() => __nm.load().runs.e.list.length)) === 60 && !("life" in await p.evaluate(() => __nm.load().runs.e)) && await p.locator("#quit").count() === 1);
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 1 }); await p.click("#next");
  await p.click("#hint"); await p.click("#hint"); await solve(p); await p.click("#next");
  check("とことんはまちがい・ヒント2回でも終わらない", await p.locator(".ch").count() >= 3 && await p.evaluate(() => __nm.load().runs.e.res.length) === 4);
  await p.click("#hint"); await p.click("#hint");
  await p.evaluate(() => { const c = __nm.cur(); [...document.querySelectorAll(".ch:not(.ng)")].find((b) => c.P.opts[+b.dataset.j] !== c.P.ans).click(); });
  await p.waitForTimeout(50);
  check("ヒント2のあとにまちがいを選ぶと、正解だけが押せる（saibanin-shikumi #1）", await p.locator(".ch.ng").count() === await p.evaluate(() => __nm.cur().P.opts.length) - 1 && await p.locator(".ch:not(.ng)").count() === 1 && await p.evaluate(() => { const c = __nm.cur(); const b = document.querySelector(".ch:not(.ng)"); return !!b && !b.disabled && c.P.opts[+b.dataset.j] === c.P.ans; }));
  await p.reload(); await p.waitForTimeout(200);
  check("とことんは閉じても続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e");
  {
    // 別のタブでこの回を終えて新しい回を始めていたら、古い画面の「ここで降りる」は新しい回を終えない（funka-level #1 の CodeRabbit）
    const keep0 = await p.evaluate(() => __nm.load().runs.e);
    await p.evaluate(() => __nm.save((s) => { s.runs.e = Object.assign({}, s.runs.e, { id: "other-tab-run", res: [] }); }));
    await p.click("#quit"); await p.waitForTimeout(150);
    check("古い画面の「ここで降りる」は、別のタブで始めた新しい回を終えない", (await p.evaluate(() => __nm.load().runs.e && __nm.load().runs.e.id)) === "other-tab-run");
    await p.evaluate((r) => __nm.save((s) => { s.runs.e = r; }), keep0);
    await p.evaluate(() => __nm.play("e"));
  }
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、一度で正解した数（2問）が自己ベストに残る", (await mem(p)).ebest === 2 && (await p.textContent("#eres")).includes("4問") && !("e" in (await mem(p)).runs && (await mem(p)).runs.e));
  {
    // とことんの並びを何百回作って、1回の中で同じ問題が無い・続けて同じ種類が無い・足しても重ならない
    const r = await p.evaluate(() => { const K = __nm.G, bad = []; for (let n = 0; n < 300; n++) { const l = __nm.endlessList(), more = l.concat(__nm.moreList(l)); const ks = more.map((t) => K.keyOf(K.make(t))); if (new Set(ks).size !== ks.length) bad.push("重なり"); if (more.some((t, i) => i && t.split("|")[0] === more[i - 1].split("|")[0])) bad.push("同じ種類が続く"); if (l.length !== 60 || more.length !== 100) bad.push("数" + l.length + "/" + more.length); } return bad; });
    check("とことんの並び300回：60問＋足した40問で同じ問題も同じ種類の連続も無い（game-dev.md F6）", r.length === 0, r.slice(0, 3).join(","));
  }
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない（2026-11-05 CodeRabbit）
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("ndm-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.dex = { e: '"><b id="xss2">' }; s.runs = { e: { mode: "e", id: '"><i id="xss3">', date: "2026-11-07", list: ["ml0|1"], res: [] }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-07", list: ["constructor|1"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["ml0|1"], res: [] }, "a:2026-11-06": { mode: "a", id: "a1", date: "2026-11-06", list: ["ml0|1"], res: [null] }, "a:2026-11-05": { mode: "a", id: "a2", date: "2026-11-05", list: "bad", res: [] }, "a:2026-11-04": { mode: "a", id: "a3", date: "2026-11-04", list: ["ml0|1", "ml0|2"], res: [{ m: 0 }], cur: { i: 1, tag: "ml0|2", wrong: "x", hints: 0 } } }; s.days = { "2026-11-07": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("ndm-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __nm.load());
      check("結果に null が混ざった終えた回は、記録しないで止まらない（PR #1 の CodeRabbit）", await q.evaluate(() => { const s = __nm.load(); try { return __nm.bank(s, { mode: "d", date: "2026-11-20", list: ["ml0|1"], res: [null] }) === false && !s.days["2026-11-20"]; } catch (e) { return String(e); } }) === true);
  check("記録の形を直す：数の所の文字は0に・形のちがう途中経過と日ごとの記録は捨てる", st.ebest === 0 && st.dex.e === 0 && st.runs.e && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("a:2026-11-06" in st.runs) && !("a:2026-11-05" in st.runs) && st.runs["a:2026-11-04"] && st.runs["a:2026-11-04"].cur === null && Object.keys(st.days).length === 0);
    await q.click("#go-e").catch(() => {}); await q.waitForTimeout(150);
    {
      // 知らない mode や、置き場とちがう mode の途中経過は捨てる（ホームが出なくなるのを防ぐ。2026-11-07 CodeRabbit）
      const z = await newPage(); await closeHow(z);
      await z.evaluate(() => { const s = JSON.parse(localStorage.getItem("ndm-v1")) || { v: 1 }; s.v = 1; s.runs = { d: { mode: "x", date: "2026-11-07", list: [], res: [] }, h: { mode: "d", date: "2026-11-07", list: [], res: [] } }; localStorage.setItem("ndm-v1", JSON.stringify(s)); });
      await z.reload(); await z.waitForTimeout(200);
      const r = await z.evaluate(() => __nm.load().runs);
      check("知らない mode の途中経過は捨て、ホームが出る", !("d" in r) && !("h" in r) && await z.locator("#go-d").count() === 1);
      // 別のタブで終えたまま記録していない上級の回は、次の回を始める前に記録する
      await z.evaluate(() => { const s = __nm.load(), y = "2026-11-06", G = __nm.G; s.runs.h = { mode: "h", date: y, list: G.hardTags(y), res: [{ m: 0 }, { m: 0 }, { m: 0 }], cur: null, id: "old" }; localStorage.setItem("ndm-v1", JSON.stringify(s)); });
      await z.reload(); await z.waitForTimeout(200); await z.evaluate(() => __nm.start("h"));
      check("終えたまま残った前の日の回は、上書きする前に記録する", !!(await mem(z)).hdays["2026-11-06"]);
      // とことんで足せる問題が無くても、くり返し呼んで固まらない
      const ok = await z.evaluate(() => { const s = __nm.load(); s.runs.e = { mode: "e", date: __nm.todayKey(), list: ["ml0|1", "ebb0|1"], res: [{ m: 0 }, { m: 0 }], cur: null, id: "e1" }; localStorage.setItem("ndm-v1", JSON.stringify(s)); const ml = __nm.setMore(() => []); try { __nm.play("e"); return true; } catch (e) { return String(e); } finally { __nm.setMore(ml); } });
      check("とことんで足せる問題が無くても固まらずに終える", ok === true && await z.locator("#eres").count() === 1, String(ok));
      await z.context().close();
    }
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は13個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 13 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 3);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：図はゲームで描いたこと・数は人や図でちがうので出していないこと・出典のリンク", (await p.textContent("#about")).includes("このゲームの中で描いた") && (await p.textContent("#about")).includes("出していません") && await p.locator("#about a").count() >= 8);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：過去の日の記録を置いて見る。第1回から日がたっていなくても見られるよう、時計を10日進める
  {
    const SHIFT = 10 * 864e5, TODAY = new Date(Date.now() + 9 * 3600e3 + SHIFT).toISOString().slice(0, 10), dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
    const cx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await cx.addInitScript((sh) => { const o = Date.now; Date.now = () => o() + sh; }, SHIFT);
    const q = await newPage(390, cx);
    await q.evaluate(([d2, d3]) => { localStorage.setItem("ndm-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0], k: [] }, [d3]: { m: [1, 0, 0, 2, 0], k: [] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __nm.lateDays(__nm.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-07");
    check("カレンダー：取りこぼした過去7日（第1回より後）を押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    check("カレンダー：遊んだ日は★の数の文字も付く", (await q.locator(".cal .c.p3").count()) + (await q.locator(".cal .c.p2").count()) + (await q.locator(".cal .c.p1").count()) >= (dayBefore(3).slice(0, 7) === TODAY.slice(0, 7) ? 2 : 0));
    if (lateList.length) {
      const d = lateList[0];
      await q.evaluate((d) => { const b = document.querySelector(`.cal .miss[data-k="${d}"]`); if (b) b.click(); else { const m = document.querySelector(".calnav #prev"); m && m.click(); } }, d);
      if (!(await q.locator(".ch").count())) await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __nm.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・続けた日には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：遊べる日がある", false, "第1回の日から日がたっていない");
    await q.context().close();
  }

  // 終えた回（gone）がある側の保存に失敗し、別のタブが古い回を新しく保存しても、終えた回を戻さない（menkyo-nenrei PR #1 の CodeRabbit）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const g = await newPage(390, ctx);
    const left = await g.evaluate(() => {
      const r = { mode: "e", date: __nm.todayKey(), list: ["ml0|1", "ebb0|1"], res: [{ m: 0 }], cur: null, id: "gone1" };
      const base = __nm.load();
      const a = JSON.parse(JSON.stringify(base)); a.runs.e = null; a.gone = { gone1: 1 }; a.t = 100;
      const b = JSON.parse(JSON.stringify(base)); b.runs.e = r; b.t = 200;
      localStorage.setItem("ndm-v1", JSON.stringify(b)); __nm.setMem(JSON.stringify(a));
      try { return __nm.load().runs.e; } finally { __nm.setMem(null); }
    });
    check("終えた回は、別のタブが新しく保存した古い写しから戻さない", !left, JSON.stringify(left));
    await ctx.close();
  }
  // 同じ問題の途中で、保存に失敗した側と保存できた側のまちがいを合わせる（CodeRabbit menkyo-nenrei#1）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const g = await newPage(390, ctx);
    const got = await g.evaluate(() => {
      const base = __nm.load(), mk = (w, w2) => ({ mode: "p", date: __nm.todayKey(), list: ["ml0|m1", "ebb0|m1"], res: [], cur: { i: 0, tag: "ml0|m1", wrong: w, hints: 0, step: 2, w2 }, id: "mg1" });
      const a = JSON.parse(JSON.stringify(base)); a.runs.p = mk(["上"], ["up"]); a.t = 100;
      const b = JSON.parse(JSON.stringify(base)); b.runs.p = mk(["下"], ["down"]); b.t = 200;
      localStorage.setItem("ndm-v1", JSON.stringify(b)); __nm.setMem(JSON.stringify(a));
      try { return __nm.load().runs.p.cur; } finally { __nm.setMem(null); }
    });
    check("同じ問題の途中なら、保存に失敗した側のまちがい（1段目・2段目）も消さずに合わせる", got && got.wrong.includes("上") && got.wrong.includes("下") && got.w2.includes("up") && got.w2.includes("down"), JSON.stringify(got));
    const n = await g.evaluate(() => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: ["ml0|s1", "ebb0|s1"], res: [], cur: null, id: "sc1" }; }); __nm.play("p"); __nm.sureCount(true); __nm.sureCount(true); return __nm.load().runs.p.ds; });
    check("「自信あり」の数は1問につき1回だけ（2つのタブで同じ問題を当てても2回足さない）", n && n.n === 1 && n.ok === 1, JSON.stringify(n));
    await ctx.close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    // ヒントの数は、別のタブで使った分も減らさない
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    // 正解した時も、別のタブで使ったヒントを合わせて★を数える（2026-11-07 CodeRabbit）
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`); await why(b); await b.waitForTimeout(150);
    check("正解の時も別のタブのヒントを合わせて数える（★1）", (await mem(b)).runs.d.res[1].m === 2);
    await ctx.close();
  }

  // 1問を深くする（shared-workflows routines/game-dev.md「1問を深くする」）：自信をかける・2段目「どのきまり？」・復習
  {
    const q = await newPage(); await closeHow(q);
    await q.evaluate((tags) => __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: tags, res: [], cur: null, id: "dp" }; }), ["ml0|dp1", "ebb0|dp2", "br0|dp3"]);
    await q.evaluate(() => { Depth.runStart(); __nm.play("p"); });
    const sb = await q.$eval("#dp-sure", (b) => [b.getBoundingClientRect().height, b.getAttribute("aria-pressed"), b.textContent]);
    check("自信のボタン：高さ44px以上・はじめは押していない", sb[0] >= 44 && sb[1] === "false", sb.join(","));
    await q.click("#dp-sure");
    check("自信のボタンを押すと ✓ が出る（色だけで分けない）", (await q.getAttribute("#dp-sure", "aria-pressed")) === "true" && (await q.textContent("#dp-sure")).includes("✓"));
    await q.click(`.ch[data-j="${await wrongIdx(q)}"]`);
    check("自信ありでまちがえると、知らせに「思いこみ」と出て、自信は変えられない", (await q.textContent("#msg")).includes("思いこみ") && await q.locator("#dp-sure:disabled").count() === 1);
    check("まちがえたその時に復習へ入る（解き終えずにやめても残る。2026-11-11 CodeRabbit）", await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("ndm-depth") || "{}"); return !!(d.rv && d.rv[__nm.cur().tag]); }));
    await q.click(`.ch[data-j="${await ansIdx(q)}"]`);
    check("正解すると、2段目「こう変えたら、錯覚は？」が3つ出る（押せる所は44px以上）", await q.locator(".why button").count() === 3 && await q.locator(".verdict").count() === 0 && (await q.$$eval(".why button", (b) => b.every((x) => Math.round(x.getBoundingClientRect().height) >= 44))));
    check("2段目の読み上げは、2段目の問い（変えること）と3つの答えだけ（1段目の選び肢を読まない。funka-level #1 の CodeRabbit）", await q.evaluate(() => { const e = [...document.querySelectorAll("[data-a11y-say]")]; return e.length === 4 && e[0].id === "m2" && e[0].textContent === __nm.cur().P.m2 && e.slice(1).every((x) => x.matches(".why button")); }));
    check("2段目の間は、1段目の選び肢は押せない", await q.evaluate(() => [...document.querySelectorAll(".ch")].every((b) => b.disabled)));
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __nm.play("p"));
    check("2段目の途中で閉じても、2段目から続く", await q.locator(".why button").count() === 3);
    const wg = await q.evaluate(() => Object.keys(__nm.G.GROUPS).find((x) => x !== __nm.cur().P.grp));
    await q.click(`.why button[data-g="${wg}"]`);
    check("2段目でまちがえると ✕ ちがう（破線）・もう一度選べる", await q.locator(".why button.ng").count() === 1 && (await q.textContent("#msg")).includes("✕"));
    check("2段目でまちがえると、錯覚を起こしている所を考える案内が出る", (await q.textContent("#msg")).includes("錯覚を起こしている"));
    await q.click("#hint");
    const ng1 = await q.locator(".why button:disabled").count();
    check("2段目のヒントは、まちがえた系統とは別のちがう系統を消す（★を使って何も消えないことが無い。2026-11-11 CodeRabbit）", ng1 === 2 && await q.locator(".why button:not(:disabled)").count() === 1, ng1);
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __nm.play("p"));
    check("2段目のヒントで消した系統は、閉じて開き直しても消えたまま（ヒントも押せないまま）", await q.locator(".why button:disabled").count() === ng1 && ng1 >= 1 && await q.locator("#hint:disabled").count() === 1 && (await q.textContent("#hintbox")).includes("消しました"));
    await why(q); await q.waitForSelector(".verdict");
    const m0 = await q.evaluate(() => __nm.load().runs.p.res[0].m);
    check("★は1段目と2段目のまちがい・ヒントを合わせて数える（1＋1＋1＝3）", m0 === 3, m0);
    check("答え合わせに、補助線の図・本当の値（data.js の real）・2段目の答えとわけ・自信ありでまちがえたことが出る", await q.locator(".verdict #rev svg").count() === 1 && (await q.textContent("#real")).includes(G.make("ml0|dp1").real) && (await q.textContent("#m2res")).includes(G.GROUPS[G.make("ml0|dp1").grp].name) && (await q.textContent(".verdict")).includes("自信ありでまちがえた"));
    await q.click("#next");
    await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await why(q); await q.click("#next");
    await q.click(`.ch[data-j="${await ansIdx(q)}"]`);
    check("ほかの種類（明るさ）でも、2段目が3つ出る", await q.locator(".why button").count() === 3);
    await why(q); await q.waitForSelector(".verdict");
    await q.click("#next"); await q.waitForTimeout(150);
    check("終えた直後の結果に「自信ありの当たり」が出る", (await q.textContent("#surestat")).includes("0/1"));
    const dp = await q.evaluate(() => JSON.parse(localStorage.getItem("ndm-depth") || "{}"));
    check("まちがえた・ヒントを使った問題だけ復習に入る", Object.keys(dp.rv || {}).join() === "ml0|dp1", Object.keys(dp.rv || {}).join(","));
    await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("ndm-depth")); for (const k in d.rv) d.rv[k].due = "2026-01-01"; localStorage.setItem("ndm-depth", JSON.stringify(d)); });
    // 復習の日付は、ブラウザの時計を TODAY の正午（日本時間）に止めてから数える（QA の途中で0時をまたいでも期待値とずれない。PR #1 の CodeRabbit）
    { const T0 = Date.parse(TODAY + "T03:00:00Z"); await q.addInitScript((t0) => { const o = Date.now, s0 = o(); Date.now = () => t0 + (o() - s0); }, T0); }
    await q.goto(url); await q.waitForTimeout(150);
    check("日の来た復習があると、ホームに「復習 1問」", (await q.textContent("#go-r")).includes("復習 1問"));
    const before = await mem(q);
    await q.click("#go-r");
    check("復習の画面は「復習」と出る・同じ問題", (await q.textContent("header")).includes("復習") && await q.evaluate(() => __nm.cur().tag) === "ml0|dp1");
    await solve(q); await q.click("#next"); await q.waitForTimeout(150);
    const after = await mem(q), dp2 = await q.evaluate(() => JSON.parse(localStorage.getItem("ndm-depth")));
    check("復習を終えると結果は「復習」・今日の記録は増えない・シェアは出ない", (await q.textContent("h1")).includes("復習") && JSON.stringify(after.days) === JSON.stringify(before.days) && await q.locator("#share").count() === 0);
    check("復習で一度で正解すると、次は3日後へ進む", dp2.rv["ml0|dp1"] && dp2.rv["ml0|dp1"].s === 1 && dp2.rv["ml0|dp1"].due === new Date(Date.parse(TODAY) + 3 * 864e5).toISOString().slice(0, 10));
    await q.goto(url); await q.waitForTimeout(150);
    check("復習を終えたら、ホームの「復習」は消える", await q.locator("#go-r").count() === 0);
    await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("ndm-depth")); d.rv["nai|1"] = { s: 0, due: "2026-01-01", t: 1 }; d.rv["constructor|x"] = { s: 0, due: "2026-01-01", t: 2 }; localStorage.setItem("ndm-depth", JSON.stringify(d)); });
    await q.goto(url); await q.waitForTimeout(150);
    check("作り直せない鍵（無い種類・constructor）は復習に数えず、ホームも出る", await q.locator("#go-d").count() === 1 && await q.locator("#go-r").count() === 0);
    // 別のタブで2段目へ進んでいたら、この画面も2段目になる・別のタブで先に進んだ古い画面は復習の段を戻さない（2026-11-11 CodeRabbit）
    { const tq = "ml0|dq1";
      await q.goto(url); await q.waitForTimeout(150);
      await q.evaluate((t) => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: [t], res: [], cur: null, id: "dq" }; }); __nm.play("p"); }, tq);
      await q.evaluate((t) => __nm.save((s) => { s.runs.p.cur = { i: 0, tag: t, wrong: [], hints: 0, step: 2, w2: [] }; }), tq);
      await q.click("#hint"); await q.waitForTimeout(100);
      check("別のタブで2段目へ進んでいたら、この画面も2段目になる", await q.locator(".why button").count() === 3 && await q.evaluate(() => __nm.cur().step) === 2);
      await q.evaluate((t) => { __nm.save((s) => { s.runs.p.res.push({ m: 0 }); s.runs.p.cur = null; }); const d = JSON.parse(localStorage.getItem("ndm-depth")); d.rv[t] = { s: 2, due: "2099-01-01", t: 9 }; localStorage.setItem("ndm-depth", JSON.stringify(d)); }, tq);
      await q.click("#hint"); await q.waitForTimeout(50);
      check("別のタブで先に進んだ古い画面でヒントを押しても、復習の段は戻らない", await q.evaluate((t) => JSON.parse(localStorage.getItem("ndm-depth")).rv[t].s, tq) === 2);
    }
    // 復習の途中でヒント・まちがいがあって日の来た問題が0になっても、ホームの「復習の続きから」で戻れる（2026-11-11 CodeRabbit）
    { const rk = Object.keys(dp2.rv)[0];
      await q.evaluate((k) => { const d = JSON.parse(localStorage.getItem("ndm-depth")); d.rv = { [k]: { s: 0, due: "2026-01-01", t: 3 } }; localStorage.setItem("ndm-depth", JSON.stringify(d)); }, rk);
      await q.goto(url); await q.waitForTimeout(150); await q.click("#go-r"); await q.click("#hint");
      await q.evaluate(() => __nm.save((s) => { s.runs.r.date = "2026-01-02"; }));
      await q.goto(url); await q.waitForTimeout(150);
      check("復習の途中でヒントを使って日の来た問題が0になっても・日が替わっても、ホームの「復習の続きから」で戻れる", ((await q.locator("#go-r").count()) ? await q.textContent("#go-r") : "").includes("続きから"));
      if (await q.locator("#go-r").count()) { await q.click("#go-r"); check("復習の続きは同じ問題・使ったヒントはそのまま", await q.evaluate(() => __nm.cur().tag) === rk && await q.evaluate(() => __nm.cur().hints) === 1); }
    }
    await q.context().close();
  }
  // スマホ幅・とても大きい文字でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const [w, fs] of [[320, 3], [390, 2], [320, 1]]) {
      const q = await newPage(w); await closeHow(q);
      await q.evaluate((fs) => (localStorage.setItem("ndm-fs", String(fs)), localStorage.setItem("a11y-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("a11y-v1") || "{}"), fs: undefined }))), fs); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e"]) {
        if (go === "solve") { await solve(q); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => Math.round(b.getBoundingClientRect().height) < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320px・とても大きい文字でも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }

  // 見やすさの設定を全部入れても、ページの一番下まで動ける（読み上げの class が html に当たって固まった。2026-11-05）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    // focus() で直接移さず、Tab だけで届くかを見る（tabindex=-1 などで Tab で届かないのを見逃さない。PR #1 の CodeRabbit）
    const tabTo = async (sel) => { for (let n = 0; n < 60; n++) { await q.keyboard.press("Tab"); if (await q.evaluate((x) => !!document.activeElement && document.activeElement.matches(x), sel)) return true; } return false; };
    await q.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); scrollTo(0, 0); });
    const t1 = await tabTo("#go-d"); if (t1) { await q.keyboard.press("Enter"); await q.waitForTimeout(100); }
    const j = await ansIdx(q);
    const t2 = await tabTo(`.ch[data-j="${j}"]`); if (t2) { await q.keyboard.press("Enter"); await q.waitForTimeout(100); }
    let t3 = true;
    if (await q.locator(".why button").count()) { t3 = await tabTo(`.why button[data-g="${await q.evaluate(() => __nm.cur().P.grp)}"]`); if (t3) { await q.keyboard.press("Enter"); await q.waitForTimeout(100); } }
    check("キーボード（Tab と Enter）だけで、始める・答える（2段目も）", t1 && t2 && t3 && await q.locator(".verdict").count() === 1, `${t1}/${t2}/${t3}`);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 深さの部品（shared-workflows template/qa/depth-check.mjs）
{ const e = await checkDepth(readFileSync(path.join(root, "depth.js"), "utf8")); check("depth.js（自信をかける・復習）の動き", e.length === 0, e.join(" / ")); }
// 2段目の系統：どの種類にもある（3つのどれか）
{ const q = await newPage(); await closeHow(q);
  check("保存に失敗したら、保存できるまで帯（#savewarn）で知らせ続け、保存できたら消す", await q.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; __nm.save(() => {}); __nm.save(() => {}); const one = document.querySelectorAll("#savewarn").length === 1 && document.getElementById("savewarn").textContent.includes("保存できませんでした"); await new Promise((r) => setTimeout(r, 1500)); const stay = !!document.getElementById("savewarn"); Storage.prototype.setItem = orig; __nm.save(() => {}); return one && stay && !document.getElementById("savewarn"); }));
  await q.evaluate(() => __nm.start("e")); await q.waitForTimeout(100);
  await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await why(q); await q.waitForSelector(".verdict");
  await q.click("#quit"); await q.waitForTimeout(150);
  check("とことんで正解した直後でも「ここで降りる」が効き、その問題も数える", (await q.textContent("#eres")).includes("1問"), await q.textContent("body"));
  // 保存に失敗したまま「ここで降りる」を押しても、保存してあった途中の回を戻さない（CodeRabbit kumo-namae#1）
  await q.evaluate(() => __nm.start("e")); await q.waitForTimeout(100);
  await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await why(q); await q.waitForSelector(".verdict");
  { const eid = await q.evaluate(() => __nm.load().runs.e.id);
    await q.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; });
    await q.click("#quit"); await q.waitForTimeout(150);
    const back = await q.evaluate(() => { const r = __nm.load().runs.e; return r ? r.id : null; });
    await q.evaluate(() => { Storage.prototype.setItem = window.__origSet; __nm.save(() => {}); });
    check("保存に失敗したまま「ここで降りる」を押しても、終えた回が「とことんの続き」に戻らない", back === null && (await q.evaluate(() => __nm.load().runs.e)) === null, `${eid} → ${back}`); }
  await q.close(); }
{ const q = await newPage(); await closeHow(q);
  await q.evaluate(() => { localStorage.setItem("ndm-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: { constructor: 1, toString: 2, "ml0": 1 }, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }); await q.reload(); await q.waitForTimeout(150);
  check("記録に constructor などの鍵が入っても、話の帳と実績の種類に数えない（CodeRabbit funka-level#1）", (await q.textContent("#go-dex")).includes(`1/${G.KINDS.length}`) && await q.evaluate(() => __nm.tally(__nm.load()).kinds) === 1, await q.textContent("#go-dex"));
  await q.close(); }
{ const bad = G.KINDS.filter((k) => { for (let i = 0; i < 200; i++) { const g = G.make(`${k.id}|g${i}`).grp; if (!G.GROUPS[g]) return true; } return false; }).map((k) => k.id);
  check("2段目「こう変えたら、錯覚は？」：どの種類にも出て、答えは強くなる・弱くなる・変わらないのどれか", bad.length === 0, bad.join(",")); }
// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "ndm-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-13": { m: [0, 1, 0, 0, 2], k: ["ponzo1", "ml0", "ebb0", "cafe1", "her1"] } }, hdays: {}, adays: {}, dex: { "ponzo1": 1, "ml0": 1, "ebb0": 1, "cafe1": 1, "her1": 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }), "ndm-fs": "3", "ndm-depth": JSON.stringify({ v: 1, rv: { "ml0|x1": { s: 1, due: "2026-11-20", t: 5 } } }) }; // 復習の記録も引き継ぐかを見る（CodeRabbit menkyo-nenrei#1）
  await checkTransfer({ browser, url, game: "nou-damasu", sample, check, open: async (pg) => { await firstClose(pg); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
// 共通部品 game-core の画面の動き（感想のリンク・はじめての練習と吹き出し・遊び方のボタン・不具合の帯。shared-workflows template/qa/core-check.mjs。PR #1 の CodeRabbit）
// はじめての案内の吹き出しの検査は飛ばす（first: false）：このゲームの2つ目の吹き出しは「.verdict を待つ」段で、待つあいだ吹き出しは隠れるが
// 「やってみる」のボタンに hidden が付かず、core-check が見えないボタンを30秒押しに行って止まる（ひな形 core-check の直しは shared-workflows で）。
// はじめての案内は、このファイルの上の検査（はじめて開くと出る・← で戻ると終わる）で見る
try { await checkCore({ browser, url, check, first: false }); } catch (e) { check("game-core の検査が最後まで動く", false, String(e).split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 脳がだます？ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
