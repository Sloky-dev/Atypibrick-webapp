"""Deploy a Git snapshot and preserve the exact previous container for rollback."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import time

PRODUCTION = 'atypibrick-pilot-web-1'
DOCKER = ['docker'] if os.geteuid() == 0 else ['sudo', 'docker']
ROOT = Path(__file__).resolve().parents[1]


def run(*args, capture=False):
    return subprocess.run(args, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def docker(*args, capture=False):
    return run(*DOCKER, *args, capture=capture)


def exists(name):
    return subprocess.run([*DOCKER, 'inspect', name], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0


def inspect(name):
    return json.loads(docker('inspect', name, capture=True))[0]


def healthy(name):
    for _ in range(45):
        state = inspect(name)['State']
        if state.get('Health', {}).get('Status') == 'healthy':
            return
        if state['Status'] in ('exited', 'dead'):
            break
        time.sleep(2)
    raise RuntimeError(f'Container did not become healthy: {name}')


def start(name, image, port, production=False):
    docker('run', '-d', '--name', name, '--read-only',
           '--tmpfs', '/tmp:rw,size=16m,mode=1777', '--cap-drop', 'ALL',
           '--security-opt', 'no-new-privileges:true', '--memory', '128m',
           '--cpus', '0.5', '--pids-limit', '64',
           '--log-driver', 'json-file', '--log-opt', 'max-size=5m',
           '--log-opt', 'max-file=3', '--restart', 'unless-stopped' if production else 'no',
           '--label', 'fr.atypik.application=atypibrick',
           '--publish', f'127.0.0.1:{port}:8080', image)


def check(snapshot, port):
    run(sys.executable, str(snapshot / 'docker/verify.py'), str(port))


def public_check():
    headers = run('curl', '--noproxy', '*', '--fail', '--silent', '--show-error',
                  '--max-time', '15', '--resolve', 'app.atypibrick.fr:443:127.0.0.1',
                  '-I', 'https://app.atypibrick.fr/', capture=True)
    if 'x-atypik-serving: atypibrick-docker' not in headers.lower():
        raise RuntimeError('Host Nginx is not serving the Docker site')


def activate(image_id, snapshot, previous):
    docker('rename', PRODUCTION, previous)
    try:
        docker('stop', '--time', '15', previous)
        start(PRODUCTION, image_id, 18083, production=True)
        healthy(PRODUCTION)
        check(snapshot, 18083)
        public_check()
    except BaseException:
        print('Deployment failed; restoring the previous container.', flush=True)
        if exists(PRODUCTION):
            # Logging errors must not prevent rollback.
            subprocess.run([*DOCKER, 'logs', '--tail', '60', PRODUCTION], check=False)
            docker('rm', '-f', PRODUCTION)
        docker('rename', previous, PRODUCTION)
        docker('start', PRODUCTION)
        healthy(PRODUCTION)
        public_check()
        print('Previous container restored and healthy.', flush=True)
        raise


def main():
    os.chdir(ROOT)
    if os.geteuid() != 0:
        run('sudo', '-v')
    current = inspect(PRODUCTION)
    if current['NetworkSettings']['Ports'].get('8080/tcp') != [
            {'HostIp': '127.0.0.1', 'HostPort': '18083'}]:
        raise RuntimeError('Unexpected production port bindings')
    healthy(PRODUCTION)
    public_check()
    revision = run('git', 'rev-parse', 'HEAD', capture=True).strip()
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + f'-{os.getpid()}'
    image = f'atypik/atypibrick:git-{revision}-{stamp}'
    candidate = f'atypibrick-candidate-{stamp}'
    previous = f'atypibrick-previous-{stamp}'
    print(f'Deploying commit {revision}', flush=True)
    with tempfile.TemporaryDirectory(prefix='atypibrick-release-') as folder:
        snapshot = Path(folder) / 'source'
        snapshot.mkdir()
        archive = Path(folder) / 'source.tar'
        run('git', 'archive', '--format=tar', '-o', str(archive), revision)
        with tarfile.open(archive) as source:
            source.extractall(snapshot, filter='data')
        docker('build', '--pull', '--label', f'org.opencontainers.image.revision={revision}',
               '-t', image, str(snapshot))
        image_id = json.loads(docker('image', 'inspect', image, capture=True))[0]['Id']
        try:
            start(candidate, image_id, 18084)
            healthy(candidate)
            check(snapshot, 18084)
        finally:
            if exists(candidate):
                docker('rm', '-f', candidate)
        activate(image_id, snapshot, previous)
    print(f'Deployed: {revision}\nImage: {image}\nImage ID: {image_id}')
    print(f'Previous container retained (stopped): {previous}')
    print('Manual rollback (brief interruption):')
    print(f'  sudo docker stop {PRODUCTION}')
    print(f'  sudo docker rename {PRODUCTION} atypibrick-replaced-{stamp}')
    print(f'  sudo docker rename {previous} {PRODUCTION}')
    print(f'  sudo docker start {PRODUCTION}')
    print('Then verify container health and https://app.atypibrick.fr/.')


if __name__ == '__main__':
    main()
