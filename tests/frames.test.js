// Occasion photo frames: every frame paints, follows the mask, is suggested for the right
// occasions, survives export and reload, and old thin/thick borders migrate to the mat frame.
const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear(); indexedDB.deleteDatabase('celebrate');
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' }));
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // 1. the set itself
  console.log('1 frames:', await page.evaluate(() => window.__celebrate.PHOTO_FRAMES.map(f => f.id + (f.occasions.length ? '(' + f.occasions.length + ')' : ''))));
  console.log('   every occasion has at least one suggestion:', await page.evaluate(() => {
    const { OCCASIONS, PHOTO_FRAMES } = window.__celebrate;
    return OCCASIONS.filter(o => !PHOTO_FRAMES.some(f => f.occasions.includes(o.id))).map(o => o.id);
  }));

  // 2. a photo + each frame paints without throwing, and changes the pixels
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500; const x = c.getContext('2d');
    x.fillStyle = '#2b5876'; x.fillRect(0, 0, 400, 500);
    const s = window.__celebrate.state();
    s.layoutId = 'photo-hero'; s.name = 'Sedona';
    s.photos[0] = { id: 'p0', dataUrl: c.toDataURL('image/jpeg', .8), mask: 'full-bleed', fx: .5, fy: .5, scale: 1, filter: 'none', frame: 'none' };
    window.__celebrate.buildAll();
  });
  await page.waitForTimeout(400);
  // The canvas is drawn at DPR 3, so sample in device pixels: a ring just inside the edge plus the
  // four corners, which is everywhere a frame can live.
  const sample = () => page.evaluate(() => {
    const cv = document.querySelector('.photo-slot canvas'), g = cv.getContext('2d');
    const W = cv.width, H = cv.height, i = Math.round(Math.min(W, H) * .04), out = [];
    const at = (x, y) => { const d = g.getImageData(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))), 1, 1).data; out.push(d[0] + ':' + d[1] + ':' + d[2]); };
    [i * .3, i * .6, i, i * 1.6].forEach(d => {
      const q = Math.round(d);
      for (let k = 0; k < 8; k++){ const t = (k + .5) / 8; at(W * t, q); at(W * t, H - q); at(q, H * t); at(W - q, H * t); }
      [[q, q], [W - q, q], [q, H - q], [W - q, H - q]].forEach(([x, y]) => at(x, y));
    });
    return out.join(',');
  });
  const plain = await sample();
  const ids = await page.evaluate(() => window.__celebrate.PHOTO_FRAMES.map(f => f.id));
  const changed = [];
  for (const id of ids.filter(i => i !== 'none')){
    await page.evaluate((id) => { window.__celebrate.state().photos[0].frame = id; window.__celebrate.buildAll(); }, id);
    await page.waitForTimeout(180);
    if ((await sample()) !== plain) changed.push(id);
  }
  console.log('2 frames that visibly paint:', changed.length + '/' + (ids.length - 1), changed.length === ids.length - 1 ? 'all' : 'MISSING: ' + ids.filter(i => i !== 'none' && !changed.includes(i)));

  // 3. the frame follows a non-rectangular mask without throwing
  for (const mask of ['circle', 'arch', 'blob', 'polaroid']){
    await page.evaluate((mask) => { const s = window.__celebrate.state(); s.photos[0].mask = mask; s.photos[0].frame = 'gold'; window.__celebrate.buildAll(); }, mask);
    await page.waitForTimeout(180);
  }
  console.log('3 all masks painted, errors so far:', errors.length ? errors : 'none');
  await page.evaluate(() => { const s = window.__celebrate.state(); s.photos[0].mask = 'full-bleed'; s.photos[0].frame = 'party'; window.__celebrate.buildAll(); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'frame-party.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });

  // 4. the picker shows occasion suggestions first
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.waitForTimeout(250);
  console.log('4 picker labels:', await page.locator('#panelPhoto .lbl').allTextContents());
  const rows = await page.evaluate(() => [...document.querySelectorAll('#panelPhoto .row')].map(r => [...r.querySelectorAll('.chip')].map(c => c.textContent).join(',')).filter(Boolean));
  console.log('   suggested row:', rows.find(r => /Party|Scallop/.test(r) && r.split(',').length < 6) || rows[rows.length - 2]);
  console.log('   pressed frame chip:', await page.evaluate(() => {
    const row = [...document.querySelectorAll('#panelPhoto .row')].find(r => [...r.querySelectorAll('.chip')].some(c => c.textContent === 'Museum mat'));
    const p = row && row.querySelector('.chip[aria-pressed="true"]'); return p ? p.textContent : 'none';
  }));

  // 5. a background photo gets frames too
  await page.evaluate(() => {
    const s = window.__celebrate.state();
    s.background.photo = Object.assign({}, s.photos[0], { id: 'pbg', frame: 'gold' });
    s.background.type = 'photo'; s.layoutId = 'big-name'; s.photos[0] = null;
    window.__celebrate.buildAll();
  });
  await page.waitForTimeout(300);
  console.log('5 bg frame painted:', await page.evaluate(() => {
    const cv = document.querySelector('#cardBg canvas'); const d = cv.getContext('2d').getImageData(4, Math.round(cv.height / 2), 1, 1).data;
    return d[0] > 120 && d[1] > 90;   // gold, not the blue photo
  }));
  await page.screenshot({ path: path.join(OUT, 'frame-gold-bg.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });

  // 6. export still works with a frame, and the frame survives a reload
  await page.getByRole('button', { name: 'Share card' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  console.log('6 export:', await page.evaluate(async () => { const r = await fetch(document.getElementById('exportImg').src); const b = await r.blob(); return b.type + ' ' + b.size; }));
  await page.click('#closeExport');
  // pick a frame through the UI so the draft is actually marked dirty and saved
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.waitForTimeout(250);
  await page.locator('#panelPhoto .chip', { hasText: 'Pearls' }).first().click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  console.log('   after reload:', await page.evaluate(() => { const s = window.__celebrate.state(); return { bgFrame: s.background.photo && s.background.photo.frame }; }));

  // 7. a draft saved before frames existed migrates
  console.log('7 migration:', await page.evaluate(() => {
    const legacy = { id: 'old', occasionId: 'birthday', name: 'Old', photos: [{ id: 'x', dataUrl: 'data:,', mask: 'circle', fx: .5, fy: .5, scale: 1, filter: 'none', border: 'thick' }, null, null] };
    const out = window.__celebrate.normalizeDraft(legacy);
    return { frame: out.photos[0].frame, borderGone: !('border' in out.photos[0]) };
  }));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
