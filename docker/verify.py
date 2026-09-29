"""Read-only HTTP checks of the actual frontend candidate."""
import re
import sys
from urllib.error import HTTPError
from urllib.request import urlopen


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18083
if PORT not in (18083, 18084):
    raise SystemExit("Unexpected candidate port")

def get(path):
    try:
        response = urlopen(f'http://127.0.0.1:{PORT}' + path, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


status, headers, index = get('/')
assert status == 200 and b'<html' in index
assert 'no-store' in ', '.join(headers.get_all('Cache-Control', []))
for path in ('/index.html', '/migration-spa-deep-link'):
    status, headers, body = get(path)
    assert status == 200 and body == index, path
    assert 'no-store' in ', '.join(headers.get_all('Cache-Control', [])), path
    print('OK SPA and no-store', path)
assets = re.findall(r'(?:src|href)="(/assets/[^"?#]+)', index.decode())
assert assets, 'Missing built assets'
js = b''
for asset in assets:
    status, headers, body = get(asset)
    assert status == 200 and body and 'text/html' not in headers.get('Content-Type', ''), asset
    assert 'immutable' in ', '.join(headers.get_all('Cache-Control', [])), asset
    if asset.endswith('.js'):
        js += body
    print('OK asset', asset)
assert b'/api/atypibrick/v1' in js, 'Expected production API prefix missing'
assert b'http://localhost:8000' not in js, 'Development API URL in production build'
for path in ('/assets/missing.js', '/api/atypibrick/v1/auth/me', '/media/missing.webp'):
    status, _, body = get(path)
    assert status == 404 and body != index, path
    print('OK no SPA fallback', path)
assert get('/atypik-mark.svg')[0] == 200
print('Candidate checks passed; API and media remain served by host Nginx.')
