"""Repair only the inventoried Atypibrick static tree, recording original modes."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import tempfile

ROOT = Path('/var/www/atypibrick_webapp/dist')


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo')
    os.umask(0o077)
    # Reject redirected paths before examining or changing any file.
    for path in (*reversed(ROOT.parents), ROOT):
        if path.is_symlink() or not path.is_dir():
            raise RuntimeError(f'Unexpected path: {path}')
    if not (ROOT / 'index.html').is_file():
        raise RuntimeError('Missing public index')
    print(run('namei', '-l', str(ROOT / 'index.html')))
    paths = [ROOT, *sorted(ROOT.rglob('*'))]
    original = []
    hashes = {}
    for path in paths:
        info = path.lstat()
        if path.is_symlink() or os.path.ismount(path):
            raise RuntimeError(f'Redirected or mounted path: {path}')
        if not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
            raise RuntimeError(f'Unexpected file type: {path}')
        if stat.S_ISREG(info.st_mode) and info.st_nlink != 1:
            raise RuntimeError(f'Hard-linked file: {path}')
        original.append({'path': str(path), 'mode': stat.S_IMODE(info.st_mode),
                         'uid': info.st_uid, 'gid': info.st_gid})
        if path.is_file():
            hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
    backup_root = Path('/var/backups/atypik-migration')
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix='atypibrick-permissions-', dir=backup_root))
    (backup / 'original-modes.json').write_text(json.dumps(original, indent=2))
    (backup / 'content-sha256.json').write_text(json.dumps(hashes, indent=2))
    print(f'Original modes and content hashes: {backup}', flush=True)
    changed = 0
    for path in paths:
        desired = 0o755 if path.is_dir() else 0o644
        if stat.S_IMODE(path.stat().st_mode) != desired:
            path.chmod(desired)
            changed += 1
    for item in original:
        path = Path(item['path'])
        info = path.stat()
        if (info.st_uid, info.st_gid) != (item['uid'], item['gid']):
            raise RuntimeError(f'Owner changed concurrently: {path}')
    for name, expected in hashes.items():
        if hashlib.sha256(Path(name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(f'Content changed concurrently: {name}')
    print(f'Permissions corrected: {changed}; contents and owners unchanged.')
    run('runuser', '-u', 'www-data', '--', 'test', '-r', str(ROOT / 'index.html'))
    for path, expected in (('/', '200'), ('/migration-spa-deep-link', '200'),
                           ('/assets/migration-missing.js', '404'),
                           ('/api/atypibrick/v1/auth/me', '401'),
                           ('/media/migration-missing.webp', '404')):
        code = run('curl', '--noproxy', '*', '--silent', '--show-error',
                   '--max-time', '10', '--resolve', 'app.atypibrick.fr:443:127.0.0.1',
                   '--output', '/dev/null', '--write-out', '%{http_code}',
                   'https://app.atypibrick.fr' + path)
        print(f'Host HTTPS {path}: {code}')
        if code != expected:
            raise RuntimeError(f'Unexpected HTTP status: {code}, expected {expected}')
    code = run('curl', '--silent', '--show-error', '--max-time', '10',
               '--output', '/dev/null', '--write-out', '%{http_code}',
               'https://app.atypibrick.fr/')
    print(f'Public Atypibrick HTTP: {code}')
    if code != '200':
        raise RuntimeError('Public Atypibrick still unavailable')
    print('Static permissions repaired. No Nginx reload or Docker cutover performed.')


if __name__ == '__main__':
    import contextlib
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    fd, name = tempfile.mkstemp(prefix='atypibrick-public-', suffix='.txt',
                                dir='/home/ubuntu')
    result = 0
    with os.fdopen(fd, 'w') as report, contextlib.redirect_stdout(report):
        try:
            main()
        except Exception as exc:
            print(f'STOP: {exc}. Any permission changes already applied remain in place.')
            result = 1
    user = pwd.getpwnam('ubuntu')
    os.chown(name, user.pw_uid, user.pw_gid)
    print(Path(name).read_text())
    print(f'Report: {name}')
    raise SystemExit(result)
