// Service worker: registers, then the shell opens with the network gone.
const { launch, BASE } = require('./_setup');
(async () => {
  const { browser, context, page, errors } = await launch({ serviceWorkers: 'allow', noRoutes: true });
  await page.goto(BASE, { waitUntil: 'load' });
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active }; });
  console.log('1 registered:', reg);
  // second load is controlled by the worker; the shell is now in cache
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  console.log('2 controlled:', await page.evaluate(() => !!navigator.serviceWorker.controller), '| cached shell:', await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map(r => new URL(r.url).pathname); }));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(e => console.log('   reload err:', e.message));
  await page.waitForTimeout(500);
  console.log('3 offline shell:', await page.locator('h1').textContent(), '| upcoming visible:', await page.locator('#viewUpcoming').isVisible(), '| version:', await page.evaluate(() => { document.getElementById('settingsBtn').click(); return document.getElementById('versionLabel').textContent; }));
  await context.setOffline(false);
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
