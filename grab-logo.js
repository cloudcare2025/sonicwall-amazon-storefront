const puppeteer = require('/opt/homebrew/lib/node_modules/md-to-pdf/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36');

  // Go directly to the SVG URL with cookies from main page
  await page.goto('https://www.sonicwall.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Now fetch the logo SVG with the established cookies
  const response = await page.goto('https://www.sonicwall.com/assets/images/logo.svg', { waitUntil: 'networkidle2', timeout: 15000 });
  const buffer = await response.buffer();
  const content = buffer.toString();

  if (content.includes('<svg') || content.includes('<?xml')) {
    fs.writeFileSync(path.resolve(__dirname, 'logos/sonicwall-logo.svg'), buffer);
    console.log('SVG logo saved. Size:', buffer.length, 'bytes');
  } else {
    console.log('Not an SVG. Content type:', response.headers()['content-type']);
    console.log('First 200 chars:', content.substring(0, 200));
  }

  await browser.close();
})();
