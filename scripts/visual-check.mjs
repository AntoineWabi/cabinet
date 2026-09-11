import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
await page.screenshot({ path: "artifacts/music-desktop.png" });
console.log(
  await page.evaluate(() => ({
    caption: document.querySelector(".collection-caption")?.innerText,
    body: document.body.scrollWidth,
    viewport: innerWidth,
    tabs: [...document.querySelectorAll("[role=tab]")].map(
      (e) => e.textContent,
    ),
    fronts: [...document.querySelectorAll(".flow-card .media-front")].map(
      (e) => ({
        x: Math.round(e.getBoundingClientRect().x),
        y: Math.round(e.getBoundingClientRect().y),
        w: Math.round(e.getBoundingClientRect().width),
        h: Math.round(e.getBoundingClientRect().height),
      }),
    ),
  })),
);
await page.click("#tab-book");
await new Promise((r) => setTimeout(r, 1100));
await page.screenshot({ path: "artifacts/books-desktop.png" });
await page.click("#tab-movie");
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "artifacts/movies-desktop.png" });
await page.click(".flow-card[aria-current=true], .grid-card");
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "artifacts/detail-desktop.png" });
console.log(
  "dialog",
  await page.$eval("dialog", (e) => ({ open: e.open, text: e.innerText })),
);
console.log("errors", errors);
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 500));
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
await page.screenshot({ path: "artifacts/music-mobile.png" });
await page.click("#tab-book");
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "artifacts/books-mobile.png" });
await page.click("#tab-movie");
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "artifacts/movies-mobile.png" });
await page.click(".flow-card[aria-current=true], .grid-card");
await new Promise((r) => setTimeout(r, 650));
await page.screenshot({ path: "artifacts/detail-mobile.png" });
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 500));
await page.click(".cabinet-brand");
await page.waitForSelector(".settings-dialog");
await page.click(".settings-menu-row");
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "artifacts/add-mobile.png" });
console.log(
  "mobile",
  await page.evaluate(() => ({
    width: innerWidth,
    body: document.body.scrollWidth,
    dialog: document.querySelector("dialog")?.getBoundingClientRect().toJSON(),
  })),
);
await browser.close();
