// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題は入れず、遊び方の例だけ（正解の印も付けない。CodeRabbit mansion-kimari#1）。
// 図は data.js の矢羽の図（ml0）と同じ描き方で、2本を同じ長さにした見本。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const line = (t) => `<div style="flex:1;text-align:center;font-size:34px;font-weight:700;padding:10px;border-radius:12px;background:#fff;border:3px solid #1d2a3f55">${t}</div>`;
  const fin = (x, y, s) => `<path d="M${x} ${y} l${s * 26} -15 M${x} ${y} l${s * 26} 15"/>`;
  const fig = `<svg viewBox="0 0 560 260" width="100%" style="display:block" xmlns="http://www.w3.org/2000/svg"><rect width="560" height="260" fill="#fbf8f0"/><g stroke="#222" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M150 80 H410"/>${fin(150, 80, -1)}${fin(410, 80, 1)}<path d="M150 190 H410"/>${fin(150, 190, 1)}${fin(410, 190, -1)}</g></svg>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:48px 56px;background:#f3efe4;color:#1d2a3f;display:flex;gap:40px;align-items:center">
    <div style="flex:0 0 440px">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">目の錯覚</div>
      <div style="font-size:84px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">脳が<br><span style="color:#b23a24">だます？</span></div>
      <div style="font-size:36px;margin-top:14px">同じ長さ？ 同じ色？<br>補助線で確かめる。</div>
    </div>
    <div style="flex:1;background:#fffdf7;border:4px solid #1d2a3f;border-radius:8px;overflow:hidden">
      <div style="font-size:32px;font-weight:700;padding:18px 20px 6px">👁 どちらが長く見える？</div>
      ${fig}
      <div style="display:flex;gap:10px;padding:12px 16px 18px">${line("上")}${line("下")}${line("同じ")}</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
