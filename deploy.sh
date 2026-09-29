#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

APP_DIR="${APP_DIR:-/var/www/atypibrick_webapp}"

cd "$APP_DIR"
exec 9>"$(git rev-parse --git-dir)/atypibrick-deploy.lock"
flock -n 9 || { echo 'Another Atypibrick deployment is running.'; exit 1; }
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
    echo 'STOP: preserve local tracked changes before deployment.'; exit 1
fi
git pull --ff-only
python3 docker/deploy.py
