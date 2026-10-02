# Webex Events Live Display: rotation and HTML5 options

**Research date: 2 October 2026.** This concerns **Webex Events (formerly Socio) Live Display**, not Webex Meetings. Live Display is an event-signage product; Webex Meetings’ separate APIs and compliance “Events API” do not provide a Live Display rotation or signage feed. Cisco documents Live Display as a shareable URL opened directly in a browser attached to the display and put into full-screen mode. [Live Display device setup](https://help.webex.com/article/hdqwg5)

## Why the current wrapper fails

The existing GitHub Pages page fails because Live Display currently sends a Content Security Policy that permits framing only by its own origin and `*.socio.events`. A page hosted on GitHub Pages cannot relax that rule with HTML, JavaScript, CSS, a URL parameter, or another response header. Browsers enforce `frame-ancestors` before the framed page runs. [CSP Level 3](https://www.w3.org/TR/CSP3/#directive-frame-ancestors)

This is specifically an iframe limitation. It does **not** mean the shareable link itself is broken: it can still be opened as the top-level page. Cisco’s public Live Display setup documentation lists feature selection, content timing, Gallery images, colours, ticker, announcements, publishing, and the shareable link. It does not document a 90-degree rotation, portrait-output switch, custom CSS, custom domain, or customer-managed frame allowlist. [Live Display setup](https://help.webex.com/article/f14wix)

Cisco also markets Live Display as responsive to “every screen.” That makes one test essential before replacing anything: load the direct share URL on the actual venue player. A player that exposes a genuine portrait browser viewport may produce an acceptable responsive layout. That is different from the stated harder case, where the panel is physically portrait but the player sends a landscape browser canvas sideways. Responsive layout cannot rotate those pixels. [Live Display overview](https://socio.events/features/live-display-software)

## Direct technical checks

The supplied short link still works: a GET request followed its redirect and returned HTTP 200. The final Live Display response and the public root currently send:

```http
Content-Security-Policy: frame-ancestors 'self' https://*.socio.events
X-Frame-Options: DENY
```

Chrome reproduced the exact `frame-ancestors` block in the GitHub Pages wrapper. No rollout date or release note explaining the policy change was established. In modern Chrome, the CSP framing rule takes precedence over `X-Frame-Options`; vendor allowlisting must account for every parent frame if the venue player also embeds the supplied URL. [CSP specification](https://www.w3.org/TR/CSP/#directive-frame-ancestors)

The currently served [public app JavaScript](https://socio.live/static/js/main.c06e9a05.js) reads the display token from the URL and calls `live-display.api.socio.events`, with Firebase listeners for live updates. It exposes internal request routes for sessions, posts, announcements and leaderboards. This is implementation evidence, not the official GraphQL API contract. Targeted inspection found no obvious whole-page rotation parameter; that is not proof that none exists.

A read-only OPTIONS preflight on the existing event’s Live Display configuration endpoint returned HTTP 200 for both `https://socio.live` and `https://joealmond.github.io`. It allowed origin `*` and the requested app header names (`Live-Display-Token`, `Event-Id`, `Content-Type`, `Preview`, `component_id`). No token or event content was sent/read in that check. This makes a minimal HTML/assets proxy a plausible experiment; it does not establish that authenticated requests or Firebase updates will work from our page.

## Capability map

| Need | Cisco-documented capability | Important limit |
|---|---|---|
| Full live event rotation | Direct Live Display: Wall/social, Agenda, networking, Game, Gallery, Promote App, ticker and announcements | No public output-rotation setting. [Introduction](https://help.webex.com/article/6eer45) |
| Static/prepared signage | Gallery image upload | Cisco’s 16:9 dimensions guide is for Gallery assets; it does not prove all Live Display layouts are landscape-only. [Image guide](https://help.webex.com/en-us/article/smu6mk/Webex-Events-Platform-Image-Dimensions-Quick-Reference) |
| Supported embedded agenda/sponsors | Event App widgets for Agenda, Speakers, Sponsors, Exhibitors and Custom List | Widgets are selected content, not the Live Display stream; newly created items are not automatically added. [Widget guide](https://help.webex.com/article/qfheh0) |
| Custom “now/next” page | Webex Events GraphQL API | API access is automatic only for qualifying Webex Suite Enterprise Agreement customers; others need their Webex Events contact/support. Keys are admin-created and must stay server-side. [Events API](https://help.webex.com/article/9hyxu3) |
| Full Live Display replica | No documented customer API/feed | The public API list only establishes limited Live Display status reads, not its Wall, Game, networking, announcement, Gallery, or realtime stream. [Events API](https://help.webex.com/article/9hyxu3) |

The Events API is useful for a deliberately designed, portrait-first page that reads schedule, location, speakers, sponsors, exhibitors, or Event App components. It is not evidence that a custom page can reproduce the current live engagement display. Exact query fields, limits, and any realtime mechanism are available only in the organization’s API dashboard after access is granted. [Events API](https://help.webex.com/article/9hyxu3)

## Ranked routes for the venue’s one-URL constraint

| Priority | Route | Best when | Status and decision gate |
|---:|---|---|---|
| 1 | Direct share URL on target player | The player has a real portrait viewport and Live Display responds acceptably | **Test first.** It is Cisco’s supported deployment and may need no new system. |
| 2 | Ask Cisco for a portrait/signage or approved embedding option | The full live display must remain intact | **Unknown.** No public self-service option was found; a support answer is required. |
| 3 | Official Agenda widget in an owned HTML5 page | Agenda, speaker, sponsor, or exhibitor information is enough | **Supported partial substitute.** The outer page can be designed and rotated for the actual player, without framing Live Display. |
| 4 | Server-backed custom page using authorized Events API | A composed now/next schedule or branded selected content is needed | **Supported integration conditional on entitlement.** Poll only approved data and keep the key off the screen/browser. |
| 5 | Private owned-origin replay proof | Full vendor UI is required and Cisco supplies no option | **Experimental.** Serve the initial app HTML/assets from a controlled origin and rotate the page. Current technical observation shows permissive CORS preflight for the app’s internal API endpoint, so direct API calls may survive. It is not a documented contract and needs a browser proof for all requests, token renewal, and Firebase/live updates. |
| 6 | Server-side renderer to rotated image feed or video | The experimental replay fails but the complete vendor UI is still required | **Technically feasible architecture, not a Cisco product feature.** A server opens Live Display top-level, rotates captured pixels, and supplies one HTML5 URL. Image refresh is simpler; video/HLS retains motion but needs codec, autoplay, bandwidth, and recovery tests. |
| 7 | Gallery-only, counter-rotated artwork | Static or manually updated messaging is acceptable | **Documented content feature; operational workaround.** Prepare landscape Gallery images whose visual design is rotated to compensate for this panel/player mapping. Dynamic feature pages remain sideways. |

An owned-origin replay is different from a generic public proxy. It should be a short, private engineering spike, using a non-production event if possible. It must confirm every asset, redirect, API request, service-worker/cache behavior, and live update over an extended run. The public app bundle reveals implementation routes and Firebase usage, but those are undocumented internals, so they can change without notice. Do not treat a successful OPTIONS/CORS preflight as proof that authenticated requests or live updates will work.

For a renderer, the venue still receives one normal HTML5 URL. The server, rather than the venue browser, opens the vendor page top-level, so no prohibited iframe is involved. The trade-off is operations: secure the view link, run and monitor the rendering browser, provide a fallback image, and verify the actual signage player can display the chosen image/video format. A captured feed will not perfectly reproduce Live Display’s own offline behavior or interactive timing. Cisco says Live Display displays a disabled message if it loses connectivity. [Offline behavior](https://help.webex.com/article/cmoomfb)

## Questions ready for Cisco support

> We use Webex Events Live Display on a venue-owned signage player. The venue can remotely load one HTTPS URL but we cannot change its browser, OS, panel, or output rotation. Its landscape browser pixels appear sideways on a portrait panel. Our previous rotating wrapper now fails because the Live Display response permits only `self` and `*.socio.events` as `frame-ancestors`. Does Live Display have a supported true-portrait output, 90-degree rotation, signage-player integration, or organization-level approved embedding option? Your product page says content is optimized for every screen; does that cover a portrait browser viewport? If none applies, please confirm the supported deployment assumptions so we can select a widget/API or rendered-pixels fallback.

Also establish: whether the player has a portrait viewport; its browser version, image/video codecs, autoplay and caching behavior; whether it can be tested for several hours; required content (full Live Display versus agenda/sponsors/static messages); and the organization’s Events API entitlement.

## Validation plan

1. **PASS:** The direct share URL responds; the old iframe is blocked by the observed `frame-ancestors` policy. **NOT RUN:** direct URL on the venue player.
2. Load the direct URL on that player, photograph the result, and record logical viewport dimensions. This separates a responsive-layout opportunity from an immutable sideways-pixel problem.
3. If content scope is narrow, create a test Agenda widget page and verify logged-out access, rotation, long-run refresh, and recovery on the real player.
4. If full Live Display is necessary, obtain Cisco’s answer, then run a private owned-origin replay spike. Mark it **PASS** only after a long-run test covers live changes and reconnects. If it fails, choose the server-rendered image/video path after confirming player support.
5. Keep a counter-rotated Gallery/static page as the event-day fallback. Test it on the same physical panel; the 16:9 Gallery recommendation does not remove the need for that test.

**Overall status: MEDIUM confidence.** The framing cause and documented product/API boundaries are verified. Actual portrait behavior, Cisco account-specific capabilities, the venue player, and any experimental replay/rendering path remain unverified.
