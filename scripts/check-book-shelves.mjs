import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
const base=process.env.CABINET_TEST_URL||"http://localhost:3000";
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",headless:true,args:["--no-sandbox"]});
const page=await browser.newPage();
const expected={"Want to read":14};
try{await page.setViewport({width:390,height:844});await page.goto(base,{waitUntil:"networkidle0"});await page.click("#tab-book");await page.waitForSelector(".book-shelves");
const shelves=await page.$$eval(".book-shelves button",xs=>Object.fromEntries(xs.map(x=>[x.querySelector("span").textContent,Number(x.querySelector("b").textContent)])));
assert.deepEqual(shelves,{"All books":100,...expected});assert.equal(await page.$$eval(".grid-card",xs=>xs.length),14);
await page.click(".book-shelves button:first-child");await page.waitForFunction(()=>document.querySelectorAll(".grid-card").length===100);
assert.deepEqual(await page.$$eval(".grid-shelf > header",xs=>Object.fromEntries(xs.map(x=>[x.querySelector("h2").textContent,Number(x.querySelector("span").textContent)]))),{"Want to read":14,"Classics ladder":27,"Author paths":51,"One-off picks":1,"Library":7});
assert.equal(await page.evaluate(()=>document.body.scrollWidth-innerWidth),0);console.log("PASS book shelf counts, primary queue, grouping, and mobile overflow");}finally{await browser.close()}
