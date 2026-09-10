#!/usr/bin/env bash
set -Eeuo pipefail

readonly MIN_NODE_20_MINOR=19
readonly APP_DIR="${APP_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"

log() {
  printf '\n\033[1;33m[Atypibrick]\033[0m %s\n' "$1"
}

fail() {
  printf '\n\033[1;31m[Erreur]\033[0m %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

on_error() {
  printf '\n\033[1;31m[Erreur]\033[0m Déploiement interrompu à la ligne %s.\n' "$1" >&2
}
trap 'on_error "$LINENO"' ERR

[[ -d "$APP_DIR" ]] || fail "Dossier introuvable : $APP_DIR"
[[ -f "$APP_DIR/package.json" ]] || fail "package.json est absent de $APP_DIR"
[[ -w "$APP_DIR" ]] || fail "Le dossier n'est pas modifiable par $(id -un). Lancez : sudo chown -R $(id -un):www-data '$APP_DIR'"
[[ ! -e "$APP_DIR/node_modules" || -w "$APP_DIR/node_modules" ]] || fail "node_modules n'est pas modifiable. Lancez : sudo chown -R $(id -un):www-data '$APP_DIR/node_modules'"
[[ ! -e "$APP_DIR/dist" || -w "$APP_DIR/dist" ]] || fail "dist n'est pas modifiable. Lancez : sudo chown -R $(id -un):www-data '$APP_DIR/dist'"

command_exists git || fail "Git n'est pas installé (sudo apt install git)."
command_exists node || fail "Node.js n'est pas installé. Installez Node.js 22 LTS."
command_exists npm || fail "npm n'est pas installé. Installez Node.js 22 LTS avec npm."

node_version="$(node --version | sed 's/^v//')"
node_major="${node_version%%.*}"
node_rest="${node_version#*.}"
node_minor="${node_rest%%.*}"

if (( node_major < 20 )) || (( node_major == 20 && node_minor < MIN_NODE_20_MINOR )) || (( node_major == 21 )); then
  fail "Node.js $node_version est incompatible avec Vite 8. Utilisez Node.js 20.19+ ou 22.12+."
fi

cd "$APP_DIR"
log "Environnement validé — Node.js $node_version, npm $(npm --version)"

if [[ "${DEPLOY_PULL:-1}" == "1" ]]; then
  if [[ -d .git ]]; then
    log "Récupération des changements Git"
    git pull --ff-only
  else
    log "Aucun dépôt Git local : étape git pull ignorée"
  fi
fi

if [[ ! -f .env.production ]]; then
  log "Création de .env.production avec l'URL API par défaut"
  printf '%s\n' 'VITE_API_URL=/api/atypibrick/v1' > .env.production
fi

log "Vérification des dépendances"
if [[ ! -d node_modules ]] || ! npm ls --depth=0 >/dev/null 2>&1; then
  if [[ -f package-lock.json ]]; then
    log "Dépendances absentes ou incomplètes : installation propre avec npm ci"
    npm ci
  else
    log "Aucun package-lock.json : installation avec npm install"
    npm install
  fi
fi

npm ls --depth=0 >/dev/null || fail "Certaines dépendances npm sont absentes ou invalides."

log "Contrôle TypeScript et build de production"
npm run build

[[ -f dist/index.html ]] || fail "Le build est incomplet : dist/index.html est absent."
[[ -d dist/assets ]] || fail "Le build est incomplet : dist/assets est absent."

if command_exists nginx && command_exists systemctl; then
  command_exists sudo || fail "sudo est requis pour recharger Nginx."
  log "Validation puis rechargement de Nginx"
  sudo nginx -t
  sudo systemctl reload nginx
else
  log "Nginx ou systemctl absent : rechargement ignoré"
fi

log "Déploiement terminé avec succès : $APP_DIR/dist"
