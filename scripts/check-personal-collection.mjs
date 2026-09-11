import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = "http://localhost:3000";
const response = await fetch(base + "/api/items");
assert.equal(
  response.headers.get("X-Cabinet-Preview"),
  "true",
  "Only test the isolated local preview",
);
const original = await fs
  .readFile(".data/preview-collection.json")
  .catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
const items = await response.json();
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage(),
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const close = async () => {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
};
const selected = [];
try {
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: "networkidle0" });
  for (const [type, label] of [
    ["album", "Listened"],
    ["book", "Read"],
    ["movie", "Watched"],
  ]) {
    await page.click("#tab-" + type);
    await pause(500);
    await page.click(".flow-card[aria-current=true]");
    await pause(650);
    const title = await page.$eval("#detail-title", (e) => e.textContent),
      item = items.find((i) => i.type === type && i.title === title);
    selected.push(item);
    for (const selector of [".status-toggle", ".like-toggle"]) {
      if (
        await page.$eval(
          selector,
          (e) => e.getAttribute("aria-pressed") === "true",
        )
      ) {
        await page.click(selector);
        await page.waitForFunction(
          (s) => !document.querySelector(s).disabled,
          {},
          selector,
        );
      }
    }
    await page.click(".like-toggle");
    await page.waitForFunction(
      () => !document.querySelector(".like-toggle").disabled,
    );
    assert.equal(
      await page.$eval(".status-toggle", (e) => e.getAttribute("aria-pressed")),
      "false",
      "Liking must not mark an item completed",
    );
    await page.click(".status-toggle");
    await page.waitForFunction(
      () => !document.querySelector(".status-toggle").disabled,
    );
    assert.equal(
      await page.$eval(".status-toggle", (e) => e.textContent),
      label,
    );
    assert.equal(
      await page.$eval(".like-toggle", (e) => e.getAttribute("aria-pressed")),
      "true",
    );
    const saved = (await (await fetch(base + "/api/items")).json()).find(
      (i) => i.id === item.id,
    );
    assert.equal(saved.metadata.cabinet_completed, true);
    assert.equal(saved.metadata.cabinet_liked, true);
    assert.equal(
      saved.state,
      item.state,
      "Local collection actions must preserve legacy state",
    );
    assert.equal(saved.external_url, item.external_url);
    if (type === "album")
      await page.screenshot({ path: "artifacts/detail-liked-desktop.png" });
    await close();
    console.log("PASS independent and persisted", label, "and Liked");
  }
  await page.reload({ waitUntil: "networkidle0" });
  await page.click(".liked-launch");
  await pause(400);
  for (const item of selected)
    assert(
      await page.$$eval(
        ".liked-dialog .result-copy strong",
        (els, title) => els.some((e) => e.textContent === title),
        item.title,
      ),
    );
  await page.screenshot({ path: "artifacts/liked-desktop.png" });
  await page.type('[aria-label="Search liked items"]', selected[0].title);
  assert.equal(
    await page.$$eval(".liked-dialog .result-row", (els) => els.length),
    1,
  );
  await page.click(".liked-dialog .result-row");
  await page.waitForSelector(".detail-dialog");
  await pause(650);
  assert.equal(
    await page.$eval(".like-toggle", (e) => e.getAttribute("aria-pressed")),
    "true",
  );
  // An unsuccessful write must restore the pressed state and explain the failure.
  await page.setRequestInterception(true);
  const fail = async (req) => {
    if (req.method() === "PATCH")
      await req.respond({ status: 503, body: "Unavailable" });
    else await req.continue();
  };
  page.on("request", fail);
  await page.click(".like-toggle");
  await page.waitForSelector('.detail-text [role="alert"]');
  assert.equal(
    await page.$eval(".like-toggle", (e) => e.getAttribute("aria-pressed")),
    "true",
  );
  page.off("request", fail);
  await page.setRequestInterception(false);
  await page.click(".like-toggle");
  await page.waitForFunction(
    () => !document.querySelector(".like-toggle").disabled,
  );
  assert.equal(
    await page.$eval(".status-toggle", (e) => e.getAttribute("aria-pressed")),
    "true",
    "Unliking must preserve completion",
  );
  await close();
  await page.click(".liked-launch");
  await pause(400);
  assert(
    !(await page.$$eval(
      ".liked-dialog .result-copy strong",
      (els, title) => els.some((e) => e.textContent === title),
      selected[0].title,
    )),
  );
  await close();
  console.log(
    "PASS liked list, search, unlinking, failure rollback and reload",
  );
  await page.click(".cabinet-brand");
  await pause(400);
  await page.click(".layout-option:nth-child(3)");
  await page.select(".settings-sort select", "title");
  await page.click(".settings-apply button");
  const config = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cabinet.display.v1")),
  );
  assert.deepEqual(config.book, { layout: "stack", sort: "title" });
  assert.deepEqual(config.movie, config.book);
  await close();
  await page.reload({ waitUntil: "networkidle0" });
  for (const type of ["book", "movie"]) {
    await page.click("#tab-" + type);
    await pause(500);
    assert.equal(
      await page.$eval(".flow-row", (e) => e.dataset.layout),
      "stack",
    );
    const titles = await page.$$eval(".flow-card", (els) =>
      els.map((e) => e.getAttribute("aria-label").split(" by ")[0]),
    );
    assert.deepEqual(
      titles,
      [...titles].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    );
  }
  console.log("PASS shared layout and sort persist across reload");
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle0" });
  await page.click(".liked-launch");
  await pause(400);
  await page.screenshot({ path: "artifacts/liked-mobile.png" });
  const pickedTitle = await page.$eval(
    ".liked-dialog .result-row strong",
    (e) => e.textContent,
  );
  await page.click(".liked-dialog .result-row");
  await page.waitForSelector(".detail-dialog");
  await pause(700);
  assert.equal(
    await page.$eval("#detail-title", (e) => e.textContent),
    pickedTitle,
  );
  await page.screenshot({ path: "artifacts/detail-liked-mobile.png" });
  await close();
  await page.click(".cabinet-brand");
  await pause(400);
  await page.click(".settings-menu-row:nth-of-type(2)");
  await page.waitForSelector(".manual-form");
  await page.type('input[name="title"]', "Cabinet private entry check");
  await page.type('input[name="creator"]', "Test author");
  await page.type('input[name="year"]', "2026");
  await page.click(".manual-submit");
  await page.waitForFunction(() => !document.querySelector(".add-dialog"));
  assert(
    (await (await fetch(base + "/api/items")).json()).some(
      (i) => i.title === "Cabinet private entry check",
    ),
  );
  for (const body of [{ liked: "yes" }, { completed: 1 }, null])
    assert.equal(
      (
        await fetch(base + "/api/items/" + selected[0].id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      ).status,
      400,
    );
  console.log(
    "PASS manual adding behind settings, mobile activity controls, invalid updates rejected",
  );
  assert.deepEqual(errors, []);
  console.log("PASS no browser errors");
} finally {
  await browser.close();
  if (original) await fs.writeFile(".data/preview-collection.json", original);
  else await fs.rm(".data/preview-collection.json", { force: true });
}
