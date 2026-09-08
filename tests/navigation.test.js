// Going back, and getting back: the Android Back button closes sheets instead of leaving the app,
// a photo survives every layout change, and one-tap rearrangements offer Undo.
const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); indexedDB.deleteDatabase('celebrate'); localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' })); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const alive = () => page.evaluate(() => !!window.__celebrate);

  // 1. Back closes an overlay and keeps the app
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsOverlay:not([hidden])');
  await page.goBack();
  await page.waitForTimeout(300);
  console.log('1 Back closed settings:', await page.locator('#settingsOverlay').isHidden(), '| app alive:', await alive());

  // 2. Back from the editor returns to Upcoming, not out of the app
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);
  await page.goBack();
  await page.waitForTimeout(300);
  console.log('2 Back left editor:', await page.locator('#viewUpcoming').isVisible(), '| app alive:', await alive());

  // 3. Two sheets deep: Back unwinds one at a time
  await page.getByRole('button', { name: 'People' }).click();
  await page.locator('#addPerson summary').click();
  await page.fill('#newPersonName', 'Nora');
  await page.click('#addPersonBtn');
  await page.waitForSelector('#personOverlay:not([hidden])');
  await page.locator('#personBody').getByRole('button', { name: 'Remove from Celebrate…' }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  await page.goBack(); await page.waitForTimeout(300);
  console.log('3 after 1 Back — menu:', await page.locator('#menuOverlay').isHidden(), 'person sheet still open:', await page.locator('#personOverlay').isVisible());
  await page.goBack(); await page.waitForTimeout(300);
  console.log('   after 2 Backs — person sheet:', await page.locator('#personOverlay').isHidden(), '| app alive:', await alive());

  // 4. closing a sheet by hand keeps the history in step (Back then leaves the editor, not the app)
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Drafts' }).click();
  await page.waitForSelector('#draftsOverlay:not([hidden])');
  await page.click('#closeDrafts');
  await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(400);
  console.log('4 tap-close then Back → upcoming:', await page.locator('#viewUpcoming').isVisible(), '| app alive:', await alive());

  // 5. the photo follows the layout, both directions
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#456'; x.fillRect(0, 0, 300, 400);
    const s = window.__celebrate.state(); s.layoutId = 'photo-hero';
    s.photos[0] = { id: 'p0', dataUrl: c.toDataURL('image/jpeg', .7), mask: 'circle', fx: .5, fy: .5, scale: 1, filter: 'none', border: 'none' };
    window.__celebrate.buildAll();
  });
  await page.waitForTimeout(300);
  const shot = () => page.evaluate(() => { const s = window.__celebrate.state(); return { layout: s.layoutId, slot: !!s.photos[0], bg: !!s.background.photo, bgType: s.background.type, onCard: document.querySelectorAll('.photo-slot').length }; });
  console.log('5 photo-hero:', await shot());
  await page.evaluate(() => window.__celebrate.setLayout('big-name'));
  await page.waitForTimeout(300);
  console.log('   → big-name:', await shot());
  await page.evaluate(() => window.__celebrate.setLayout('collage'));
  await page.waitForTimeout(300);
  console.log('   → collage:', await shot());
  // and the Undo in that toast puts it back
  await page.locator('.toast-btn', { hasText: 'Undo' }).last().click();
  await page.waitForTimeout(300);
  console.log('   undo →:', await shot());

  // 6. a look, then a layout change: the look comes off, the card text returns, Undo restores
  await page.evaluate(() => {
    const s = window.__celebrate.state(); s.name = 'Sedona'; s.count = 10;
    window.__celebrate.setLayout('big-name');
    window.__celebrate.applyLook('golden');
  });
  await page.waitForTimeout(400);
  const look = () => page.evaluate(() => { const s = window.__celebrate.state(); return { lookId: s.lookId, show: s.style.show, lookPieces: s.stickers.filter(x => x.look).length + s.texts.filter(t => t.look).length, cardText: !!document.querySelector('#cardContent .name') }; });
  console.log('6 after look:', await look());
  await page.evaluate(() => window.__celebrate.setLayout('minimal-note'));
  await page.waitForTimeout(400);
  console.log('   after layout change:', await look());
  await page.locator('.toast-btn', { hasText: 'Undo' }).last().click();
  await page.waitForTimeout(400);
  console.log('   undo →:', await look());

  // 7. Remove look button, and Show everything rescue
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.waitForTimeout(200);
  console.log('7 remove-look button present:', await page.locator('#panelPhoto').getByRole('button', { name: 'Remove look' }).count());
  await page.locator('#panelPhoto').getByRole('button', { name: 'Remove look' }).click();
  await page.waitForTimeout(300);
  console.log('   after remove:', await look());
  await page.evaluate(() => { const s = window.__celebrate.state(); s.style.show = { kicker: false, name: false, message: false, from: false }; window.__celebrate.buildAll(); });
  await page.getByRole('tab', { name: 'Style' }).click();
  await page.waitForTimeout(200);
  await page.locator('#panelStyle').getByRole('button', { name: 'Show everything' }).click();
  await page.waitForTimeout(200);
  console.log('   show everything:', await page.evaluate(() => ({ show: window.__celebrate.state().style.show, name: !!document.querySelector('#cardContent .name') })));
  await page.screenshot({ path: path.join(OUT, 'nav-recovered.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
