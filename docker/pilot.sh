#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.'; exit 1; }
cd "$(dirname "$(readlink -f "$0")")/.."
umask 077
report=$(mktemp /home/ubuntu/atypibrick-pilot-XXXXXX.txt)
finish() {
    result=$?
    trap - EXIT
    if [[ $result -ne 0 ]]; then
        docker inspect atypibrick-pilot-web-1 --format '{{json .State}}' || true
        docker logs --tail 60 atypibrick-pilot-web-1 || true
    fi
    echo "Exit status: $result"
    echo "Report: $report"
    chown ubuntu:ubuntu "$report"
    exit "$result"
}
trap finish EXIT
exec > >(tee "$report") 2>&1
echo "Atypibrick pilot $(date -u +%FT%TZ)"
sha256sum -c SHA256SUMS
docker info >/dev/null
docker compose version
if ss -H -ltn 'sport = :18083' | grep -q .; then
    echo 'STOP: port 18083 occupied.'; exit 1
fi
[[ -z $(docker ps -aq --filter label=com.docker.compose.project=atypibrick-pilot) ]] || {
    echo 'STOP: pilot project already exists.'; exit 1;
}
export ATYPIBRICK_RELEASE="pilot-$(sha256sum SHA256SUMS | cut -c1-12)"
echo "ATYPIBRICK_RELEASE=$ATYPIBRICK_RELEASE"
docker compose config --quiet
docker compose build --pull
docker compose up -d --no-build --wait --wait-timeout 90
python3 docker/verify.py
docker compose ps
docker image inspect "atypik/atypibrick:$ATYPIBRICK_RELEASE" --format 'Image ID: {{.Id}}'
python3 - <<'PY'
from pathlib import Path
import re
p=Path('/etc/nginx/sites-enabled/app.atypibrick.fr')
print('Host vhost target:', p.resolve())
def normalize(s):
    return re.sub(r'\s+', '', re.sub(r'(?m)#.*$', '', s))
print('Host vhost matches reviewed configuration:', normalize(p.read_text()) == normalize(Path('nginx/app.atypibrick.fr.conf').read_text()))
PY
for path in / /api/atypibrick/v1/auth/me /media/migration-missing.webp; do
    curl --noproxy '*' --silent --show-error --max-time 10 --resolve app.atypibrick.fr:443:127.0.0.1 \
        --output /dev/null --write-out "Host HTTPS $path: %{http_code}\n" "https://app.atypibrick.fr$path"
done
curl --fail --silent --show-error --max-time 10 https://api.atypikbzh.fr/health
echo
nginx -t
echo 'Pilot verified on 127.0.0.1:18083. Public site, API and media configuration unchanged.'
