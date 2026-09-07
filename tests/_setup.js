// Shared harness for the Playwright suites. Run everything with tests/run.sh.
// - Serves nothing itself: point CELEBRATE_URL at a static server (run.sh starts one on :8765).
// - Vendor scripts (html2canvas, gif.js) come from tests/vendor/ when present, else from cdnjs.
// - Google sign-in and web fonts are cut off so runs are deterministic and fast.
// - Service workers are blocked so page.route() sees every request; sw.test.js opts back in.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const VENDOR = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.CELEBRATE_URL || 'http://localhost:8765/';

async function routeVendor(page){
  for (const [pat, file] of [['**/html2canvas.min.js', 'html2canvas.min.js'], ['**/gif.js', 'gif.js'], ['**/gif.worker.js', 'gif.worker.js']]){
    const f = path.join(VENDOR, file);
    if (fs.existsSync(f)) await page.route(pat, r => r.fulfill({ path: f, contentType: 'application/javascript' }));
  }
  await page.route('https://accounts.google.com/**', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
}

async function launch(opts = {}){
  const browser = await chromium.launch();
  const context = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true }, opts));
  const page = await context.newPage();
  if (!opts.noRoutes) await routeVendor(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return { browser, context, page, errors };
}

// Arizona "today" plus n days, as YYYY-MM-DD — the same rule the app uses.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date());
const add = (n) => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };

module.exports = { launch, routeVendor, BASE, OUT, today, add };
