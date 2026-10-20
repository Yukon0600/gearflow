const { chromium } = require('@playwright/test');

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:5000/';
const OUT = process.env.SHOT_OUT || 'artifacts';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));

  const shot = async (name) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('saved', name);
  };

  console.log('open', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shot('h5-01-login');

  const inputs = page.locator('.uni-input-input');
  await inputs.nth(0).fill('admin');
  await inputs.nth(1).fill('GearFlow@2026');
  await page.locator('uni-button', { hasText: '登录' }).first().click();
  await page.waitForTimeout(4000);
  await shot('h5-02-index');

  const tab = async (text, file) => {
    const item = page.locator('.uni-tabbar__item', { hasText: text }).first();
    if (await item.count()) {
      await item.click();
      await page.waitForTimeout(2000);
      await shot(file);
      return true;
    }
    console.log('tab not found:', text);
    return false;
  };

  await tab('库存', 'h5-03-stock');
  const firstItem = page.locator('.item').first();
  if (await firstItem.count()) {
    await firstItem.click();
    await page.waitForTimeout(2500);
    await shot('h5-04-detail');
    await page.goBack();
    await page.waitForTimeout(1500);
  } else {
    console.log('商品卡片未找到');
  }

  await tab('流水', 'h5-05-flow');
  await tab('我的', 'h5-06-mine');

  await browser.close();
  console.log('done');
})();
