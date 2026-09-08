// Photo looks: a ready-made overlay personalised with name, age and a note; show/hide + text shadow;
// the new Encouragement / Proud occasions; the single Share sheet.
const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); indexedDB.deleteDatabase('celebrate'); localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' })); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // 1. occasions + every look resolves to real stickers/fonts
  console.log('1 occasions:', await page.evaluate(() => window.__celebrate.OCCASIONS.filter(o => ['encourage', 'proud'].includes(o.id)).map(o => o.label + ' / ' + o.kicker)));
  console.log('   looks:', await page.evaluate(() => {
    const { LOOKS, STICKERS } = window.__celebrate; const bad = [];
    LOOKS.forEach(l => { const c = { name: 'Sedona', count: 10, countLabel: 'turns 10', note: 'x' }; l.stickers(c).concat(l.extra ? l.extra(c) : []).forEach(s => { if (!STICKERS[s.stickerId]) bad.push(l.id + ':' + s.stickerId); }); l.texts(c).forEach(t => { if (typeof t.text !== 'string') bad.push(l.id + ':text'); }); });
    return { count: LOOKS.length, bad };
  }));

  // 2. apply a look with a synthetic photo, name and age
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 400, 500); g.addColorStop(0, '#2b5876'); g.addColorStop(1, '#4e4376'); x.fillStyle = g; x.fillRect(0, 0, 400, 500);
    x.fillStyle = '#f2b134'; x.beginPath(); x.arc(200, 220, 90, 0, Math.PI * 2); x.fill();
    const s = window.__celebrate.state(); s.name = 'Sedona'; s.count = 10;
    s.background.photo = { id: 'pbgT', dataUrl: c.toDataURL('image/jpeg', .8), mask: 'full-bleed', fx: .5, fy: .5, scale: 1, filter: 'none', border: 'none' };
    window.__celebrate.applyLook('golden');
  });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => { const s = window.__celebrate.state(); return { lookId: s.lookId, layout: s.layoutId, bg: s.background.type, palette: s.paletteId, fonts: [s.style.display, s.style.body, s.style.hand], show: s.style.show, shadow: s.style.shadow, stickers: s.stickers.map(x => x.stickerId), texts: s.texts.map(t => t.text) }; });
  console.log('2 golden:', st);
  console.log('   card DOM:', await page.evaluate(() => ({ kicker: !!document.querySelector('#cardContent .kicker'), name: !!document.querySelector('#cardContent .name'), message: !!document.querySelector('#cardContent .message'), shadow: document.getElementById('cardCanvas').dataset.shadow, stickers: document.querySelectorAll('.sticker').length, texts: document.querySelectorAll('.textblock').length, textOnTop: (() => { const kids = [...document.getElementById('cardCanvas').children]; return kids.findIndex(k => k.classList.contains('textblock')) > kids.findIndex(k => k.classList.contains('sticker')); })() })));
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.waitForTimeout(200);
  console.log('   pressed look chip:', await page.locator('#panelPhoto .chip[aria-pressed="true"] span').first().textContent());
  await page.screenshot({ path: path.join(OUT, 'look-golden.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });

  // 3. a couple more looks render without errors and keep the photo
  for (const id of ['confetti', 'glow', 'bold', 'wreath']){
    await page.evaluate((id) => window.__celebrate.applyLook(id), id);
    await page.waitForTimeout(250);
    console.log('3 ' + id + ':', await page.evaluate(() => { const s = window.__celebrate.state(); return { photo: !!s.background.photo, stickers: s.stickers.length, texts: s.texts.map(t => t.text).join(' | ') }; }));
    await page.screenshot({ path: path.join(OUT, 'look-' + id + '.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });
  }
  // polaroid look needs a slot photo: without one, the picker opens (a hidden file input) — simulate via state
  await page.evaluate(() => { const s = window.__celebrate.state(); s.photos[0] = Object.assign({}, s.background.photo, { id: 'p0', mask: 'circle' }); window.__celebrate.applyLook('polaroid'); });
  await page.waitForTimeout(250);
  console.log('   polaroid:', await page.evaluate(() => { const s = window.__celebrate.state(); return { layout: s.layoutId, mask: s.photos[0].mask, bg: s.background.type, show: s.style.show.name, stickers: s.stickers.map(x => x.stickerId) }; }));
  await page.screenshot({ path: path.join(OUT, 'look-polaroid.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });

  // 4. Style tab: show/hide + shadow chips exist and work
  await page.getByRole('tab', { name: 'Style' }).click();
  await page.waitForTimeout(200);
  await page.locator('#panelStyle .chip', { hasText: 'Greeting' }).click();
  await page.locator('#panelStyle .chip', { hasText: 'Outline' }).click();
  await page.waitForTimeout(150);
  console.log('4 style:', await page.evaluate(() => ({ kicker: !!document.querySelector('#cardContent .kicker'), shadow: document.getElementById('cardCanvas').dataset.shadow })));

  // 5. Share sheet: one button on the stage; the sheet has all the ways out; PNG export still fine with a look
  console.log('5 stage buttons:', await page.locator('.stage-actions button').allTextContents());
  await page.getByRole('button', { name: 'Share card' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  console.log('   sheet:', await page.locator('#exportOverlay .share-grid button').allTextContents(), '| img:', await page.evaluate(async () => { const r = await fetch(document.getElementById('exportImg').src); const b = await r.blob(); return b.type + ' ' + b.size; }));
  await page.click('#closeExport');

  // 6. the look stays across a reload (draft persistence keeps show/shadow/look pieces)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log('6 after reload:', await page.evaluate(() => { const s = window.__celebrate.state(); return { lookId: s.lookId, shadow: s.style.shadow, show: s.style.show, stickers: s.stickers.length, texts: s.texts.length }; }));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
