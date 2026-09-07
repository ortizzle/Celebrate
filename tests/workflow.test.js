const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => indexedDB.deleteDatabase('celebrate'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);

  // tab order
  const order = await page.evaluate(() => [...document.querySelectorAll('.tab')].map(t => t.textContent));
  console.log('tab order:', order);

  // occasion is expanded (default draft never picked a chip) -> pick one, should collapse + jump to Layout
  console.log('occasion grid visible before pick:', await page.locator('#panelOccasion .chip-grid').isVisible());
  await page.getByRole('button', { name: 'Wedding' }).click();
  await page.waitForTimeout(200);
  console.log('active tab after pick:', await page.locator('.tab[aria-selected="true"]').textContent());
  await page.getByRole('tab', { name: 'Occasion' }).click();
  console.log('occasion collapsed view:', await page.locator('.occ-current b').textContent(), '| grid gone:', await page.locator('#panelOccasion .chip-grid').count());
  await page.getByRole('button', { name: 'Change' }).click();
  console.log('grid back after Change:', await page.locator('#panelOccasion .chip-grid').isVisible());
  await page.locator('#panelOccasion .chip', { hasText: 'Happy birthday,' }).click();
  await page.waitForTimeout(200);
  console.log('active tab after re-pick:', await page.locator('.tab[aria-selected="true"]').textContent());

  // sticky scope: only the card pins, actions/selbar scroll away
  await page.getByRole('tab', { name: 'Colors' }).click();
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({ cardTop: document.getElementById('cardCanvas').getBoundingClientRect().top, actionsTop: document.querySelector('.stage-actions').getBoundingClientRect().top }));
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ cardTop: document.getElementById('cardCanvas').getBoundingClientRect().top, actionsTop: document.querySelector('.stage-actions').getBoundingClientRect().top, scrollY: window.scrollY }));
  console.log('before scroll:', before, '| after scroll:', after);

  // Upcoming -> Make card lands on Layout
  await page.getByRole('button', { name: 'Upcoming' }).click();
  const near = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10); });
  await page.locator('#addOcc summary').click();
  await page.fill('#manName', 'Grandma June');
  await page.uncheck('#manYearly');
  await page.fill('#manDate', near);
  await page.click('#manAddBtn');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Make card' }).first().click();
  await page.waitForTimeout(300);
  console.log('active tab from Upcoming:', await page.locator('.tab[aria-selected="true"]').textContent());
  console.log('occasion pre-collapsed from Upcoming flow:', await page.locator('#panelOccasion .occ-current').count() >= 0 ? 'n/a until Occasion tab opened' : '');
  await page.getByRole('tab', { name: 'Occasion' }).click();
  console.log('occasion collapsed after Upcoming flow:', await page.locator('.occ-current').isVisible());

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
