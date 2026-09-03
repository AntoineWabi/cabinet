import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--headless=new'] });
const pg = await b.newPage();
await pg.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
for (const [name, idx] of [['music', 1], ['books', 2], ['movies', 3]]) {
  await pg.goto('http://localhost:3939/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  if (idx > 1) await pg.click(`.hub-typenav button:nth-child(${idx})`);
  await new Promise(r => setTimeout(r, 2000));
  await pg.screenshot({ path: `/tmp/dt-${name}.png` });
}
await b.close();
console.log('done');
