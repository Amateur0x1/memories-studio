const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {resolve} = require('node:path');
const {existsSync, mkdirSync} = require('node:fs');
const {chromium} = require('playwright');
(async () => {
  const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath=process.env.CHROME_PATH || (existsSync(macChrome)?macChrome:undefined);
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    const page=await browser.newPage({acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.TEST_URL || pathToFileURL(resolve('index.html')).href);
    await page.locator('#play:not([disabled])').waitFor();
    assert.equal(await page.locator('#music,#name,#subtitle,#save,#load,#projectFile').count(),0);
    for (const width of [1600,1024,720,390,320]) {
      await page.setViewportSize({width,height:1000});
      await page.waitForFunction(()=>{const a=document.getElementById('stage').getBoundingClientRect(),b=document.getElementById('root').getBoundingClientRect();return Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1;});
      const boxes=await page.evaluate(()=>{
        const a=document.getElementById('stage').getBoundingClientRect(),b=document.getElementById('root').getBoundingClientRect();
        return {stage:[a.width,a.height],root:[b.width,b.height],overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.ok(Math.abs(boxes.stage[0]-boxes.root[0])<1,`width ${width}`);
      assert.ok(Math.abs(boxes.stage[1]-boxes.root[1])<1,`height ${width}`);
      assert.equal(boxes.overflow,false,`horizontal overflow at ${width}`);
    }
    await page.setViewportSize({width:1280,height:1000});
    const fixtures=await page.evaluate(()=>[true,false].map(landscape=>{
      const c=document.createElement('canvas');c.width=landscape?1200:600;c.height=landscape?600:1200;
      const ctx=c.getContext('2d');ctx.fillStyle=landscape?'#ce4234':'#2868ce';ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#fff';ctx.fillRect(c.width*.4,c.height*.4,c.width*.2,c.height*.2);
      return c.toDataURL('image/png').split(',')[1];
    }));
    await page.locator('#batch').setInputFiles(fixtures.map((b,i)=>({name:i?'portrait.png':'landscape.png',mimeType:'image/png',buffer:Buffer.from(b,'base64')})));
    await page.waitForFunction(()=>document.querySelector('.photo-card span').textContent.includes('landscape.png'));
    await page.locator('#seek').fill('2.5');await page.locator('#seek').dispatchEvent('input');
    assert.deepEqual(await page.locator('#left').evaluate(el=>[getComputedStyle(el).objectFit,getComputedStyle(el).objectPosition]),['cover','50% 50%']);
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('自动保存'));
    await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('恢复上次'));
    assert.match(await page.locator('.photo-card span').first().textContent(),/landscape.png/);
    assert.match(await page.locator('.photo-card span').nth(1).textContent(),/portrait.png/);
    await page.locator('#play').click();await page.waitForTimeout(250);await page.locator('#play').click();
    assert.ok(Number(await page.locator('#seek').inputValue())>0);
    await page.locator('#export').click();await page.locator('#cancelExport').click();
    await page.waitForFunction(()=>!document.getElementById('export').disabled);
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('取消'));
    const downloadPromise=page.waitForEvent('download',{timeout:60000});
    await page.locator('#export').click();
    const download=await downloadPromise;
    mkdirSync('test-results',{recursive:true});await download.saveAs(resolve('test-results',download.suggestedFilename()));
    await page.waitForFunction(()=>!document.getElementById('export').disabled);
    assert.match(await page.locator('#status').textContent(),/视频已导出/);
    await page.locator('#seek').fill('3');await page.locator('#seek').dispatchEvent('input');
    await page.screenshot({path:'test-results/studio.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Passed: responsive preview, landscape/portrait crops, persistence, playback, cancellation, full video export.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
