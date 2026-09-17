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
reprendre leur envoi, consulter une reconstruction avec surfaces texturées et associer
des sets à des repères. Le bouton **Localiser** d’un set ouvre ses emplacements.
La capture exige HTTPS (ou localhost pour le développement), l’autorisation caméra
et `Permissions-Policy: camera=(self)`.

Le bouton **Démarrer le scan continu** prélève automatiquement des images de la
caméra pendant le déplacement, sans enregistrer de fichier vidéo ni de son.
Les vues presque identiques et trop sombres sont ignorées. Le scan se met en pause
en cas d’échec d’envoi, d’arrêt de la caméra ou de passage de l’application en
arrière-plan. La prise de photo manuelle reste disponible.

La reconstruction nécessite le worker décrit dans
[`../backend/deploy/BRICK_ROOMS.md`](../backend/deploy/BRICK_ROOMS.md).
Sans worker, les photos peuvent être capturées et conservées, mais le bouton de
reconstruction reste désactivé. Le moteur dense OpenMVS doit être installé sur le
serveur. Les mesures ne sont pas métriques. Les anciennes vues en points sont
identifiées comme partielles et peuvent être complétées/retraitées si elles n’ont
pas de repères, sans perte des photos.

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
