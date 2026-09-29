"""Switch only reviewed frontend locations, keeping API, media and TLS on host."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

DOMAIN = 'app.atypibrick.fr'
IMAGE = 'sha256:632666e1c231658ff22869624f50605eee150929b90af9405b4c3294b8345c21'


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def normalize(text):
    return re.sub(r'\s+', '', re.sub(r'(?m)#.*$', '', text))


def transform(text):
    for location in ('/assets/', '= /index.html', '/'):
        pattern = r'location\s+' + re.escape(location).replace(r'\ ', r'\s+') + r'\s*\{[^{}]*\}'
        replacement = '''location %s {
        proxy_pass http://127.0.0.1:18083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_intercept_errors off;
    }''' % location
        text, count = re.subn(pattern, replacement, text)
        if count != 1:
            raise RuntimeError(f'Unexpected location: {location}')
    marker = '    add_header X-Atypik-Serving atypibrick-docker always;\n'
    text, count = re.subn(r'(?m)^(\s*add_header X-Content-Type-Options)', marker + r'\1', text, count=1)
    if count != 1:
        raise RuntimeError('Missing security header anchor')
    return text


def fetch(path, folder, candidate=False):
    output = folder / 'body'
    headers = folder / 'headers'
    base = 'http://127.0.0.1:18083' if candidate else 'https://' + DOMAIN
    resolve = [] if candidate else ['--resolve', DOMAIN + ':443:127.0.0.1']
    code = run('curl', '--noproxy', '*', '--silent', '--show-error', '--max-time', '10',
               *resolve, '-D', str(headers), '-o', str(output), '-w', '%{http_code}', base + path)
    return code, output.read_bytes(), headers.read_text().lower()


def main():
    os.umask(0o077)
    source = Path(__file__).parent
    target = Path('/etc/nginx/sites-enabled/' + DOMAIN).resolve(strict=True)
    if target != Path('/etc/nginx/sites-available/' + DOMAIN):
        raise RuntimeError('Unexpected vhost target')
    original = target.read_text()
    if normalize(original) != normalize((source / 'expected-vhost.conf').read_text()):
        raise RuntimeError('Host configuration changed; no mutation')
    # Ensure future publications cannot reinstall the old static vhost.
    deploy_root = Path('/var/www/atypibrick_webapp')
    for name in ('deploy.sh', 'docker/deploy.py', 'docker/verify.py'):
        if (deploy_root / name).read_bytes().replace(b'\r\n', b'\n') != (source / 'release' / name).read_bytes():
            raise RuntimeError('Commit/push and git pull the new deployment files first: ' + name)
    state = json.loads(run('docker', 'inspect', 'atypibrick-pilot-web-1'))[0]
    if state['Image'] != IMAGE or state['State']['Health']['Status'] != 'healthy':
        raise RuntimeError('Candidate image/health changed')
    if state['NetworkSettings']['Ports']['8080/tcp'] != [{'HostIp': '127.0.0.1', 'HostPort': '18083'}]:
        raise RuntimeError('Candidate port differs')
    run('nginx', '-t')
    folder = Path(tempfile.mkdtemp(prefix='atypibrick-cutover-', dir='/var/backups/atypik-migration'))
    print(f'Private backup: {folder}', flush=True)
    backup = folder / 'vhost.original'
    shutil.copy2(target, backup)
    checks = ['/', '/index.html', '/migration-spa-deep-link', '/atypik-mark.svg']
    code, index, _ = fetch('/', folder, True)
    checks += re.findall(r'(?:src|href)="(/assets/[^"?#]+)', index.decode())
    fingerprints = {}
    for path in checks:
        a, candidate, _ = fetch(path, folder, True)
        b, public, _ = fetch(path, folder)
        if a != '200' or b != '200' or candidate != public:
            raise RuntimeError('Content mismatch before cutover: ' + path)
        fingerprints[path] = hashlib.sha256(candidate).hexdigest()
    statuses = {'/assets/migration-missing.js': '404',
                '/api/atypibrick/v1/auth/me': '401', '/media/migration-missing.webp': '404'}
    for path, code in statuses.items():
        if fetch(path, folder)[0] != code:
            raise RuntimeError('Preflight HTTP mismatch: ' + path)
    updated = transform(original)
    (folder / 'vhost.candidate').write_text(updated)
    try:
        target.write_text(updated)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        for _ in range(30):
            if 'x-atypik-serving: atypibrick-docker' in fetch('/', folder)[2]:
                break
            time.sleep(1)
        else:
            raise RuntimeError('New Nginx workers not ready')
        for path, digest in fingerprints.items():
            code, body, headers = fetch(path, folder)
            if code != '200' or hashlib.sha256(body).hexdigest() != digest:
                raise RuntimeError('Postcheck content mismatch: ' + path)
            if 'x-atypik-serving: atypibrick-docker' not in headers:
                raise RuntimeError('Frontend path not routed to Docker: ' + path)
            if path.startswith('/assets/') and 'immutable' not in headers:
                raise RuntimeError('Asset cache header missing')
            if path in ('/', '/index.html', '/migration-spa-deep-link') and 'no-store' not in headers:
                raise RuntimeError('Index cache header missing')
            if 'x-content-type-options: nosniff' not in headers:
                raise RuntimeError('Security header missing')
        for path, code in statuses.items():
            if fetch(path, folder)[0] != code:
                raise RuntimeError('Postcheck HTTP mismatch: ' + path)
        redirect = run('curl', '--noproxy', '*', '--silent', '--show-error', '--max-time', '10',
                       '--resolve', DOMAIN + ':80:127.0.0.1', '-o', '/dev/null',
                       '-w', '%{http_code} %{redirect_url}', 'http://' + DOMAIN + '/index.html')
        if redirect != '301 https://' + DOMAIN + '/index.html':
            raise RuntimeError('HTTPS redirect changed')
    except Exception:
        shutil.copy2(backup, target)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        if fetch('/', folder)[0] != '200':
            raise RuntimeError('Rollback restored configuration but HTTP check failed')
        print('Original vhost restored; HTTPS 200 verified.')
        raise
    print('Atypibrick frontend now served by Docker. API/media locations preserved.')
    print('Pages/assets, cache, security header, SPA, API 401, media 404 and HTTPS redirect verified.')
    print('Authenticated workflows and actual media display still require browser validation.')
    print(f'Rollback: sudo cp --preserve=mode,ownership {backup} {target}')
    print('Then: sudo nginx -t && sudo systemctl reload nginx')


if __name__ == '__main__':
    import pwd
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    fd, report = tempfile.mkstemp(prefix='atypibrick-cutover-', suffix='.txt', dir='/home/ubuntu')
    status = 0
    with os.fdopen(fd, 'w') as output, contextlib.redirect_stdout(output):
        try:
            main()
        except Exception as exc:
            print(f'STOP: {exc}')
            status = 1
    user = pwd.getpwnam('ubuntu')
    os.chown(report, user.pw_uid, user.pw_gid)
    print(Path(report).read_text())
    print(f'Report: {report}')
    raise SystemExit(status)
