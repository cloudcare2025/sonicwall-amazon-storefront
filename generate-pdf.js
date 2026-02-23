const puppeteer = require('/opt/homebrew/lib/node_modules/md-to-pdf/node_modules/puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const filePath = path.resolve(__dirname, 'SonicWall_Amazon_Partnership_Proposal.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.pdf({
    path: path.resolve(__dirname, 'SonicWall_Amazon_Partnership_Proposal.pdf'),
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true
  });

  await browser.close();
  console.log('PDF generated successfully.');
})();
