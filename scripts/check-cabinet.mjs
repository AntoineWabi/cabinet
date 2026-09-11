import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.CABINET_TEST_URL || "http://localhost:3000";
const dataFile = ".data/preview-collection.json";
let before;
try {
  before = await fs.readFile(dataFile);
} catch {}
const checks = [];
const check = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function waitGallery() {
  await page.waitForSelector(".flow-card[aria-current=true], .grid-card");
  await pause(250);
}
async function closeDialog() {
  if (await page.$(".add-dialog")) {
    await page.keyboard.press("Escape");
    await page.waitForSelector(".settings-dialog");
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
}
async function openAddDialog() {
  await page.click(".cabinet-brand");
  await page.waitForSelector(".settings-dialog");
  await page.click(".settings-menu-row");
  await page.waitForSelector(".add-dialog");
}
async function bounds(selector) {
  return page.$eval(selector, (el) => el.getBoundingClientRect().toJSON());
}
async function selectType(type) {
  await page.click(`#tab-${type}`);
  await waitGallery();
}
try {
  const initial = await fetch(`${base}/api/items`);
  assert.equal(
    initial.headers.get("X-Cabinet-Preview"),
    "true",
    "Run tests only against the isolated local preview.",
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: "networkidle0" });
  await waitGallery();
  assert.equal(
    await page.$$eval(".collection-nav [role=tab]", (els) => els.length),
    3,
  );
  assert.equal(
    await page.$$eval(
      ".seg,.mobile-viewbar,.hub-top-right",
      (els) => els.length,
    ),
    0,
  );
  check("Exactly three media tabs and one collection workflow");
  const centers = [];
  for (const type of ["album", "book", "movie"]) {
    await selectType(type);
    const rect = await bounds(".flow-card[aria-current=true] .media-front");
    assert.ok(
      rect.height > 280 && rect.height < 420,
      `${type} has a substantial responsive size`,
    );
    centers.push(rect.y + rect.height / 2);
    await page.click(".flow-card[aria-current=true]");
    await page.waitForSelector("dialog[open]");
    const flight = await page.$eval(".detail-art", (el) => {
      const animation = el.getAnimations()[0];
      return animation
        ? {
            duration: animation.effect.getTiming().duration,
            keyframes: animation.effect.getKeyframes().length,
          }
        : null;
    });
    assert.ok(
      flight?.duration >= 400 && flight.keyframes === 2,
      "Shared element animates from the selected cover",
    );
    await pause(600);
    assert.ok(await page.$eval("#detail-title", (el) => !!el.textContent));
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => !!document.activeElement.closest("dialog")),
      "Dialog traps keyboard focus",
    );
    await closeDialog();
    const returned = await bounds(".flow-card[aria-current=true] .media-front");
    assert.ok(
      Math.abs(returned.x - rect.x) < 2 && Math.abs(returned.y - rect.y) < 2,
      "Cover returns to its exact shelf position",
    );
  }
  assert.ok(Math.max(...centers) - Math.min(...centers) < 12);
  check(
    "All three optical centers align; tap, shared open/close, focus trap and return geometry work",
  );
  await selectType("album");
  const titleBefore = await page.$eval(
    ".collection-caption h1",
    (el) => el.textContent,
  );
  await page.focus(".flow-card[aria-current=true]");
  await page.keyboard.press("ArrowRight");
  await pause(650);
  assert.notEqual(
    await page.$eval(".collection-caption h1", (el) => el.textContent),
    titleBefore,
  );
  await page.focus(".flow-card[aria-current=true]");
  await page.keyboard.press("ArrowLeft");
  await pause(650);
  await page.keyboard.press("Enter");
  await page.waitForSelector("#detail-title");
  assert.equal(
    await page.$eval("#detail-title", (el) => el.textContent),
    titleBefore,
  );
  await closeDialog();
  const carousel = await bounds(".flow-row");
  await page.mouse.move(
    carousel.x + carousel.width * 0.6,
    carousel.y + carousel.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    carousel.x + carousel.width * 0.6 - 190,
    carousel.y + carousel.height * 0.5,
    { steps: 15 },
  );
  await page.mouse.up();
  await pause(650);
  assert.notEqual(
    await page.$eval(".collection-caption h1", (el) => el.textContent),
    titleBefore,
  );
  assert.equal(await page.$("dialog[open]"), null);
  check(
    "Keyboard selection and drag browse without accidentally opening details",
  );
  await page.click(".search-launch");
  await page.waitForSelector('input[aria-label="Search your collection"]');
  await page.type('input[aria-label="Search your collection"]', "On Color");
  await page.waitForSelector(".saved-results .result-row");
  await page.click(".saved-results .result-row");
  await page.waitForSelector("#detail-title");
  assert.equal(
    await page.$eval("#detail-title", (el) => el.textContent),
    "On Color",
  );
  assert.equal(
    await page.$eval("#tab-book", (el) => el.getAttribute("aria-selected")),
    "true",
  );
  await pause(650);
  await closeDialog();
  check(
    "Global saved search changes media tabs and opens the exact matching item",
  );
  await selectType("album");
  const originalCount = Number(
    await page.$eval("#tab-album b", (el) => el.textContent),
  );
  await page.click(".flow-card[aria-current=true]");
  await pause(600);
  const removedTitle = await page.$eval(
    "#detail-title",
    (el) => el.textContent,
  );
  await page.click(".remove-button");
  await page.waitForFunction(() =>
    document.querySelector(".cabinet-toast")?.textContent.includes("Removed"),
  );
  assert.equal(
    Number(await page.$eval("#tab-album b", (el) => el.textContent)),
    originalCount - 1,
  );
  await page.click(".cabinet-toast button");
  await page.waitForFunction(() =>
    document.querySelector(".cabinet-toast")?.textContent.includes("Back in"),
  );
  assert.equal(
    Number(await page.$eval("#tab-album b", (el) => el.textContent)),
    originalCount,
  );
  await page.reload({ waitUntil: "networkidle0" });
  const persisted = await (await fetch(`${base}/api/items`)).json();
  assert.ok(
    persisted.some(
      (x) => x.title === removedTitle && !x.metadata?.cabinet_archived,
    ),
  );
  check("Remove and Undo persist to the isolated collection store");
  await openAddDialog();
  await page.waitForSelector(
    'input[aria-label="Search catalog or paste a link"]',
  );
  await page.type(
    'input[aria-label="Search catalog or paste a link"]',
    "Radiohead",
  );
  await page.click(".find-button");
  await page.waitForSelector(".catalog-results .result-row", {
    timeout: 20000,
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/items") &&
      response.request().method() === "POST",
  );
  await page.click(".catalog-results .result-row:not(:disabled)");
  const added = await (await responsePromise).json();
  assert.ok(added.metadata.track_count > 0);
  assert.ok(added.metadata.catalog_id);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  assert.equal(
    await page.$eval(".collection-caption h1", (el) => el.textContent),
    added.title,
  );
  check("Catalog add works and retains album metadata");
  await page.click(".flow-card[aria-current=true]");
  await page.waitForSelector(".detail-tracks li", { timeout: 25000 });
  assert.ok((await page.$$eval(".detail-tracks li", (els) => els.length)) > 0);
  await closeDialog();
  check("Saved album detail loads its real track list");
  await openAddDialog();
  await page.type(
    'input[aria-label="Search catalog or paste a link"]',
    added.external_url,
  );
  await page.click(".find-button");
  await page.waitForSelector(".catalog-results .result-row", {
    timeout: 20000,
  });
  assert.ok(await page.$(".catalog-results .result-row:disabled"));
  await closeDialog();
  check("Pasted album links resolve and existing items are marked Added");
  await selectType("movie");
  await openAddDialog();
  await page.type(
    'input[aria-label="Search catalog or paste a link"]',
    "Matrix",
  );
  await page.click(".find-button");
  await page.waitForSelector(".catalog-results .result-row", {
    timeout: 20000,
  });
  const filmRows = await page.$$eval(".catalog-results .result-row", (rows) =>
    rows.map((r) => ({
      label: r.getAttribute("aria-label"),
      type: r.querySelector(".result-art").className,
    })),
  );
  assert.ok(filmRows.some((row) => row.label === "Add The Matrix"));
  assert.ok(filmRows.every((row) => row.type.includes("result-movie")));
  await page.screenshot({ path: "artifacts/add-desktop.png" });
  await closeDialog();
  check("Movie catalog returns films and correct artwork");
  await page.setRequestInterception(true);
  const failLookup = (request) => {
    if (request.url().includes("/api/lookup?"))
      request.respond({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "The catalog is temporarily unavailable. Please try again.",
        }),
      });
    else request.continue();
  };
  page.on("request", failLookup);
  await openAddDialog();
  await page.type(
    'input[aria-label="Search catalog or paste a link"]',
    "Failure check",
  );
  await page.click(".find-button");
  await page.waitForSelector(".form-error");
  assert.ok(
    await page.$eval(".form-error", (e) =>
      e.textContent.includes("temporarily unavailable"),
    ),
  );
  await closeDialog();
  page.off("request", failLookup);
  await page.setRequestInterception(false);
  check("Catalog failures give a recoverable error");
  const layouts = [];
  for (const viewport of [
    { width: 390, height: 844, isMobile: true, hasTouch: true },
    { width: 320, height: 568, isMobile: true, hasTouch: true },
    { width: 844, height: 390 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewport(viewport);
    await page.goto(base, { waitUntil: "networkidle0" });
    await waitGallery();
    for (const type of ["album", "book", "movie"]) {
      await selectType(type);
      if (viewport.width <= 720) {
        assert.equal(await page.$(".flow-row"), null, "Mobile does not mount the 3D carousel");
        const cards = await page.$$(".grid-card");
        const first = await cards[0].boundingBox();
        const second = await cards[1].boundingBox();
        assert.equal(first.y, second.y, "Two cards share each grid row");
        assert.ok(second.x > first.x + first.width, "Cards have a clear gutter");
        const card = cards[Math.min(6, cards.length - 1)];
        await card.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        const title = await card.$eval(".grid-copy strong", (el) => el.textContent);
        const before = await card.boundingBox();
        const scroll = await page.$eval(".collection-grid-scroll", (el) => el.scrollTop);
        await card.click();
        await page.waitForSelector("#detail-title");
        assert.equal(await page.$eval("#detail-title", (el) => el.textContent), title);
        await pause(600);
        await closeDialog();
        const after = await card.boundingBox();
        assert.ok(Math.abs(before.y - after.y) < 1, "Details return to the same grid card");
        assert.equal(await page.$eval(".collection-grid-scroll", (el) => el.scrollTop), scroll);
        assert.ok(await card.evaluate((el) => document.activeElement === el), "Focus returns to the selected card");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
        await page.$eval(".collection-grid-scroll", (el) => { el.scrollTop = 0; });
        await page.screenshot({ path: `artifacts/${type}-${viewport.width}.png` });
        continue;
      }
      const state = await page.evaluate(() => {
        const r = document
          .querySelector(".flow-card[aria-current=true] .media-front")
          .getBoundingClientRect();
        const c = document
          .querySelector(".collection-caption")
          .getBoundingClientRect();
        return {
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          front: { x: r.x, y: r.y, w: r.width, h: r.height },
          captionTop: c.top,
        };
      });
      assert.equal(
        state.scroll,
        state.width,
        `No horizontal page overflow at ${viewport.width}`,
      );
      assert.ok(
        Math.abs(state.front.x + state.front.w / 2 - viewport.width / 2) < 8,
        "Active cover stays centered",
      );
      assert.ok(
        state.front.y + state.front.h < state.captionTop,
        "Art does not overlap caption",
      );
      if (viewport.width === 390 || viewport.width === 320)
        await page.screenshot({
          path: `artifacts/${type}-${viewport.width}.png`,
        });
    }
    const gallerySelector = viewport.width <= 720 ? ".collection-grid-scroll" : ".collection-stage";
    const galleryBefore = await bounds(gallerySelector);
    await openAddDialog();
    await pause(400);
    const modal = await bounds("dialog");
    const galleryAfter = await bounds(gallerySelector);
    assert.ok(modal.width <= viewport.width);
    assert.ok(
      modal.top >= -1 && modal.bottom <= viewport.height + 1,
      "Add fits viewport",
    );
    assert.ok(
      Math.abs(galleryAfter.height - galleryBefore.height) < 1,
      "Opening add from settings never compresses the collection",
    );
    await page.screenshot({ path: `artifacts/add-${viewport.width}.png` });
    await closeDialog();
    layouts.push(`${viewport.width}×${viewport.height}`);
  }
  check(
    `No clipping, overlap or add-induced layout shifts at ${layouts.join(", ")}`,
  );
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(base, { waitUntil: "networkidle0" });
  await waitGallery();
  const scrollBefore = await page.$eval(".collection-grid-scroll", (el) => el.scrollTop);
  const client = await page.createCDPSession();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 680 }],
  });
  for (let y = 660; y >= 350; y -= 15) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 195, y }],
    });
    await pause(15);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await pause(700);
  const scrolled = await page.$eval(".collection-grid-scroll", (el) => el.scrollTop);
  assert.ok(scrolled > scrollBefore + 100, "Touch scroll reveals more grid rows");
  assert.equal(await page.$("dialog[open]"), null, "Scrolling does not open details");
  await selectType("book");
  await selectType("album");
  assert.equal(await page.$eval(".collection-grid-scroll", (el) => el.scrollTop), scrolled);
  check("Native vertical scrolling and per-tab grid scroll positions work");
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.click(".grid-card");
  await pause(80);
  await closeDialog();
  check("Reduced-motion detail opening and dismissal work");
  assert.deepEqual(errors, []);
  check("No browser runtime errors");
  await fs.writeFile(
    "artifacts/check-results.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  console.log(`\n${checks.length} interaction groups passed.`);
} finally {
  await browser.close();
  if (before) await fs.writeFile(dataFile, before);
  else await fs.rm(dataFile, { force: true });
}
