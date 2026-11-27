// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、矢羽の付いた2本の線（ミュラー・リヤーの形）と「？」（脳がだます？）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <g stroke="#fffdf7" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M24 40 H70 M24 40 L14 32 M24 40 L14 48 M70 40 L80 32 M70 40 L80 48"/>
        <path d="M24 70 H70 M24 70 L34 62 M24 70 L34 78 M70 70 L60 62 M70 70 L60 78"/>
      </g>
      <circle cx="82" cy="16" r="12" fill="#f2a43a"/><text x="82" y="22" text-anchor="middle" font-size="18" font-weight="900" font-family="sans-serif" fill="#123554">?</text></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
