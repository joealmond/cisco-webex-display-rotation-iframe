import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createPocServer } from './poc.mjs';

test('owned-origin display, fixed upstream, rotation, and safe failures', async (t) => {
  const realFetch = globalThis.fetch;
  const signedPath = '/fixture-event?token=fixture';
  let shareRequests = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = String(input);
    let response;
    if (url === 'https://go.socio.events/20e0y') {
      shareRequests++;
      response = new Response('<html><head></head><body><div id="root"></div></body></html>', {
        headers: { 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" },
      });
      Object.defineProperty(response, 'url', { value: 'https://socio.live' + signedPath });
    } else {
      assert.equal(new URL(url).origin, 'https://socio.live');
      assert.equal(options.redirect, 'error');
      response = new Response('fixture asset', { headers: { 'Content-Type': 'text/javascript' } });
    }
    return response;
  });
  const server = createPocServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => realFetch(origin + path, options);

  const root = await request('/');
  const wrapper = await root.text();
  assert.equal(root.status, 200);
  assert.match(wrapper, /width:100vh;height:100vw/);
  assert.match(wrapper, /rotate\(90deg\)/);
  assert.ok(wrapper.includes(signedPath));
  assert.ok(!wrapper.includes('src="https://socio.live'));

  const display = await request(signedPath);
  assert.equal(display.status, 200);
  assert.equal(display.headers.get('x-frame-options'), null);
  assert.equal(display.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.equal(display.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await display.text(), /window.top.document/);
  assert.equal(shareRequests, 1);

  assert.match(await (await request('/?rotation=270')).text(), /rotate\(270deg\)/);
  assert.match(await (await request('/?rotation=0')).text(), /width:100vw;height:100vh/);
  assert.equal((await request('/?rotation=45')).status, 400);
  assert.equal((await request('/fixture-event?token=wrong')).status, 404);
  assert.equal((await request('/proxy?url=https://example.com')).status, 404);
  assert.equal((await request('/', { method: 'POST' })).status, 405);
  assert.equal((await request('/', { method: 'HEAD' })).status, 200);
  const asset = await request('/static/js/main.js');
  assert.equal(await asset.text(), 'fixture asset');
  assert.equal(asset.headers.get('content-type'), 'text/javascript');
  assert.throws(() => createPocServer('https://example.com/'), /HTTPS Webex/);
  assert.throws(() => createPocServer('https://socio.live:8080/'), /HTTPS Webex/);

  t.mock.method(globalThis, 'fetch', async () => { throw new Error('secret upstream URL'); });
  const failed = await request('/static/js/uncached.js');
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes('secret'));
});
