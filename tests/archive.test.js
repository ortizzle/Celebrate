const { launch, BASE, OUT } = require('./_setup');
const path = require('path');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await launch();
  await page.addInitScript(() => { indexedDB.deleteDatabase('celebrate'); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // sticky card while scrolling the editor
  await page.getByRole('button', { name: 'Make a card' }).click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.getElementById('cardCanvas').getBoundingClientRect().top);
  await page.getByRole('tab', { name: 'Stickers' }).click();
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => document.getElementById('cardCanvas').getBoundingClientRect().top);
  const scrollY = await page.evaluate(() => window.scrollY);
  console.log('card top before/after scroll:', before, after, '| page scrolled:', scrollY, 'px');

  // download -> auto-archived to Sent
  await page.mouse.wheel(0, -700);
  await page.getByRole('button', { name: 'Share card' }).click();
  await page.waitForSelector('#exportOverlay:not([hidden])', { timeout: 120000 });
  await page.click('#exportDownloadBtn');
  await page.click('#closeExport');
  for (let i = 0; i < 40; i++){ await page.waitForTimeout(1000); if (await page.evaluate(async () => (await window.__celebrate.DB.all()).some(d => d.sent))) break; }
  const sentCount = await page.evaluate(async () => (await window.__celebrate.DB.all()).filter(d => d.sent).length);
  console.log('sent entries after download:', sentCount);

  // Drafts overlay: Sent tab shows it, Open a copy works, Delete works
  await page.click('#draftsBtn');
  await page.waitForSelector('#draftsOverlay:not([hidden])');
  console.log('mine tab count (should be 0):', await page.locator('.draft-card').count());
  await page.click('#draftsTabSent');
  await page.waitForTimeout(200);
  console.log('sent tab cards:', await page.locator('.draft-card').count());
  console.log('sent card buttons:', await page.locator('.draft-card').first().locator('button').allTextContents());
  await page.locator('.draft-card').first().getByRole('button', { name: 'Open a copy' }).click();
  await page.waitForTimeout(300);
  console.log('opened copy state:', await page.evaluate(() => { const s = window.__celebrate.state(); return { id: s.id, sent: !!s.sent, title: s.title }; }));

  await page.click('#draftsBtn');
  await page.click('#draftsTabSent');
  await page.waitForTimeout(200);
  await page.locator('.draft-card').first().getByRole('button', { name: 'Delete' }).click();
  await page.waitForSelector('#confirmOverlay:not([hidden])');
  await page.click('#confirmOk');
  await page.waitForTimeout(200);
  console.log('sent cards after delete:', await page.locator('.draft-card').count());

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
