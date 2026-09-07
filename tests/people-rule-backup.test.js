const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());
  const add = (n) => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const cache = { fetchedAt: new Date().toISOString(), calendars: 2, total: 2, items: [
    { name: 'Kat', occasionId: 'birthday', date: add(2), title: "Kat's birthday", calendar: 'Chris', source: 'calendar' },
    { name: 'Katherine Ortiz', occasionId: 'birthday', date: add(2), title: "Katherine Ortiz's birthday", calendar: 'Birthdays', source: 'calendar' },
    { name: 'Sedona', occasionId: 'anniversary', date: add(5), title: 'Sedona anniversary trip', calendar: 'Chris', source: 'calendar' },
    { name: 'Aunt Jane', occasionId: 'birthday', date: add(9), title: "Aunt Jane's birthday", calendar: 'Birthdays', source: 'calendar' }
  ]};
  await page.addInitScript(({ cache }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('celebrate_calCache', JSON.stringify(cache));
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x', apiKey: '', keywords: [], from: '— Chris & Kat' }));
    indexedDB.deleteDatabase('celebrate');
  }, { cache });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const rows = async () => page.evaluate(() => [...document.querySelectorAll('#upcomingList .occ-row')].map(r => r.querySelector('.name-btn').textContent + ' [' + [...r.querySelectorAll('.pill')].map(p => p.textContent).join(',') + '] ' + r.querySelector('.occ-actions .btn').textContent));
  console.log('1 upcoming rows:', await rows());

  // ---- Make card from Upcoming, save a draft, come back: row shows the draft and offers Continue ----
  await page.locator('#upcomingList .occ-row', { hasText: 'Aunt Jane' }).getByRole('button', { name: 'Make card' }).click();
  await page.waitForTimeout(300);
  console.log('2 new card state:', await page.evaluate(() => { const s = window.__celebrate.state(); return { personKey: s.personKey, name: s.name, id: s.id, occ: s.occasionId }; }));
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForSelector('#promptOverlay:not([hidden])');
  await page.fill('#promptInput', 'Jane draft one');
  await page.click('#promptOk');
  for (let i = 0; i < 60; i++){ await page.waitForTimeout(1000); if (await page.evaluate(async () => (await window.__celebrate.DB.all()).some(d => d.id !== '__current__' && d.title === 'Jane draft one'))) break; }
  await page.getByRole('button', { name: 'Upcoming' }).click();
  await page.waitForTimeout(500);
  console.log('3 rows after draft:', await rows(), await page.evaluate(async () => ({ db: (await window.__celebrate.DB.all()).map(d => d.id.slice(0,9) + ':' + d.title + ':' + d.personKey), idx: JSON.stringify(window.__celebrate.cardIndex()), btn: document.getElementById('saveDraftBtn').textContent })));
  await page.locator('#upcomingList .occ-row', { hasText: 'Aunt Jane' }).getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  console.log('4 continue menu:', await page.locator('#menuList button').allTextContents());
  await page.locator('#menuList').getByRole('button', { name: 'Continue “Jane draft one”' }).click();
  await page.waitForTimeout(400);
  console.log('5 continued draft:', await page.evaluate(() => { const s = window.__celebrate.state(); return { title: s.title, personKey: s.personKey, hasId: !!s.id }; }));

  // ---- check button is a door to the person's cards ----
  await page.getByRole('button', { name: 'Upcoming' }).click();
  await page.waitForTimeout(300);
  await page.locator('#upcomingList .occ-row', { hasText: 'Aunt Jane' }).locator('.check-btn').click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('6 sheet:', await page.locator('#personTitle').textContent(), '| labels:', await page.locator('#personBody .lbl').allTextContents(), '| draft tiles:', await page.locator('#personBody .draft-card').count());
  console.log('   top buttons:', await page.locator('#personBody .row').first().locator('button').allTextContents());

  // ---- Add a date from the person sheet → manual occasion + Google Calendar link ----
  await page.locator('#personBody summary', { hasText: 'Add a date' }).click();
  await page.selectOption('#pdOcc', 'anniversary');
  await page.fill('#pdDate', add(12));
  await page.locator('#personBody').getByRole('button', { name: 'Add date' }).click();
  await page.waitForTimeout(300);
  const calHref = await page.locator('#personBody a', { hasText: 'Add to Google Calendar' }).first().getAttribute('href');
  console.log('7 calendar link:', calHref && calHref.replace(/dates=\d+\/\d+/, 'dates=…'));
  await page.click('#closePerson');
  console.log('   upcoming has manual row:', (await rows()).filter(r => /Aunt Jane/.test(r)));

  // ---- Remove "Sedona" as not-a-person from Upcoming's ⋯ menu ----
  await page.locator('#upcomingList .occ-row', { hasText: 'Sedona' }).getByRole('button', { name: 'More options for Sedona' }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  console.log('8 row menu:', await page.locator('#menuList button').allTextContents());
  await page.locator('#menuList').getByRole('button', { name: 'Remove Sedona from Celebrate…' }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  await page.locator('#menuList').getByRole('button', { name: /Not a person/ }).click();
  await page.waitForTimeout(300);
  console.log('9 rows after remove:', (await rows()).map(r => r.split(' [')[0]));

  // ---- Merge duplicate: Katherine Ortiz → Kat ----
  await page.locator('#upcomingList .occ-row', { hasText: 'Katherine Ortiz' }).locator('.name-btn').click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  await page.fill('#personNotes', 'Loves peonies.');
  await page.waitForTimeout(500);
  await page.locator('#personBody').getByRole('button', { name: 'Remove from Celebrate…' }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  await page.locator('#menuList').getByRole('button', { name: /Duplicate of someone else/ }).click();
  await page.waitForSelector('#menuOverlay:not([hidden])');
  console.log('10 merge candidates:', await page.locator('#menuList button').allTextContents());
  await page.locator('#menuList').getByRole('button', { name: 'Kat', exact: true }).click();
  await page.waitForTimeout(500);
  console.log('11 rows after merge:', (await rows()).map(r => r.split(' ] ')[0]));
  console.log('   aliases:', await page.evaluate(() => window.__celebrate.aliases()), '| Kat notes:', await page.evaluate(() => (window.__celebrate.people().kat || {}).notes));

  // ---- People view: tabs, search, removed box ----
  await page.getByRole('button', { name: 'People' }).click();
  await page.waitForTimeout(500);
  const peopleNames = async () => page.evaluate(() => [...document.querySelectorAll('#peopleList .group-title, #peopleList .person-row .occ-name')].map(n => (n.classList.contains('group-title') ? '## ' : '') + n.textContent.trim()));
  console.log('12 soon:', await peopleNames());
  await page.click('#peopleTab_az');
  await page.waitForTimeout(300);
  console.log('13 a-z:', await peopleNames());
  await page.click('#peopleTab_month');
  await page.waitForTimeout(300);
  console.log('14 month:', await peopleNames());
  await page.fill('#peopleSearch', 'peon');
  await page.waitForTimeout(300);
  console.log('15 search "peon":', await peopleNames());
  await page.fill('#peopleSearch', '');
  await page.waitForTimeout(300);
  console.log('16 removed box:', await page.locator('#removedSummary').textContent(), '|', await page.locator('#removedList').textContent());
  await page.click('#removedSummary');
  await page.locator('#removedList').getByRole('button', { name: 'Restore' }).click();
  await page.waitForTimeout(300);
  console.log('17 after restore, removed hidden:', await page.locator('#removedBox').isHidden(), '| people:', await peopleNames());

  // ---- Export backup (download fallback) + notes text; then wipe and restore ----
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsOverlay:not([hidden])');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportJsonBtn')]);
  const jsonPath = path.join(OUT, 'backup.json'); await dl.saveAs(jsonPath);
  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('18 backup:', dl.suggestedFilename(), '| people:', Object.keys(backup.people), '| cards:', backup.cards.length, '| has files?', backup.cards.some(c => c.file || c.photos), '| aliases:', backup.aliases, '| manual:', backup.manual.length);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#exportTextBtn')]);
  const txtPath = path.join(OUT, 'notes.txt'); await dl2.saveAs(txtPath);
  console.log('19 notes text:', dl2.suggestedFilename(), '\n' + fs.readFileSync(txtPath, 'utf8').split('\n').slice(0, 12).join('\n'));
  // wipe and restore
  await page.evaluate(async () => { localStorage.removeItem('celebrate_people'); localStorage.removeItem('celebrate_aliases'); localStorage.removeItem('celebrate_manual'); const all = await window.__celebrate.DB.all(); for (const d of all) if (d.id !== '__current__') await window.__celebrate.DB.del(d.id); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  console.log('20 after wipe people:', await page.evaluate(() => Object.keys(window.__celebrate.people())));
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsOverlay:not([hidden])');
  await page.setInputFiles('#importFile', jsonPath);
  await page.waitForSelector('#confirmOverlay:not([hidden])');
  console.log('21 confirm:', await page.locator('#confirmMsg').textContent());
  await page.click('#confirmOk');
  await page.waitForTimeout(800);
  console.log('22 after restore:', await page.evaluate(async () => ({ people: Object.keys(window.__celebrate.people()), aliases: window.__celebrate.aliases(), cards: (await window.__celebrate.DB.all()).filter(d => d.id !== '__current__').map(d => d.title) })));

  // ---- tap targets ----
  await page.click('#closeSettings');
  await page.getByRole('button', { name: 'People' }).click();
  await page.waitForTimeout(300);
  await page.locator('.person-row').first().click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  await page.locator('#personBody summary', { hasText: 'Add a date' }).click();
  const small = await page.evaluate(() => [...document.querySelectorAll('#viewPeople button, #viewPeople input, #personOverlay button, #personOverlay a, #personOverlay input, #personOverlay select, #personOverlay textarea, #personOverlay summary')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 48 || r.height < 48); }).map(b => b.tagName + '.' + b.className + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)));
  console.log('23 sub-48px:', small.length ? small : 'none');
  await page.screenshot({ path: path.join(OUT, 'v15-person.png') });
  await page.click('#closePerson');
  await page.click('#peopleTab_month'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'v15-people.png') });
  await page.getByRole('button', { name: 'Upcoming' }).click(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'v15-upcoming.png') });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
