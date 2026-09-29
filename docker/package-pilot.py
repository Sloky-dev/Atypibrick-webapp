"""Create an allowlisted source bundle without credentials, Git or node_modules."""
import hashlib
import io
from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[1]
output = root.parent / 'migration-artifacts' / 'atypibrick-docker-pilot.tar.gz'
paths = [root / name for name in (
    'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json',
    'Dockerfile', '.dockerignore', 'compose.yaml',
)]
paths.extend(root / 'docker' / name for name in (
    'nginx.conf', 'pilot.sh', 'verify.py', 'package-pilot.py', 'README.md',
))
for directory in ('src', 'public', 'nginx'):
    for path in (root / directory).rglob('*'):
        if path.is_symlink():
            raise RuntimeError(f'Symlink not allowed: {path}')
        if path.is_file():
            if path.name.startswith('.env') or path.suffix in ('.pem', '.key', '.pyc'):
                raise RuntimeError(f'Unexpected file in source bundle: {path}')
            paths.append(path)
payloads = {}
for path in sorted(paths):
    if path.is_symlink():
        raise RuntimeError(f'Symlink not allowed: {path}')
    data = path.read_bytes()
    if path.suffix in ('.sh', '.py'):
        data = data.replace(b'\r\n', b'\n')
    payloads[path.relative_to(root).as_posix()] = data
manifest = ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n'
                   for name, data in payloads.items()).encode()
payloads['SHA256SUMS'] = manifest
output.parent.mkdir(exist_ok=True)
with tarfile.open(output, 'w:gz') as archive:
    for name, data in payloads.items():
        entry = tarfile.TarInfo('atypibrick-docker-pilot/' + name)
        entry.size = len(data)
        entry.mode = 0o644
        archive.addfile(entry, io.BytesIO(data))
print(output)
print('Files:', len(payloads))
print('SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
