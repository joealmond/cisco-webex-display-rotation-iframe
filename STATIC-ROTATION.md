# Static rotation experiment

Webex's hosted page rejects third-party frames. This experiment hosts its app
shell and JavaScript locally, using the existing display token and Webex's API.
The API currently permits cross-origin requests. No browser security settings
or response security headers are disabled.

Build with Python 3 and curl:

```sh
python3 build-static-rotation.py https://go.socio.events/20e0y --output /tmp/rotated-display
```

`index.html` is the wrapper template. The GitHub Pages workflow builds `_site`
and deploys it on every push to `main`; it can also be run manually to refresh
the app files and display token. Generated files are not committed.

Publish the generated directory as a static site. All four files must stay
together: `index.html`, `app.html`, `app.js`, and `.nojekyll`. Nested paths work,
including GitHub project Pages. The generated HTML contains the same access
token as the original display link; do not commit generated output by accident.

The default is clockwise 90 degrees. Use `?rotation=270` on the wrapper URL for
the opposite direction. Enter requests fullscreen on the wrapper. Do not use
the app's own Full Screen control, which can take the inner app out of rotation.

The build adapts two event-ID reads for a nested hosting path, and changes the
asset base to Socio. It refuses to build if those expected upstream snippets
change. Rebuild and test again when Webex updates the app or display token.

Verified locally in signed-in Chrome: live schedule data, automatic page
cycling, map rendering, and a 90-degree frame covering a 1920×1080 viewport.
PASS on GitHub Pages (2 October 2026): build/deployment, live schedule data,
same-origin app loading, and full-viewport 90°/270° rotation; no console errors
captured in the default view. The original Pages URL is preserved.
NOT RUN: physical signage player and extended operation/reconnect testing.
This is an unsupported experiment; Webex API/CORS changes can break it.
