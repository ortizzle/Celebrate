// Year over year: ages and milestones from original dates, "different from last time" context for
// Claude, the one-year image rule, and the Email button's share-or-download path.
const { launch, BASE, OUT, today, add } = require('./_setup');
const path = require('path');
(async () => {
  const { browser, page, errors } = await launch();
  const y = Number(today.slice(0, 4));
  const manual = [
    { id: 'm1', name: 'Sedona', occasionId: 'birthday', date: `${y - 10}-${add(3).slice(5)}`, yearly: true, createdAt: '2025-01-01T00:00:00Z' },    // turns 10 → milestone
    { id: 'm2', name: 'Mom & Dad', occasionId: 'anniversary', date: `${y - 40}-${add(6).slice(5)}`, yearly: true, createdAt: '2025-01-01T00:00:00Z' }, // 40 years
    { id: 'm3', name: 'Uncle Rob', occasionId: 'birthday', date: `${y - 47}-${add(9).slice(5)}`, yearly: true, createdAt: '2025-01-01T00:00:00Z' }     // turns 47 → not a milestone
  ];
  await page.addInitScript(({ manual }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear(); indexedDB.deleteDatabase('celebrate');
    localStorage.setItem('celebrate_manual', JSON.stringify(manual));
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x', apiKey: 'sk-ant-test' }));
  }, { manual });
  let lastPrompt = '';
  await page.route('https://api.anthropic.com/v1/messages', route => { lastPrompt = JSON.parse(route.request().postData()).messages[0].content; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'Fresh words this year.' }] }) }); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. rows show the age / years
  console.log('1 rows:', await page.evaluate(() => [...document.querySelectorAll('#upcomingList .occ-row')].map(r => r.querySelector('.name-btn').textContent + ' [' + [...r.querySelectorAll('.pill')].map(p => p.textContent).join(',') + ']')));
  console.log('   milestone rule:', await page.evaluate(() => { const m = window.__celebrate.isMilestone; return { b10: m('birthday', 10), b47: m('birthday', 47), b50: m('birthday', 50), a3: m('anniversary', 3), none: m('birthday', null) }; }), '| labels:', await page.evaluate(() => { const c = window.__celebrate.countLabel; return [c('birthday', 10), c('anniversary', 1), c('anniversary', 40), c('graduation', 2), c('graduation', 23)]; }));

  // 2. milestone birthday seeds a big number text block; a plain one doesn't
  await page.locator('#upcomingList .occ-row', { hasText: 'Sedona' }).getByRole('button', { name: 'Make card' }).click();
  await page.waitForTimeout(300);
  console.log('2 Sedona card:', await page.evaluate(() => { const s = window.__celebrate.state(); return { count: s.count, texts: s.texts.map(t => t.text + (t.auto ? '*' : '')) }; }));
  // Ask Claude mentions the age
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.getByRole('button', { name: '✨ Ask Claude for a message' }).click();
  await page.waitForTimeout(500);
  console.log('   prompt has age:', /turning 10/.test(lastPrompt));
  await page.getByRole('button', { name: 'Upcoming' }).click(); await page.waitForTimeout(300);
  await page.locator('#upcomingList .occ-row', { hasText: 'Uncle Rob' }).getByRole('button', { name: 'Make card' }).click();
  await page.waitForTimeout(300);
  console.log('   Uncle Rob card:', await page.evaluate(() => { const s = window.__celebrate.state(); return { count: s.count, autoTexts: s.texts.filter(t => t.auto).length }; }));
  await page.getByRole('button', { name: 'Upcoming' }).click(); await page.waitForTimeout(300);
  await page.locator('#upcomingList .occ-row', { hasText: 'Mom & Dad' }).getByRole('button', { name: 'Make card' }).click();
  await page.waitForTimeout(300);
  console.log('   anniversary card:', await page.evaluate(() => { const s = window.__celebrate.state(); return { count: s.count, autoTexts: s.texts.filter(t => t.auto).map(t => t.text) }; }));

  // 3. person sheet shows the age next to the date
  await page.getByRole('button', { name: 'Upcoming' }).click(); await page.waitForTimeout(300);
  await page.locator('#upcomingList .occ-row', { hasText: 'Sedona' }).locator('.name-btn').click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('3 dates:', await page.locator('#personBody .skip-row > span').allTextContents());
  await page.click('#closePerson');

  // 4. last year's card: seed a sent card for Sedona, then start a new one
  const oldDate = new Date(Date.now() - 370 * 86400000).toISOString();
  await page.evaluate(async ({ oldDate }) => {
    const bigFile = new Blob([new Uint8Array(1024 * 200)], { type: 'image/png' });
    await window.__celebrate.DB.put({ id: 'sentOLD', sent: true, sentVia: 'Share', sentAt: oldDate, name: 'Sedona', personKey: 'sedona', occasionId: 'birthday', title: 'Birthday — Sedona', paletteId: 'marigold', layoutId: 'big-name', message: 'Nine looks good on you.', thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', file: bigFile, mime: 'image/png' });
    await window.__celebrate.DB.put({ id: 'sentNEW', sent: true, sentVia: 'Share', sentAt: new Date().toISOString(), name: 'Uncle Rob', personKey: 'uncle rob', occasionId: 'birthday', title: 'Birthday — Uncle Rob', paletteId: 'ember', layoutId: 'collage', message: 'Recent.', thumb: null, file: bigFile, mime: 'image/png' });
  }, { oldDate });
  await page.waitForTimeout(400);
  await page.locator('#upcomingList .occ-row', { hasText: 'Sedona' }).getByRole('button', { name: 'Make card' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('tab', { name: 'Occasion' }).click();
  console.log('4 last-card box:', await page.locator('#panelOccasion .last-card').count(), '|', await page.locator('#panelOccasion .last-card b').textContent(), '|', (await page.locator('#panelOccasion .last-card .hint').textContent()).slice(0, 60), '| auto btn:', await page.locator('#panelOccasion .btn.primary').textContent());
  await page.locator('#panelOccasion .btn.primary').click();
  await page.waitForTimeout(600);
  console.log('   design prompt steers away:', /Last time .*Marigold Fiesta.*Big Name.*clearly different/s.test(lastPrompt), '| has age:', /turning 10/.test(lastPrompt));
  await page.locator('#panelOccasion').getByRole('button', { name: 'Start from it' }).click();
  await page.waitForTimeout(300);
  console.log('   start from it:', await page.evaluate(() => { const s = window.__celebrate.state(); return { message: s.message, personKey: s.personKey, id: s.id, sent: s.sent }; }));

  // 5. one-year image rule + storage summary
  await page.evaluate(() => window.__celebrate.pruneOldImages());
  console.log('5 after prune:', await page.evaluate(async () => (await window.__celebrate.DB.all()).filter(d => d.sent).map(d => d.id + ':' + (d.file ? 'image' : 'no-image') + ':' + (d.thumb ? 'thumb' : 'no-thumb'))), '| summary:', await page.evaluate(() => window.__celebrate.storageSummary()));
  await page.click('#settingsBtn');
  await page.waitForTimeout(300);
  console.log('   settings hint:', await page.locator('#storageHint').textContent());
  await page.click('#closeSettings');

  // 6. Email: no file share here → downloads the PNG and opens mailto
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(200);
  let mailto = '';
  await page.route('mailto:**', r => { mailto = r.request().url(); r.abort(); }).catch(() => {});
  page.on('framenavigated', f => { if (f.url().startsWith('mailto:')) mailto = f.url(); });
  await page.getByRole('button', { name: 'Share card' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#emailBtn')]);
  await page.waitForTimeout(800);
  console.log('6 email download:', dl.suggestedFilename(), '| mailto seen:', mailto.slice(0, 40) || await page.evaluate(() => location.href.startsWith('mailto:')), '| archived as Email:', await page.evaluate(async () => (await window.__celebrate.DB.all()).some(d => d.sentVia === 'Email')));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
