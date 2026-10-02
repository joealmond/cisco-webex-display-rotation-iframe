#!/usr/bin/env python3
"""Build an experimental, static rotated Webex Live Display (Python 3 + curl)."""
import argparse
import base64
import html
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit


def fetch(url):
    # curl also honors the machine's existing proxy/certificate configuration.
    with tempfile.NamedTemporaryFile() as body:
        result = subprocess.run(
            ['curl', '--fail', '--silent', '--show-error', '--location',
             '--connect-timeout', '10', '--max-time', '30',
             '--retry', '2', '--retry-all-errors', '--output', body.name,
             '--write-out', '%{url_effective}', url],
            capture_output=True, text=True, timeout=110,
        )
        if result.returncode:
            raise RuntimeError('Download failed; check connectivity and the display URL.')
        return body.read().decode(), result.stdout


def patch_bundle(source):
    # Upstream expects the event at /<id>. GitHub project pages have a path prefix.
    replacements = {
        'Me.location.pathname.split("/")[1]':
            'new URLSearchParams(window.location.search).get("event")',
        'window.location.pathname.split("/")[1]':
            'new URLSearchParams(window.location.search).get("event")',
        'n.p="/"': 'n.p="https://socio.live/"',
    }
    for old, new in replacements.items():
        if source.count(old) != 1:
            raise ValueError("Upstream app changed; review the bundle patches before rebuilding.")
        source = source.replace(old, new)
    return source


def build(display_url, output):
    shell, final_url = fetch(display_url)
    resolved = urlsplit(final_url)
    if resolved.scheme != 'https' or resolved.hostname != 'socio.live':
        raise ValueError('Expected a Webex Live Display URL resolving to https://socio.live/.')
    event = resolved.path.strip('/')
    if not base64.b64decode(event, validate=True).decode().isdigit():
        raise ValueError('Invalid event ID.')
    token = parse_qs(resolved.query).get('token', [''])[0]
    if not token:
        raise ValueError('The display link has no token.')
    script = re.search(r'<script[^>]+src="(/static/js/main\.[^"]+\.js)"', shell)
    style = re.search(r'href="(/static/css/main\.[^"]+\.css)"', shell)
    if not script or not style:
        raise ValueError('Upstream HTML changed; review the app shell before rebuilding.')
    source, _ = fetch(urljoin('https://socio.live', script[1]))
    bundle = patch_bundle(source)
    app = '''<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Live Display</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/simple-line-icons/2.4.1/css/simple-line-icons.css">
<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.4.1/css/all.css">
<link rel="stylesheet" href="https://socio.live@STYLE@">
<script defer src="app.js"></script></head><body><div id="root"></div></body></html>'''
    query = urlencode({'event': event, 'token': token})
    wrapper = Path(__file__).with_name('index.html').read_text()
    if wrapper.count('@QUERY@') != 1:
        raise ValueError('index.html must contain one @QUERY@ placeholder.')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(bundle)
    (output / 'app.html').write_text(app.replace('@STYLE@', html.escape(style[1], quote=True)))
    (output / 'index.html').write_text(wrapper.replace('@QUERY@', html.escape(query, quote=True)))
    (output / '.nojekyll').touch()
    print(f'PASS: static build written to {output}. Contains the display token; handle like the original display link.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('display_url')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    build(args.display_url, args.output)
