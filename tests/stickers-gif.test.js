const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => { localStorage.clear(); indexedDB.deleteDatabase('celebrate'); localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' })); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. every sticker parses and has a working animation
  console.log('1 stickers:', await page.evaluate(() => {
    const { STICKERS, ANIMS } = window.__celebrate;
    const bad = [];
    for (const [id, d] of Object.entries(STICKERS)){
      const doc = new DOMParser().parseFromString(d.svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) bad.push(id + ':parse');
      if (!ANIMS[d.anim]) bad.push(id + ':anim=' + d.anim);
      if (/<g[^>]*class="[^"]*"[^>]*transform=/.test(d.svg)) bad.push(id + ':part-has-transform');
    }
    return { count: Object.keys(STICKERS).length, anims: Object.keys(ANIMS).length, bad };
  }));

  // 2. put every sticker on one card; animation loop must move things
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const st = window.__celebrate.state(); const ids = Object.keys(window.__celebrate.STICKERS);
    st.stickers = ids.map((id, i) => ({ uid: 'u' + i, stickerId: id, x: 12 + (i % 5) * 19, y: 10 + Math.floor(i / 5) * 15, rot: 0, scale: .75, flip: false }));
    window.__celebrate.buildAll();
  });
  await page.waitForTimeout(250);
  const snap = async () => page.evaluate(() => [...document.querySelectorAll('.sticker')].map(w => w.style.transform + '|' + [...w.querySelectorAll('[transform]')].map(g => g.getAttribute('transform')).join(';')));
  const s1 = await snap(); await page.waitForTimeout(400); const s2 = await snap();
  const moved = s1.filter((v, i) => v !== s2[i]).length;
  console.log('2 stickers on card:', s1.length, '| moved between ticks:', moved, '| parts with transform attr on first:', (s1[0].split('|')[1] || '').split(';').filter(Boolean).length);
  await page.screenshot({ path: path.join(OUT, 'v16-allstickers.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });

  // 3. reduced motion: nothing moves, still pose applied
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__celebrate.buildAll());
  await page.waitForTimeout(300);
  const r1 = await snap(); await page.waitForTimeout(400); const r2 = await snap();
  console.log('3 reduced-motion moved:', r1.filter((v, i) => v !== r2[i]).length);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // 4. hold still toggle via selection toolbar
  await page.evaluate(() => { const w = document.querySelector('.sticker[data-sticker="heart"]'); w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 })); w.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 })); });
  await page.waitForTimeout(200);
  console.log('4 selbar:', await page.locator('#selBar').isVisible(), '| buttons:', await page.locator('#selBar .tool-grid button').allTextContents());
  await page.locator('#selBar').getByRole('button', { name: 'Hold still' }).click();
  await page.waitForTimeout(100);
  console.log('   heart still attr:', await page.evaluate(() => document.querySelector('.sticker[data-sticker="heart"]').dataset.still), '| state.still:', await page.evaluate(() => window.__celebrate.state().stickers.find(s => s.stickerId === 'heart').still), '| button now:', await page.locator('#selBar .tool-grid button', { hasText: /Animate|Hold/ }).textContent());
  await page.locator('#selBar').getByRole('button', { name: 'Done' }).click();

  // 5. PNG export still works with all stickers
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Preview PNG' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  console.log('5 png export in', ((Date.now() - t0) / 1000).toFixed(1) + 's', '| img:', await page.evaluate(async () => { const r = await fetch(document.getElementById('exportImg').src); const b = await r.blob(); return b.type + ' ' + b.size; }));
  await page.click('#closeExport');

  // 6. GIF export: 16 frames, loops
  const t1 = Date.now();
  await page.getByRole('button', { name: 'Animated GIF' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 300000 });
  console.log('6 gif export in', ((Date.now() - t1) / 1000).toFixed(1) + 's', await page.evaluate(async () => {
    const r = await fetch(document.getElementById('exportImg').src); const buf = new Uint8Array(await r.arrayBuffer());
    let frames = 0; for (let i = 0; i < buf.length - 2; i++) if (buf[i] === 0x21 && buf[i + 1] === 0xF9 && buf[i + 2] === 0x04) frames++;
    let loop = false; for (let i = 0; i < buf.length - 11; i++) if (buf[i] === 0x4E && buf[i+1] === 0x45 && buf[i+2] === 0x54 && buf[i+3] === 0x53 && buf[i+4] === 0x43) { loop = true; break; }
    return { bytes: buf.length, frames, loops: loop, w: buf[6] | (buf[7] << 8), h: buf[8] | (buf[9] << 8) };
  }));
  await page.click('#closeExport');
  // the live loop must resume after export
  await page.waitForTimeout(100);
  const a1 = await snap(); await page.waitForTimeout(400); const a2 = await snap();
  console.log('   loop resumed after export:', a1.filter((v, i) => v !== a2[i]).length > 0);

  // 7. home button
  await page.click('#homeBtn');
  await page.waitForTimeout(200);
  console.log('7 home:', await page.locator('#viewUpcoming').isVisible(), '| maker hidden:', await page.locator('#viewMaker').isHidden(), '| homeBtn size:', await page.evaluate(() => { const r = document.getElementById('homeBtn').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }));

  // 8. sticker picker screenshot
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.getByRole('tab', { name: 'Stickers' }).click();
  await page.waitForTimeout(200);
  await page.locator('#panelStickers').screenshot({ path: path.join(OUT, 'v16-picker.png') });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
