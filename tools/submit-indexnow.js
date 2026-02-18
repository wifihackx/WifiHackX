import https from 'node:https';

const key = 'eea375aa8b9b4216956057441615b80a';
const host = 'wifihackx.com';
const keyLocation = `https://${host}/indexnow-key-${key}.txt`;
const urls = [
  `https://${host}/`,
  `https://${host}/scanner.html`,
  `https://${host}/ip-hunter.html`,
  `https://${host}/about.html`,
  `https://${host}/faq.html`,
  `https://${host}/privacidad.html`,
  `https://${host}/terminos.html`
];

const payload = JSON.stringify({ host, key, keyLocation, urlList: urls });

const req = https.request(
  {
    hostname: 'api.indexnow.org',
    path: '/IndexNow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  res => {
    console.log('IndexNow status:', res.statusCode);
    res.on('data', chunk => process.stdout.write(chunk.toString()));
  }
);

req.on('error', err => console.error('IndexNow error:', err));
req.write(payload);
req.end();
