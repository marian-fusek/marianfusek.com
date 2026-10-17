// Run with Node and Playwright installed. Optional overrides:
// AVOID_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.js
// AVOID_BROWSER_EXECUTABLE=/absolute/path/to/chrome
// AVOID_LAYOUT_SCREENSHOTS=/absolute/output/directory
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.AVOID_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AVOID_BROWSER_EXECUTABLE ? { executablePath: process.env.AVOID_BROWSER_EXECUTABLE } : {})
});
const url = new URL('../index.html', import.meta.url).href;

try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 390, 430, 560, 768, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const box = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      return {
        scrollWidth: document.documentElement.scrollWidth,
        ring: box('.void-stage'), heroCanvas: box('.void-orb-canvas'), copy: box('.hero-copy'),
        bottomRing: box('.final-orb-canvas'), bottomCopy: box('.final-copy'),
        pairs: [...document.querySelectorAll('h2+p')].map(p => {
          const head = p.previousElementSibling.getBoundingClientRect();
          const body = p.getBoundingClientRect();
          return { name: p.parentNode.className, gap: body.top-head.bottom, left: head.left, right: head.right, bodyLeft: body.left };
        })
      };
    });
    assert.equal(layout.scrollWidth, width, `${width}px: page must not overflow horizontally`);
    if (width > 900) {
      assert.ok(layout.heroCanvas.width >= layout.ring.width*1.19, 'Desktop hero ring must gain breathing room without scaling the copy');
      assert.ok(Math.abs(layout.heroCanvas.x+layout.heroCanvas.width/2-width/2)<1, 'Desktop hero ring must stay centered');
      assert.ok(layout.bottomRing.width>=983, 'Desktop bottom ring must gain breathing room');
      assert.equal(layout.copy.width,510,'Desktop text measure must remain unchanged');
    }
    if (width <= 560) {
      for (const [name, ring] of [['hero', layout.ring], ['bottom', layout.bottomRing]]) {
        assert.ok(ring.width >= Math.max(width*1.5, 540)-1, `${width}px: ${name} ring must surround the copy`);
        assert.ok(Math.abs(ring.width-ring.height)<1, `${width}px: ${name} ring must remain circular`);
        assert.ok(Math.abs(ring.x+ring.width/2-width/2)<1, `${width}px: ${name} ring must be centered`);
      }
      for (const copy of [layout.copy, layout.bottomCopy]) {
        assert.ok(copy.x>=19 && copy.right<=width-19, `${width}px: copy must retain its content gutters`);
        assert.ok(Math.abs(copy.x-(width-copy.right))<1, `${width}px: copy must have equal left/right gutters`);
      }
      for (const pair of layout.pairs) {
        assert.ok(pair.gap>=22, `${width}px: missing headline/perex spacing in ${pair.name}`);
        assert.ok(pair.left>=19 && pair.right<=width-19, `${width}px: headline outside its gutters`);
        assert.ok(Math.abs(pair.left-pair.bodyLeft)<1, `${width}px: headline/perex left edges differ`);
      }
    }
    // Exercise both scroll directions and load lazy media before inspecting.
    await page.evaluate(async () => {
      for (const y of [0, 120, 300, 600, 900, document.body.scrollHeight, 900, 600, 300, 120, 0]) {
        scrollTo(0,y);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      }
    });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width, `${width}px: scrolling introduced overflow`);
    if (process.env.AVOID_LAYOUT_SCREENSHOTS && (width===390 || width===1440)) {
      const dir = process.env.AVOID_LAYOUT_SCREENSHOTS;
      await page.screenshot({ path:`${dir}/avoid-${width}-hero.png` });
      await page.locator('.watch-heading').screenshot({ path:`${dir}/avoid-${width}-headings.png` });
      await page.locator('.final-cta').screenshot({ path:`${dir}/avoid-${width}-bottom.png` });
    }
    console.log(`PASS ${width}px: centered rings, bounded page and ${width<=560?'spaced/aligned mobile copy':'preserved larger-screen layout'}`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(url);
  await page.evaluate(async()=>{
    for(const y of [0,80,240,700,100,0,document.body.scrollHeight,0]) {
      scrollTo(0,y);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
  });
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'Animated scroll must not widen the page');
  await page.reload();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'Fresh reload must not widen the page');
  console.log('PASS animated forward/reverse scroll and reload');

  const fallback = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await fallback.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};
  });
  await fallback.goto(url);
  const fallbackLayout=await fallback.evaluate(()=>{
    const el=document.querySelector('.final-cta');const s=getComputedStyle(el,'::after');
    return {active:el.classList.contains('void-orb-fallback'),width:parseFloat(s.width),height:parseFloat(s.height),scrollWidth:document.documentElement.scrollWidth};
  });
  assert.equal(fallbackLayout.active,true);
  assert.ok(Math.abs(fallbackLayout.width-fallbackLayout.height)<1,'Fallback ring must remain circular');
  assert.equal(fallbackLayout.scrollWidth,390,'Fallback ring must not widen the page');
  console.log('PASS WebGL-unavailable fallback');
} finally {
  await browser.close();
}
