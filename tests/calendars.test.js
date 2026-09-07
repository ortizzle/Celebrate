const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();
  const cache = { fetchedAt: new Date().toISOString(), calendars: 6, total: 13, items: [],
    calendarList: [{ id: 'chris@x', summary: 'Chris', selected: true }, { id: 'kat@x', summary: 'Kat', selected: true }, { id: 'work@x', summary: 'Work stuff', selected: false }, { id: 'addressbook#contacts@group.v.calendar.google.com', summary: 'Birthdays', selected: false }] };
  const longMsg = 'Line one of a very long message that goes on and on.\n'.repeat(9);
  await page.addInitScript(({ cache, longMsg }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('celebrate_calCache', JSON.stringify(cache));
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x', apiKey: '', keywords: [], from: '— Chris & Kat', calendars: {} }));
    localStorage.setItem('celebrate_draft', JSON.stringify({ occasionId: 'sympathy', name: 'Aunt Jane', message: longMsg, lastAutoMessage: '', from: '— Chris & Kat', paletteId: 'harbor', layoutId: 'minimal-note', format: 'portrait', photos: [null, null, null], stickers: [] }));
    indexedDB.deleteDatabase('celebrate');
  }, { cache, longMsg });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // settings calendar picker
  await page.click('#settingsBtn');
  const boxes = await page.evaluate(() => [...document.querySelectorAll('#calPickList input')].map(i => i.dataset.cal.split('@')[0] + ':' + i.checked));
  console.log('calendar checkboxes (default):', boxes);
  await page.locator('#calPickList input[data-cal="work@x"]').check();
  await page.locator('#calPickList input[data-cal="kat@x"]').uncheck();
  await page.click('#saveSettingsBtn');
  console.log('saved calendars:', await page.evaluate(() => JSON.parse(localStorage.getItem('celebrate_settings')).calendars));
  console.log('status line:', await page.locator('#calStatus').textContent());

  // minimal note auto-fit
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => { const c = document.getElementById('cardCanvas'), ct = document.getElementById('cardContent'); return { fit: c.style.getPropertyValue('--fit'), overflow: ct.scrollHeight - ct.clientHeight }; });
  console.log('auto-fit with long message:', fit);
  await page.screenshot({ path: path.join(OUT, 'v111-fit.png'), clip: { x: 0, y: 150, width: 390, height: 470 } });
  await page.getByRole('tab', { name: 'Style' }).click();
  await page.getByRole('button', { name: 'Top' }).click();
  await page.getByRole('button', { name: 'Compact' }).click();
  await page.waitForTimeout(200);
  console.log('attrs:', await page.evaluate(() => { const c = document.getElementById('cardCanvas'); return { vpos: c.dataset.vpos, space: c.dataset.space, fit: c.style.getPropertyValue('--fit') }; }));
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.fill('#nameInput', 'Jane');
  await page.fill('#msgInput', 'Short note.');
  await page.waitForTimeout(200);
  console.log('after short message fit:', await page.evaluate(() => document.getElementById('cardCanvas').style.getPropertyValue('--fit')));
  await page.screenshot({ path: path.join(OUT, 'v111-compact-top.png'), clip: { x: 0, y: 150, width: 390, height: 470 } });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
