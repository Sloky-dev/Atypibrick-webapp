# Atypibrick Webapp

Interface React + TypeScript + Vite pour inventorier une collection LEGO et suivre le montant investi.

```bash
npm install
copy .env.example .env
npm run dev
```

L'API attendue par défaut est `http://localhost:8000/api/atypibrick/v1`.

## Brick Room

L’entrée **Brick Room** permet de capturer des photos depuis la caméra du téléphone,
reprendre leur envoi, consulter une reconstruction en points 3D colorés et associer
des sets à des repères. Le bouton **Localiser** d’un set ouvre ses emplacements.
La capture exige HTTPS (ou localhost pour le développement), l’autorisation caméra
et `Permissions-Policy: camera=(self)`.

La reconstruction nécessite le worker décrit dans
[`../backend/deploy/BRICK_ROOMS.md`](../backend/deploy/BRICK_ROOMS.md).
Sans worker, les photos peuvent être capturées et conservées, mais le bouton de
reconstruction reste désactivé. Cette première version ne génère pas de maillage
dense et ne fournit pas de mesures métriques.

Vérification du parcours sur ordinateur et au format Android :

```bash
npm ci
npx playwright install chromium
npx playwright test
```

Les tests utilisent une caméra et une API simulées. Pour utiliser un Chrome déjà
installé, définir `PLAYWRIGHT_CHANNEL=chrome`. Ils couvrent capture, reprise après
échec et rechargement, rendu 3D, repères, association et localisation d’un set.

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
