# Atypibrick Webapp

Interface React + TypeScript + Vite pour inventorier une collection LEGO et suivre le montant investi.

```bash
npm install
copy .env.example .env
npm run dev
```

L'API attendue par défaut est `http://localhost:8000/api/atypibrick/v1`.

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


## Chargement des statistiques

La liste des sets et la synthèse globale sont chargées indépendamment. Les recherches, filtres, tris, pages suivantes et changements d’écran ne rappellent pas `/collection/summary`. `App` conserve la synthèse en mémoire pour la session et la partage avec le Dashboard ; elle n’est pas enregistrée dans le stockage du navigateur.

Les clients API émettent `atypibrick:collection-changed` uniquement après la réussite d’une opération qui affecte la collection : création/modification/suppression/restauration de set, inventaire avec suppression des absents, ajout/suppression/remplacement de pièces ou mutation d’exemplaires de minifigurines. `useCollectionSummary` écoute cet événement pour relire la synthèse. Les actions échouées, la réparation d’une image et la simple consultation n’invalident pas les statistiques.

Les réponses anciennes sont ignorées lorsqu’une actualisation plus récente a commencé. La synthèse est isolée par compte et vidée à la déconnexion ; une réponse tardive d’un ancien compte ne peut pas être affichée dans le nouveau. Un échec des statistiques possède son message et son bouton de relance indépendants de la liste.
