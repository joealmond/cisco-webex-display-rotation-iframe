# Cisco Live Display iFrame rotation

## GitHub Pages

The static version is deployed at
https://joealmond.github.io/cisco-webex-display-rotation-iframe/.
It loads a locally hosted copy of the Webex app and rotates it clockwise 90°.
Use `?rotation=270` for the other direction. No server is required at the venue.

GitHub Actions builds and deploys on pushes to `main`, or through the manual
**Deploy rotated Live Display** workflow. It resolves the existing share link,
adapts the upstream app for this repository's URL path, and publishes only the
generated `_site` directory. The display token is included in the public site
as required by Webex, but is not committed to the repository. `index.html` is
the build template; preview the generated output, not the repository root.

This is an unsupported workaround and depends on Webex's current API/CORS
behavior. The build fails if the expected upstream bundle structure changes,
leaving the last successful deployment in place.

See [static build instructions](STATIC-ROTATION.md). The proxy below is an
alternative local experiment, not the GitHub Pages deployment.

## Local proxy proof of concept

Requires Node.js 22 or newer; no dependencies.

```sh
node poc.mjs
```

Open http://127.0.0.1:8787/. It uses the existing Webex share link by default.
Use `?rotation=270` for the other direction, or `?rotation=0` to compare without rotation.
Press Enter for fullscreen.

To use another display:

```sh
LIVE_DISPLAY_URL='https://go.socio.events/YOUR_LINK' PORT=8787 node poc.mjs
```

The server resolves the share link, serves Webex's HTML/static assets locally,
and embeds that local page in a rotated frame with swapped viewport dimensions.
Webex API/Firebase connections remain direct. The server forwards neither
Webex's framing headers nor its cookies. It accepts only Webex share links,
serves a fixed upstream, and binds to this computer's loopback interface.

This is an experimental local preview. The signed view token remains visible
to the local browser, as in the original display. HTML/assets are cached until
restart. A venue URL needs a hosted server; GitHub Pages alone cannot run this.
Updates after organizer publishing, reconnect behavior, and the actual player
require verification.

### Verification — 2 October 2026

- **PASS:** actual Techtorial display loads from this local origin in Chrome.
- **PASS:** 90° rotation fills a 1920×1080 viewport; 270° also fits.
- **PASS:** authenticated Webex API requests return 200; page navigation and
  automatic feature cycling work.
- **PASS:** Firebase connects and subscription responses match the original
  display (including one `permission_denied` also present on the original).
- **PASS:** local integration check covers header replacement, fixed upstream,
  rotation, invalid routes/methods, caching and safe upstream error responses.
- **NOT RUN:** organizer-published changes, extended operation/network recovery,
  public hosting and the actual venue player.

Chrome refused Google Tag Manager and Bugsnag telemetry connections during
testing; event content still loaded. No browser security settings were changed.

Run the local integration check:

```sh
node --test poc.test.mjs
```

[Capability and workaround research](docs/research/webex-live-display-rotation.md)
