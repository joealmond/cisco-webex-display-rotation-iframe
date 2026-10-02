import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const upstreamOrigin = 'https://socio.live';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const fullscreen = `<script>document.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    const page = window.top.document;
    if (page.fullscreenElement) page.exitFullscreen();
    else page.documentElement.requestFullscreen();
  }
});</script>`;

function wrapper(displayPath, rotation) {
  const swapped = rotation === 90 || rotation === 270;
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer"><title>Rotated Webex — PoC</title>
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0e2951}
    iframe{position:fixed;left:50%;top:50%;border:0;
      width:${swapped ? '100vh' : '100vw'};height:${swapped ? '100vw' : '100vh'};
      transform:translate(-50%,-50%) rotate(${rotation}deg);transform-origin:center}
  </style></head><body>
  <iframe title="Webex Live Display" src="${escapeHtml(displayPath)}" allowfullscreen></iframe>
  ${fullscreen}</body></html>`;
}

export function createPocServer(shareUrl = 'https://go.socio.events/20e0y') {
  const source = new URL(shareUrl);
  if (source.protocol !== 'https:' || source.username || source.password ||
      !['https://go.socio.events', upstreamOrigin].includes(source.origin)) {
    throw new Error('LIVE_DISPLAY_URL must be an HTTPS Webex Live Display link.');
  }

  let entry;
  const assets = new Map();
  // ponytail: cache this event and its assets until restart; refresh on a schedule for long deployments.
  async function getEntry() {
    if (!entry) {
      entry = (async () => {
        const response = await fetch(source, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error('Live Display could not be loaded.');
        const url = new URL(response.url);
        if (url.origin !== upstreamOrigin || url.pathname === '/' || !url.searchParams.has('token')) {
          throw new Error('Share link did not resolve to a signed Live Display.');
        }
        let html = await response.text();
        if (!html.includes('</head>')) throw new Error('Unexpected Live Display HTML.');
        html = html.replace('</head>', `<meta name="referrer" content="no-referrer">${fullscreen}</head>`);
        return { url, html };
      })().catch((error) => { entry = undefined; throw error; });
    }
    return entry;
  }

  return createServer(async (request, response) => {
    // Emit only selected headers, never upstream X-Frame-Options/CSP/cookies.
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let body;
      let contentType = 'text/html; charset=utf-8';
      if (url.pathname === '/') {
        const rotation = Number(url.searchParams.get('rotation') ?? '90');
        if (![0, 90, 180, 270].includes(rotation)) {
          response.writeHead(400).end('rotation must be 0, 90, 180 or 270.');
          return;
        }
        const display = await getEntry();
        body = wrapper(display.url.pathname + display.url.search, rotation);
      } else if (url.pathname.startsWith('/static/') ||
                 ['/favicon.ico', '/manifest.json', '/logo192.png', '/logo512.png'].includes(url.pathname)) {
        if (!assets.has(url.pathname)) {
          const upstream = await fetch(new URL(url.pathname, upstreamOrigin), {
            signal: AbortSignal.timeout(20_000), redirect: 'error',
          });
          if (!upstream.ok) {
            response.writeHead(upstream.status).end('Webex asset unavailable.');
            return;
          }
          assets.set(url.pathname, {
            body: Buffer.from(await upstream.arrayBuffer()),
            contentType: upstream.headers.get('content-type') || 'application/octet-stream',
          });
        }
        ({ body, contentType } = assets.get(url.pathname));
      } else {
        const display = await getEntry();
        if (url.pathname !== display.url.pathname || url.search !== display.url.search) {
          response.writeHead(404).end('Not found.');
          return;
        }
        body = display.html;
      }
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error(`Webex request failed (${error.name}).`); // Never log signed URLs.
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Webex could not be loaded. Retry or check LIVE_DISPLAY_URL.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  createPocServer(process.env.LIVE_DISPLAY_URL).listen(port, '127.0.0.1', () => {
    console.log(`Webex rotation PoC: http://127.0.0.1:${port}/`);
  });
}
