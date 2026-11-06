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


## Minifigurines : statistiques et pages

Le Dashboard consomme uniquement `/minifigures/summary`. Les statistiques sont calculées côté serveur et ne dépendent pas des fiches chargées dans le navigateur. L’en-tête de Mes Minifigurines demande aussi la dernière fiche avec `includeLatest=true` ; il n’utilise pas une liste complète pour trouver le dernier ajout.

Les séries utilisent `/minifigures/series` pour les définitions, quantités par personnage et progrès globaux. Mes figurines utilise `/minifigures/owned`, par lots de 24 cartes, avec recherche et filtres côté serveur. Ouvrir une carte charge au maximum 12 exemplaires via `/minifigures/copies` ; les suivants sont accessibles par « Charger plus d’exemplaires ». Les compteurs restent globaux, même si une seule page est affichée. La corbeille ne télécharge plus les exemplaires actifs pour retrouver les noms des personnages.

Après une mutation, les compteurs et les pages sont actualisés. Les réponses liées à d’anciens filtres sont ignorées. Les tests Playwright vérifient les requêtes du Dashboard, la pagination des cartes et des exemplaires, les filtres de doublons et les compteurs globaux sur ordinateur et mobile.


## Pages et navigation

React Router fournit six pages accessibles directement, y compris après un rechargement :

| Page | URL |
| --- | --- |
| Mes sets | `/sets` |
| Dashboard | `/dashboard` |
| Mes Minifigurines | `/minifigurines` |
| MOCs | `/mocs` |
| Pick a Brick | `/pick-a-brick` |
| Corbeille | `/corbeille` |

La racine redirige vers `/sets` en conservant les paramètres et l’ancre. Une URL inconnue affiche une page introuvable. La connexion conserve la page demandée. Le serveur doit servir `index.html` pour les routes applicatives ; les configurations Nginx du dépôt et le conteneur de production appliquent déjà ce comportement.

Les recherches, tris et filtres des sets sont dans les paramètres d’URL, par exemple `/sets?brand=LEGO&theme=Star+Wars#collection`. Une sélection dans le Dashboard mène à cette URL. Modifier un filtre remplace l’entrée courante pour éviter une entrée d’historique à chaque frappe ; les changements de page créent des entrées et permettent les retours précédent/suivant. Les paramètres sont validés avant l’appel API.

`App.tsx` assemble l’authentification, les routes et les fournisseurs partagés. `ApplicationLayout` contient la navigation et le compte ; `SetsPage` contient l’affichage des sets. `useSetsCollection` centralise la liste paginée, le dernier ajout global, la réparation des images et les actualisations après mutation. `useSetFilters` lit et écrit les filtres dans l’URL ; `useCollectionSummary` conserve les statistiques communes. Les requêtes de liste devenues inutiles sont annulées et les réponses obsolètes ignorées. Les autres pages ne chargent pas la liste des sets.

`SetActionsProvider` partage les fenêtres d’ajout, de modification, d’inventaire et de pièces manquantes. `NotificationsProvider` gère les confirmations, erreurs et annulations de suppression ; ces dernières restent accessibles lorsqu’on change de page. Les pages et les fenêtres des sets sont chargées à la demande.

Les tests `routing.spec.ts` couvrent les six liens directs, les rechargements, la connexion depuis un lien, les filtres partageables, l’historique et l’annulation après changement de page, sur ordinateur et mobile.
