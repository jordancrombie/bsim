const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || process.env.FRONTEND_PORT || 3000;
const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN || 'localhost';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../certs/banksim.ca.key')),
  cert: fs.readFileSync(path.join(__dirname, '../certs/banksim.ca.crt')),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`🔒 BSIM Frontend running with HTTPS`);
    console.log(`   Local:   https://localhost:${port}`);
    console.log(`   Network: https://${domain}:${port}`);
  });
});
