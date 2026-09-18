# Atypibrick Webapp

Interface React + TypeScript + Vite pour inventorier une collection LEGO et suivre le montant investi.

```bash
npm install
copy .env.example .env
npm run dev
```

L'API attendue par défaut est `http://localhost:8000/api/atypibrick/v1`.

## Brick Room

Visite panoramique depuis un point fixe par pièce. Capture guidée au téléphone
(rotation sur place avec superposition de la dernière vue), ou import d’une image
360° équirectangulaire 2:1. Repères, association aux sets et accès « Localiser ».
Les zones non photographiées restent vides. Aucune reconstruction de surfaces.

La capture exige HTTPS, l’autorisation caméra et `Permissions-Policy: camera=(self)`.
Les photos non envoyées sont conservées localement pour reprendre l’envoi.
L’assemblage utilise le worker décrit dans
[`../backend/deploy/BRICK_ROOMS.md`](../backend/deploy/BRICK_ROOMS.md).
L’import d’un panorama fonctionne aussi sans worker.

« Actualiser le panorama » remplace la capture, conserve les associations et
marque les repères à replacer. Les anciennes pièces 3D proposent de créer leur
panorama ; les photos anciennes ne doivent pas être mélangées à la nouvelle capture.

```bash
npm ci
npx playwright install chromium
npx playwright test
```

Les tests utilisent une caméra et une API simulées. Pour Chrome installé,
définir `PLAYWRIGHT_CHANNEL=chrome`. La qualité du raccord des photos et la
capture sur Pixel réel restent à vérifier en conditions réelles.

## Déploiement sur le VPS

Le script vérifie Node.js, npm, Git, les permissions, les dépendances et le build avant de
recharger Nginx :

```bash
chmod +x deploy.sh
./deploy.sh
```

Pour construire la version déjà présente sur le serveur sans lancer `git pull` :

```bash
DEPLOY_PULL=0 ./deploy.sh
```

Un autre emplacement peut être indiqué avec `APP_DIR=/chemin/vers/atypibrick_webapp`.

La configuration Nginx complète est versionnée dans `nginx/app.atypibrick.fr.conf`. Le script
de déploiement l'installe automatiquement avant de tester et recharger Nginx. Pour conserver
temporairement la configuration déjà installée sur le VPS :

```bash
DEPLOY_NGINX_CONFIG=0 ./deploy.sh
```
