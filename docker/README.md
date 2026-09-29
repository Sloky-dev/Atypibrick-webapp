# Pilote Docker Atypibrick

## État du pilote reçu

`atypibrick-pilot-SKKiEY.txt` confirme le candidat sain
`atypik/atypibrick:pilot-0de38ac34169`, image
`sha256:632666e1c231658ff22869624f50605eee150929b90af9405b4c3294b8345c21`.
Les tests SPA, assets, cache et exclusions API/médias passent. Le vhost réel
correspond à la référence. Cependant, la racine du site hôte répond 403 ;
API /auth/me=401 et média absent=404, backend commun sain.

Avant bascule, transférer `repair-public-permissions.py` vers `/home/ubuntu/`
et exécuter `sudo python3 /home/ubuntu/repair-public-permissions.py`.
Le script relève les permissions du chemin, sauvegarde les anciens modes,
normalise uniquement `/var/www/atypibrick_webapp/dist` et contrôle les hashes
et propriétaires inchangés. Il refuse les liens et montages dans ce dossier.
Retourner le rapport `atypibrick-public-XXXXXX.txt`. Aucun vhost ni média partagé
n'est modifié ; si le 403 persiste, analyser ce rapport avant toute bascule.

Après validation du déploiement Docker Studio, préparer Atypibrick sur un
port indépendant : `127.0.0.1:18083`. Les ports Studio 18081/18082 sont conservés.
Le pilote ne modifie aucun vhost, backend, fichier média ou base de données.

Le build Node 24 utilise `npm ci`, le contrôle TypeScript et Vite. L'URL API
est fixée à `/api/atypibrick/v1` ; les .env sont exclus du contexte. Les images
de base sont les mêmes digests que ceux déjà utilisés pour Studio. La
configuration et les assets ont des permissions explicites pour l'utilisateur
non privilégié. Le runtime est limité à 128 Mio et 0,5 CPU ; la compilation
utilise les ressources de l'hôte avec un heap Node limité à 1536 Mio.

Le conteneur conserve le fallback React, index sans cache, assets avec cache
long et vraie 404 pour les assets absents. Il refuse /api et /media : ces routes
resteront servies par le proxy API et l'alias média du Nginx hôte. Un tunnel
direct vers le pilote permet de vérifier les fichiers statiques mais pas le
fonctionnement API complet de l'application.

Créer le paquet local : `python docker/package-pilot.py`. Transférer
`migration-artifacts/atypibrick-docker-pilot.tar.gz` vers `/home/ubuntu/`, puis :

```bash
tar -xzf /home/ubuntu/atypibrick-docker-pilot.tar.gz -C /home/ubuntu
sudo bash /home/ubuntu/atypibrick-docker-pilot/docker/pilot.sh
```

Retourner `/home/ubuntu/atypibrick-pilot-XXXXXX.txt`, même en cas d'échec.
Le script refuse de remplacer un pilote existant. Les statuts du site/API/média
sur l'hôte et la comparaison du vhost sont consignés pour analyse ; les tests
du candidat ne prouvent pas les parcours authentifiés ni l'affichage d'une
image réelle. Ces parcours devront être contrôlés lors de la bascule.

La bascule devra adapter ensemble les locations `/`, `/index.html` et
`/assets/`, et conserver `/api/`, `/media/`, TLS, les limites d'upload et les
en-têtes de sécurité. Modifier seulement `location /` laisserait les assets
et index servis depuis l'ancien dist.

Le `deploy.sh` actuel reste celui de l'hôte tant que la bascule n'a pas eu lieu.
Il réinstalle le vhost par défaut : il devra être remplacé par le workflow Docker
avant la mise en production, pour ne pas annuler la bascule ultérieurement.
