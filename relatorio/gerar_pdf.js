const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [src, pdf, shots] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + src);
  await p.waitForTimeout(500);
  await p.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (shots) {
    const n = await p.$$eval('.page', e => e.length);
    for (let i = 0; i < n; i++) { const el = (await p.$$('.page'))[i]; await el.screenshot({ path: `${shots}/p${i + 1}.png` }); }
    // overflow check
    console.log(JSON.stringify(await p.$$eval('.page', ps => ps.map((pg, i) => { const foot = pg.querySelector('.foot'); let max = 0; pg.querySelectorAll('*').forEach(e => { if (e.closest('.foot') || e.closest('.runhead') || e === foot) return; const r = e.getBoundingClientRect(); if (r.height) max = Math.max(max, r.bottom - pg.getBoundingClientRect().top); }); return [i + 1, Math.round(max), foot ? Math.round(foot.getBoundingClientRect().top - pg.getBoundingClientRect().top) : null]; }))));
  }
  await b.close();
})();
