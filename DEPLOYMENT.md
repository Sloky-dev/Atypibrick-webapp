# Déploiement Docker Atypibrick

## État actuel : bascule confirmée

Le rapport `atypibrick-cutover-rb2bnp1a.txt` confirme que le frontend est servi
par Docker. Pages/assets, cache, en-tête de sécurité, fallback SPA, API sans
authentification (401), média absent (404) et redirection HTTPS sont vérifiés.
Les locations API et médias restent sur l'hôte. La connexion, la collection
et l'affichage d'images réelles restent à vérifier dans le navigateur.

Le conteneur `atypibrick-pilot-web-1` sert désormais la production : ne pas
l'arrêter comme un simple pilote. Pour publier après commit/push, utiliser
`bash /var/www/atypibrick_webapp/deploy.sh`.

Sauvegarde Nginx de cette bascule :
`/var/backups/atypik-migration/atypibrick-cutover-79ovber3/vhost.original`.
Retour au service statique hôte si nécessaire :

```bash
sudo cp --preserve=mode,ownership /var/backups/atypik-migration/atypibrick-cutover-79ovber3/vhost.original /etc/nginx/sites-available/app.atypibrick.fr
sudo nginx -t && sudo systemctl reload nginx
```

Conserver l'ancien dist pour ce retour arrière. La section suivante décrit
la première bascule déjà effectuée ; ne pas la relancer.

## Première bascule

Le site hôte est rétabli : six permissions corrigées, pages/SPA 200, asset
absent 404, API non authentifiée 401, média absent 404. Le pilote sur 18083 est
sain. Avant bascule, commiter/pousser les nouveaux fichiers Docker et deploy.sh,
puis sur le VPS, en utilisateur ubuntu :

```bash
cd /var/www/atypibrick_webapp
git pull --ff-only
```

Ne pas lancer deploy.sh avant la première bascule. Transférer le paquet
`migration-artifacts/atypibrick-cutover.tar.gz` dans `/home/ubuntu/`, puis :

```bash
tar -xzf /home/ubuntu/atypibrick-cutover.tar.gz -C /home/ubuntu
sudo python3 /home/ubuntu/atypibrick-cutover/cutover.py
```

Le script vérifie le vhost, l'image validée, les fichiers de publication et
l'identité des contenus entre hôte et candidat. Il archive le vhost puis
remplace les trois locations frontend ; API, médias et TLS restent sur l'hôte.
Une erreur de contrôle après modification restaure le vhost. Retourner le
rapport `atypibrick-cutover-XXXXXX.txt`. Vérifier ensuite dans le navigateur
connexion, collection et affichage des images réelles.

## Publications suivantes

Après commit et push : `bash /var/www/atypibrick_webapp/deploy.sh` sur le VPS,
sans sudo. Le script effectue git pull et utilise sudo pour Docker. Il bloque
les changements locaux suivis et les déploiements simultanés.

Chaque image est construite depuis un snapshot du commit, testée sur 18084,
puis remplace le conteneur `atypibrick-pilot-web-1` sur 18083. Une brève
interruption est possible. Si les tests après remplacement échouent, l'ancien
conteneur est réactivé. Le script conserve aussi ce conteneur après succès et
affiche les commandes de retour arrière manuel. Ne pas purger ces ressources
pendant la période d'observation ; surveiller l'espace disque.

N'utiliser ni l'ancien deploy.sh statique, ni Compose/pilot.sh pour publier
après bascule. Le workflow utilise directement Docker pour préserver le
conteneur précédent intact. Aucun vhost n'est réinstallé lors des publications.

Validation locale : syntaxe, trois scénarios de publication/rollback simulés,
transformation des trois locations et préservation des blocs API/médias. Le
nouveau workflow de publication reste à valider par une exécution réelle VPS.
