// Today's date on every screen, and the days-until reading as the headline on both lists.
const { launch, BASE, OUT, today, add } = require('./_setup');
const path = require('path');
(async () => {
  const { browser, page, errors } = await launch();
  const y = Number(today.slice(0, 4));
  const cache = { fetchedAt: new Date().toISOString(), calendars: 1, total: 1, items: [
    { name: 'Kat', occasionId: 'birthday', date: today, title: "Kat's birthday", calendar: 'Chris', source: 'calendar' },
    { name: 'Nora', occasionId: 'birthday', date: add(1), title: "Nora's birthday", calendar: 'Chris', source: 'calendar' },
    { name: 'Aunt Jane', occasionId: 'birthday', date: add(9), title: "Aunt Jane's birthday", calendar: 'Chris', source: 'calendar' }
  ]};
  // Someone whose only date is months out — they never reach Upcoming, but People should still count down.
  const manual = [{ id: 'm1', name: 'Far Fred', occasionId: 'birthday', date: `${y - 30}-${add(200).slice(5)}`, yearly: true, createdAt: '2025-01-01T00:00:00Z' }];
  await page.addInitScript(({ cache, manual }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear(); indexedDB.deleteDatabase('celebrate');
    localStorage.setItem('celebrate_calCache', JSON.stringify(cache));
    localStorage.setItem('celebrate_manual', JSON.stringify(manual));
    localStorage.setItem('celebrate_settings', JSON.stringify({ clientId: 'x' }));
  }, { cache, manual });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. today's date is in the header, on every screen
  const label = () => page.locator('#todayLabel').textContent();
  const expect = 'Today · ' + new Date(...today.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v))).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  console.log('1 header date:', await label(), '| matches Arizona today:', (await label()) === expect, '| visible:', await page.locator('#todayLabel').isVisible());
  for (const view of ['People', 'Make a card', 'Upcoming']){
    await page.getByRole('button', { name: view, exact: true }).click(); await page.waitForTimeout(250);
    console.log('   on ' + view + ':', await page.locator('#todayLabel').isVisible());
  }

  // 2. Upcoming: the countdown leads the meta line and Today is a badge
  console.log('2 rows:', await page.evaluate(() => [...document.querySelectorAll('#upcomingList .occ-row')].map(r => {
    const w = r.querySelector('.when');
    return r.querySelector('.name-btn').textContent + ' → ' + (w ? '[' + w.className + '] ' + w.textContent : 'NO WHEN') + ' | ' + r.querySelector('.occ-meta span').textContent;
  })));
  console.log('   weight/first-child:', await page.evaluate(() => { const w = document.querySelector('#upcomingList .when'); const cs = getComputedStyle(w); return { weight: cs.fontWeight, first: w.parentElement.firstElementChild === w }; }));
  await page.screenshot({ path: path.join(OUT, 'countdown-upcoming.png'), clip: { x: 0, y: 0, width: 390, height: 620 } });

  // 3. People: every person counts down, including one 200 days out
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.waitForTimeout(400);
  console.log('3 people:', await page.evaluate(() => [...document.querySelectorAll('.person-row')].map(r => {
    const w = r.querySelector('.when');
    return r.querySelector('.occ-name').textContent + ' → ' + (w ? w.textContent : 'NO WHEN') + ' | ' + r.querySelector('.occ-meta span').textContent;
  })));
  await page.screenshot({ path: path.join(OUT, 'countdown-people.png'), clip: { x: 0, y: 0, width: 390, height: 620 } });

  // 4. the person sheet's dates carry it too
  await page.locator('.person-row', { hasText: 'Far Fred' }).click();
  await page.waitForSelector('#personOverlay:not([hidden])');
  console.log('4 sheet dates:', await page.evaluate(() => [...document.querySelectorAll('#personBody .skip-row')].map(r => r.querySelector('span').textContent + ' → ' + (r.querySelector('.when') || {}).textContent)));
  await page.click('#closePerson');

  // 5. label helpers, including a one-off date in the past
  console.log('5 labels:', await page.evaluate(() => { const w = window.__celebrate.whenLabel; return [w(0), w(1), w(9), w(200), w(-1), w(-3)]; }));
  console.log('   nextAnnual rolls the year:', await page.evaluate(() => { const t = new Date().toISOString().slice(0, 10); const n = window.__celebrate.nextAnnual('01-01'); return n >= t.slice(0, 4) + '-01-01'; }));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
