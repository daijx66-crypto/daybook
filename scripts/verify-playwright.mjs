// Generates the README screenshots from the standalone build.
//   npm i -D playwright && npx playwright install chromium
//   npm run shots
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const pageUrl = pathToFileURL(resolve(root, "standalone.html")).href;
const shots = resolve(root, "docs/screenshots");

const browser = await chromium.launch({ headless: true });
try {
  // Hero close-up of the cross-agent threads — crisp 2x, this is the README hero.
  const hero = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const heroPage = await hero.newPage();
  await heroPage.goto(pageUrl, { waitUntil: "networkidle" });
  await heroPage.getByText("今天 agent 之间的交锋").first().waitFor();
  await heroPage.locator(".threads").screenshot({ path: resolve(shots, "threads.png") });
  await hero.close();

  // Full desktop board — 1x to keep the file light (shown in a collapsed gallery).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  await page.getByText("今天 agent 之间的交锋").first().waitFor();
  await page.screenshot({ path: resolve(shots, "desktop-main.png"), fullPage: true });
  await ctx.close();

  // Mobile — full page, 1x.
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mpage = await mctx.newPage();
  await mpage.goto(pageUrl, { waitUntil: "networkidle" });
  await mpage.getByText("daybook").first().waitFor();
  await mpage.screenshot({ path: resolve(shots, "mobile-main.png"), fullPage: true });
  await mctx.close();

  console.log("shots: wrote threads.png (2x), desktop-main.png, mobile-main.png");
} finally {
  await browser.close();
}
