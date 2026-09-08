const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());
  const add = (n) => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const cache = { fetchedAt: new Date().toISOString(), calendars: 2, total: 2, items: [
    { name: 'Kat', occasionId: 'birthday', date: add(2), title: "Kat's birthday", calendar: 'Chris', source: 'calendar' },
    { name: 'Aunt Jane', occasionId: 'birthday', date: add(9), title: "Aunt Jane's birthday", calendar: 'Birthdays', source: 'calendar' }
  ]};
  // an archived card from before v1.4 (no personKey) for Aunt Jane — should still attach to her by name
  await page.addInitScript(({ cache, apiKey }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('celebrate_calCache', JSON.stringify(cache));
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x', apiKey, keywords: [], from: '— Chris & Kat' }));
    localStorage.removeItem('celebrate_people');
    indexedDB.deleteDatabase('celebrate');
  }, { cache, apiKey: 'sk-ant-test' });

  // Drive mocks
  const driveCalls = [];
  await page.route('https://www.googleapis.com/drive/v3/files?**', route => { driveCalls.push(route.request().method() + ' ' + route.request().url().slice(0, 70)); if (route.request().method() === 'GET') route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }); else route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'folder123' }) }); });
  await page.route('https://www.googleapis.com/upload/drive/v3/files?**', route => { const ct = route.request().headers()['content-type'] || ''; driveCalls.push('UPLOAD ' + ct.split(';')[0] + ' size=' + (route.request().postDataBuffer() || '').length); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'file789', webViewLink: 'https://drive.google.com/file/d/file789/view' }) }); });
  // Claude mock — checks that person notes made it into the prompt
  let lastPrompt = '';
  await page.route('https://api.anthropic.com/v1/messages', route => { lastPrompt = JSON.parse(route.request().postData()).messages[0].content; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'A note that mentions the marathon.' }] }) }); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // seed an old-style sent card for Aunt Jane
  await page.evaluate(async () => { await window.__celebrate.DB.put({ id: 'sentOLD', sent: true, sentVia: 'Share', sentAt: '2025-09-01T00:00:00Z', name: 'Aunt Jane', occasionId: 'birthday', title: 'Birthday — Aunt Jane', thumb: null }); });

  // ---- Upcoming: name opens the person sheet; notes persist ----
  await page.locator('.name-btn', { hasText: 'Kat' }).click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('person sheet title:', await page.locator('#personTitle').textContent());
  await page.fill('#personNotes', 'Just ran her first marathon. Loves peonies.');
  await page.waitForTimeout(600);
  console.log('people store:', await page.evaluate(() => Object.values(window.__celebrate.people()).map(p => p.name + ': ' + p.notes.slice(0, 20))));
  console.log('dates pills:', await page.locator('#personBody .skip-row span').allTextContents());

  // ---- Make a card from the person: draft linked, pill shows, Text tab shows her notes ----
  await page.locator('#personBody').getByRole('button', { name: 'Make a new card' }).click();
  await page.waitForTimeout(300);
  console.log('draft link:', await page.evaluate(() => { const s = window.__celebrate.state(); return { personKey: s.personKey, name: s.name, occ: s.occasionId }; }));
  console.log('pill:', await page.locator('#personPill').textContent(), '| active tab:', await page.locator('.tab[aria-selected="true"]').textContent());
  await page.getByRole('tab', { name: 'Text' }).click();
  console.log('text tab notes label:', await page.locator('label[for="aboutInput"]').textContent());
  console.log('text tab notes value:', await page.locator('#aboutInput').inputValue());

  // Ask Claude uses the person's notes
  await page.getByRole('button', { name: '✨ Ask Claude for a message' }).click();
  await page.waitForTimeout(600);
  console.log('claude prompt has notes:', /marathon/.test(lastPrompt), '| message applied:', await page.evaluate(() => window.__celebrate.state().message));

  // ---- Download → archived with personKey + file blob ----
  await page.getByRole('button', { name: 'Share card' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  await page.click('#exportDownloadBtn');
  await page.click('#closeExport');
  for (let i = 0; i < 40; i++){ await page.waitForTimeout(1000); if (await page.evaluate(async () => (await window.__celebrate.DB.all()).some(d => d.sent && d.personKey))) break; }
  console.log('archived:', await page.evaluate(async () => (await window.__celebrate.DB.all()).filter(d => d.sent).map(d => ({ id: d.id.slice(0, 7), personKey: d.personKey, hasFile: !!d.file, mime: d.mime }))));

  // ---- New card clears the person; switching people never carries notes over ----
  await page.getByRole('button', { name: 'New card' }).click();
  await page.click('#confirmOk');
  await page.waitForTimeout(200);
  console.log('after New card:', await page.evaluate(() => ({ personKey: window.__celebrate.state().personKey, about: window.__celebrate.state().about })), '| pill:', await page.locator('#personPill').textContent());

  // ---- People view: both people, Kat has notes + 1 card, Aunt Jane has the legacy card ----
  await page.getByRole('button', { name: 'People' }).click();
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.person-row')].map(r => r.querySelector('.occ-name').textContent + ' | ' + [...r.querySelectorAll('.pill')].map(p => p.textContent).join(',')));
  console.log('people rows:', rows);
  await page.locator('.person-row', { hasText: 'Aunt Jane' }).click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('Aunt Jane cards:', await page.locator('#personBody .draft-card').count(), '| legacy tile buttons:', await page.locator('#personBody .draft-card').first().locator('button').allTextContents());
  await page.click('#closePerson');

  // ---- Kat's sheet: card tile has Save to Drive; Drive upload flow with mocked token ----
  await page.locator('.person-row', { hasText: 'Kat' }).click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('Kat tile buttons:', await page.locator('#personBody .draft-card').first().locator('button').allTextContents());
  await page.evaluate(() => window.__celebrate.setToken('fake-token'));
  await page.locator('#personBody').getByRole('button', { name: 'Save to Drive' }).click();
  await page.waitForTimeout(800);
  console.log('drive calls:', driveCalls);
  console.log('after drive, tile has link:', await page.locator('#personBody .draft-card a', { hasText: 'In Drive' }).count(), '| record:', await page.evaluate(async () => (await window.__celebrate.DB.all()).filter(d => d.sent && d.driveId).map(d => d.driveLink)));

  // ---- Link an unlinked card to a person via the pill ----
  await page.click('#closePerson');
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(200);
  await page.click('#personPill');
  await page.waitForSelector('#menuOverlay:not([hidden])');
  await page.locator('#menuList').getByRole('button', { name: 'Aunt Jane' }).click();
  await page.waitForTimeout(200);
  console.log('linked via pill:', await page.evaluate(() => ({ personKey: window.__celebrate.state().personKey, name: window.__celebrate.state().name })), '| pill:', await page.locator('#personPill').textContent());

  // ---- reload: people persist ----
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  console.log('after reload people:', await page.evaluate(() => Object.keys(window.__celebrate.people())));

  // tap targets on People view + person sheet
  await page.getByRole('button', { name: 'People' }).click();
  await page.waitForTimeout(300);
  await page.locator('.person-row').first().click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  const small = await page.evaluate(() => [...document.querySelectorAll('#viewPeople button, #personOverlay button, #personOverlay a, #personOverlay input, #personOverlay textarea')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 48 || r.height < 48); }).map(b => b.tagName + '.' + b.className + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)));
  console.log('sub-48px:', small.length ? small : 'none');
  await page.screenshot({ path: path.join(OUT, 'v14-person.png'), fullPage: false });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
