const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());
  const add = (n) => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const cache = { fetchedAt: new Date().toISOString(), calendars: 1, total: 1, items: [{ name: 'Kat', occasionId: 'birthday', date: add(2), title: "Kat's birthday", calendar: 'Chris', source: 'calendar' }] };
  await page.addInitScript(({ cache }) => { localStorage.clear(); indexedDB.deleteDatabase('celebrate'); localStorage.setItem('celebrate_calCache', JSON.stringify(cache)); localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' })); }, { cache });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Upcoming → New card for anyone
  await page.click('#anyoneBtn');
  await page.waitForSelector('#anyoneOverlay:not([hidden])');
  console.log('1 suggestions:', await page.locator('#peopleNames option').evaluateAll(o => o.map(x => x.value)));
  await page.fill('#anyName', 'Coach Ramirez');
  await page.selectOption('#anyOcc', 'thankyou');
  await page.click('#anyoneGo');
  await page.waitForTimeout(300);
  console.log('2 card:', await page.evaluate(() => { const s = window.__celebrate.state(); return { personKey: s.personKey, name: s.name, occ: s.occasionId }; }), '| maker visible:', await page.locator('#viewMaker').isVisible(), '| pill:', await page.locator('#personPill').textContent(), '| overlay hidden:', await page.locator('#anyoneOverlay').isHidden());
  console.log('   in people:', await page.evaluate(() => Object.keys(window.__celebrate.people())));

  // editor pill → Someone new…
  await page.getByRole('button', { name: 'New card' }).click(); await page.click('#confirmOk'); await page.waitForTimeout(200);
  await page.click('#personPill');
  await page.waitForSelector('#menuOverlay:not([hidden])');
  console.log('3 pill menu:', await page.locator('#menuList button').allTextContents());
  await page.locator('#menuList').getByRole('button', { name: 'Someone new…' }).click();
  await page.waitForSelector('#promptOverlay:not([hidden])');
  await page.fill('#promptInput', 'Neighbor Dee'); await page.click('#promptOk');
  await page.waitForTimeout(200);
  console.log('4 linked:', await page.evaluate(() => { const s = window.__celebrate.state(); return { personKey: s.personKey, name: s.name }; }), '| pill:', await page.locator('#personPill').textContent());

  // People tab lists both newcomers
  await page.getByRole('button', { name: 'People' }).click(); await page.waitForTimeout(400);
  console.log('5 people rows:', await page.locator('#peopleList .occ-name').allTextContents());
  const small = await page.evaluate(() => { document.getElementById('anyoneOverlay').hidden = false; const r = [...document.querySelectorAll('#anyoneOverlay button, #anyoneOverlay input, #anyoneOverlay select, #anyoneBtn')].filter(b => { const x = b.getBoundingClientRect(); return x.width > 0 && (x.width < 48 || x.height < 48); }).map(b => b.id + ' ' + Math.round(b.getBoundingClientRect().height)); document.getElementById('anyoneOverlay').hidden = true; return r; });
  console.log('6 sub-48:', small.length ? small : 'none');
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
