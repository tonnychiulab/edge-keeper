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
    await new Promise((r) => setTimeout(r, 200));
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

  // Invoke vite directly via node (no npx wrapper, no open stdio pipes that could hang CI)
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: ROOT,
      stdio: 'ignore',
      detached: false
    }
  );

  const consoleErrors = [];
  const pageErrors = [];
  const checks = [];
  let browser;

  try {
    await waitForServer(BASE_URL);

    const executablePath = findChromiumExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const browserVersion = browser.version();

    // --- PHASE 1: Mobile Start Screen & Tap Verification (390x844) ---
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    mobilePage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`);
    });
    mobilePage.on('pageerror', (err) => pageErrors.push(`[mobile] ${err.message}`));

    await mobilePage.goto(`${BASE_URL}#seed=4032026`, { waitUntil: 'networkidle' });
    const mobileStartBox = await mobilePage.locator('#btn-start').boundingBox();
    assert(
      mobileStartBox &&
        mobileStartBox.y >= 0 &&
        mobileStartBox.y + mobileStartBox.height <= 844 &&
        mobileStartBox.width > 80,
      `Mobile #btn-start must be visible and unclipped inside 390x844 viewport (got ${JSON.stringify(mobileStartBox)})`
    );
    await mobilePage.click('#btn-start');
    await mobilePage.waitForSelector('#start-overlay.hidden', { state: 'attached' });
    await mobilePage.waitForTimeout(900);

    const hasMobileOverflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    assert(!hasMobileOverflow, 'Mobile 390x844 must not horizontally overflow');
    await mobilePage.screenshot({ path: path.join(IMAGES_DIR, 'screen-mobile.png'), fullPage: true });
    await mobileCtx.close();
    checks.push('行動端 `390×844` 首屏開局彈窗無裁切、`#btn-start` 可正常點擊開局且無水平捲軸溢位');

    // --- PHASE 2: Desktop Browser Metadata, Active Gameplay, Game Over & Alert Favicon ---
    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      permissions: ['clipboard-read', 'clipboard-write']
    });
    const page = await desktopCtx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`);
    });
    page.on('pageerror', (err) => pageErrors.push(`[desktop] ${err.message}`));

    const response = await page.goto(`${BASE_URL}#seed=4032026`, { waitUntil: 'networkidle' });
    assert(response && response.status() === 200, 'HTTP status must be 200');
    checks.push('HTTP 200 載入 `vite preview` 靜態資源成功');

    const initialFavicon = await page.locator('link[rel="icon"]').getAttribute('href');
    assert(initialFavicon && initialFavicon.startsWith('data:image/svg+xml') && initialFavicon.includes('00ff9d'), 'Initial SVG Favicon must be green 403 shield');

    const idleTitleZh = await page.title();
    const h1TextZh = await page.locator('h1').textContent();
    assert(idleTitleZh.includes('EDGE KEEPER') && h1TextZh?.includes('EDGE KEEPER'), 'Title and H1 must match');

    await page.click('#btn-lang');
    const idleTitleEn = await page.title();
    const h1TextEn = await page.locator('h1').textContent();
    assert(idleTitleEn.includes('403 Defense Arcade') && h1TextEn?.includes('403 Defense'), 'EN locale title/H1 sync');
    await page.click('#btn-lang');
    assert((await page.title()) === idleTitleZh, 'Restored zh-TW title must match initial title');
    checks.push(`雙語切換 \`<title>\` 與 \`<h1>\` 即時同步通過（\`${idleTitleZh}\` ⇄ \`${idleTitleEn}\`）`);

    // Mute toggle check
    await page.click('#btn-mute');
    assert((await page.locator('#btn-mute').textContent())?.includes('關'), 'Mute toggle ON');
    await page.click('#btn-mute');
    assert((await page.locator('#btn-mute').textContent())?.includes('開'), 'Mute toggle OFF');
    checks.push('音效靜音切換按鈕 (`#btn-mute`) 狀態切換正常');

    await page.screenshot({ path: path.join(IMAGES_DIR, 'screen-start.png'), fullPage: true });

    // Start gameplay & play actively
    await page.click('#btn-start');
    await page.waitForSelector('#start-overlay.hidden', { state: 'attached' });

    const canvasBox = await page.locator('#arena').boundingBox();
    assert(canvasBox && canvasBox.width >= 900 && canvasBox.height >= 500, 'Canvas bounding box valid');

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
    const scoreVal = Number.parseInt((await page.locator('#val-score').textContent()) || '0', 10);
    const logCount = await page.locator('#pipeline-logs li').count();

    assert(activeTitle.includes('[SLA'), `Active title must display live SLA: ${activeTitle}`);
    assert(scoreVal > 0 && logCount > 1, `Expected real gameplay score > 0 and logs > 1 (score=${scoreVal}, logs=${logCount})`);
    checks.push(`實機主動操作通過：標題更新 \`${activeTitle}\`、實得積分=${scoreVal}、流水線日誌=${logCount} 筆`);

    await page.screenshot({ path: path.join(IMAGES_DIR, 'screen-gameplay.png'), fullPage: true });

    // Wait naturally for real Game Over to test dynamic red alert Favicon, Game Over i18n, Copy, and Restart
    await page.waitForSelector('#gameover-overlay:not(.hidden)', { timeout: 35000 });
    const gameOverTitleZh = await page.title();
    const alertFavicon = await page.locator('link[rel="icon"]').getAttribute('href');
    assert(gameOverTitleZh.includes('[崩潰]'), `Game Over title must switch to crash state (got ${gameOverTitleZh})`);
    assert(alertFavicon && alertFavicon.includes('ff3366'), 'Favicon must switch to red alert SVG on Game Over');

    await page.click('#btn-lang');
    const gameOverStatTextEn = await page.locator('#gameover-stats').textContent();
    assert(gameOverStatTextEn?.includes('403 Blocked'), 'Game Over stats must re-translate on language switch');
    await page.click('#btn-lang');

    await page.click('#btn-copy');
    await page.click('#btn-restart');
    await page.waitForSelector('#gameover-overlay.hidden', { state: 'attached' });
    checks.push('自然 Game Over 結算流程、紅警動態 SVG Favicon（`#ff3366`）、結算畫面雙語重繪與「再守一波」重開均通過');

    await desktopCtx.close();

    assert(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join('; ')}`);
    assert(pageErrors.length === 0, `Page errors detected: ${pageErrors.join('; ')}`);
    checks.push('全程桌面＋行動視口瀏覽器 `console.error` 數量：`0`；未捕捉 `pageerror` 數量：`0`');

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
    if (browser) {
      await browser.close().catch(() => {});
    }
    server.kill('SIGKILL');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E browser verification FAILED:', err);
    process.exit(1);
  });
