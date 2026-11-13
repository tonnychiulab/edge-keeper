import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'docs', 'images');
const REPORT_PATH = path.join(ROOT, 'docs', 'e2e-browser-report.md');
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }
  const cachedChrome = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
  if (fs.existsSync(cachedChrome)) {
    return cachedChrome;
  }
  return undefined;
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview server did not become ready at ${url}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const consoleErrors = [];
  const pageErrors = [];
  const checks = [];

  try {
    await waitForServer(BASE_URL);

    const executablePath = findChromiumExecutable();
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const browserVersion = browser.version();

    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      const response = await page.goto(`${BASE_URL}#seed=4032026`, { waitUntil: 'networkidle' });
      assert(response && response.status() === 200, 'HTTP status must be 200');
      checks.push('HTTP 200 載入 `vite preview` 靜態資源成功');

      // 1. Browser Favicon & Title verification
      const faviconHref = await page.locator('link[rel="icon"]').getAttribute('href');
      assert(faviconHref && faviconHref.startsWith('data:image/svg+xml'), 'Favicon must be SVG Data URI');
      checks.push('SVG Data URI Favicon (`<link rel="icon">`) 宣告正確且可解析');

      const idleTitleZh = await page.title();
      const h1TextZh = await page.locator('h1').textContent();
      assert(idleTitleZh.includes('EDGE KEEPER') && h1TextZh?.includes('EDGE KEEPER'), 'Title and H1 must match');

      // Test i18n title sync before starting
      await page.click('#btn-lang');
      const idleTitleEn = await page.title();
      const h1TextEn = await page.locator('h1').textContent();
      assert(idleTitleEn.includes('403 Defense Arcade') && h1TextEn?.includes('403 Defense'), 'EN locale title/H1 sync');
      await page.click('#btn-lang');
      const restoredTitleZh = await page.title();
      assert(restoredTitleZh === idleTitleZh, 'Restored zh-TW title must match initial title');
      checks.push(`雙語切換 \`<title>\` 與 \`<h1>\` 即時同步通過（\`${idleTitleZh}\` ⇄ \`${idleTitleEn}\`）`);

      // Screenshot 1: Start screen
      await page.screenshot({ path: path.join(IMAGES_DIR, 'screen-start.png'), fullPage: true });

      // 2. Start game and perform real arcade interactions
      await page.click('#btn-start');
      await page.waitForSelector('#start-overlay.hidden', { state: 'attached' });

      const canvasBox = await page.locator('#arena').boundingBox();
      assert(canvasBox && canvasBox.width >= 900 && canvasBox.height >= 500, 'Canvas bounding box valid');

      // Sweep clicks across WAF corridor over ~4.2 seconds to intercept spawned packets
      for (let step = 0; step < 18; step++) {
        await page.waitForTimeout(230);
        const relX = 0.12 + (step % 5) * 0.1;
        const relY = 0.2 + ((step * 2) % 5) * 0.15;
        await page.mouse.click(canvasBox.x + canvasBox.width * relX, canvasBox.y + canvasBox.height * relY);
        if (step === 6) await page.keyboard.press('Space');
        if (step === 10) await page.keyboard.press('1');
        if (step === 12) await page.keyboard.press('2');
        if (step === 14) await page.keyboard.press('3');
        if (step === 16) await page.keyboard.press('KeyE');
      }

      const activeTitle = await page.title();
      const scoreText = await page.locator('#val-score').textContent();
      const logCount = await page.locator('#pipeline-logs li').count();
      const scoreVal = Number.parseInt(scoreText || '0', 10);

      assert(activeTitle.includes('[SLA'), `Active title must display live SLA: ${activeTitle}`);
      assert(scoreVal > 0 || logCount > 1, `Expected live gameplay progress (score=${scoreVal}, logs=${logCount})`);
      checks.push(`實機遊玩標題動態更新（\`${activeTitle}\`）、積分=${scoreVal}、流水線日誌筆數=${logCount}`);

      // Screenshot 2: Gameplay action
      await page.screenshot({ path: path.join(IMAGES_DIR, 'screen-gameplay.png'), fullPage: true });

      // 3. Mobile viewport check (390x844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert(!hasOverflow, 'Mobile 390x844 must not horizontally overflow');
      checks.push('行動裝置視口 `390×844` 無水平捲軸溢位（響應式排版通過）');

      await page.screenshot({ path: path.join(IMAGES_DIR, 'screen-mobile.png'), fullPage: true });

      assert(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join('; ')}`);
      assert(pageErrors.length === 0, `Page errors detected: ${pageErrors.join('; ')}`);
      checks.push('瀏覽器 `console.error` 數量：`0`；未捕捉 `pageerror` 數量：`0`');

      const report = [
        '# EDGE KEEPER 無頭瀏覽器實機驗收報告 (E2E Browser Report)',
        '',
        `- **測試時間**：${new Date().toISOString()}`,
        `- **瀏覽器核心**：Headless Chromium \`${browserVersion}\`（via \`playwright-core\`）`,
        `- **測試位址**：\`${BASE_URL}#seed=4032026\`（\`vite preview\` 正式建置產物）`,
        `- **Console Errors**：\`0\``,
        `- **Page Errors**：\`0\``,
        '',
        '## 驗收項目與實測結果',
        '',
        ...checks.map((line) => `- [x] ${line}`),
        '',
        '## 實機截圖產出',
        '',
        '- 開局防線說明：`docs/images/screen-start.png`',
        '- 桌面端激戰畫面：`docs/images/screen-gameplay.png`',
        '- 行動端響應畫面：`docs/images/screen-mobile.png`',
        ''
      ].join('\n');

      fs.writeFileSync(REPORT_PATH, report, 'utf8');
      console.log('E2E browser verification PASSED!');
      console.log(report);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('E2E browser verification FAILED:', err);
  process.exit(1);
});
