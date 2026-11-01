# Exploitation GBtoR365

## Services et isolation

- Vercel : projet `olivier-steineur/gbtor365`, branche `main`, entrée `api/portal.js`, assets `dist/`.
- VPS : hôte SSH `o7-vps` (utilisateur Ubuntu), service Docker dédié `gbtor365-store`.
- Code serveur de stockage : `/opt/gbtor365/store.py`.
- SQLite : `/srv/gbtor365-db/gbtor365.sqlite3`, WAL activé, migration idempotente version 1.
- HTTPS : `https://mail.o7digitalgroup.com/gbtor365-store`, jeton serveur obligatoire ; aucune requête anonyme acceptée.
- Route Nginx additionnelle : `/opt/o7/mailcow/data/conf/nginx/site.gbtor365.custom`. Les configurations EGG Order et Mailcow existantes n’ont pas été remplacées.

Le conteneur a une racine en lecture seule, un utilisateur sans privilège, aucune capacité Linux et aucun port publié. Il communique uniquement sur le réseau privé du reverse proxy. Son seul volume inscriptible est le dossier de données dédié.

Les variables Vercel `GB_STORE_URL` et `GB_STORE_TOKEN` configurent ce stockage. Le jeton est sensible ; seule son empreinte SHA-256 figure dans la base. Les variables des comptes existants ne sont pas modifiées. Aucun secret n’est présent dans le dépôt ni dans les artefacts.

## Modèle persistant

`documents` conserve les lots (octets originaux encodés, empreinte, auteur, période, mapping, lignes transformées, contrôles, décisions et exports), les mappings avec toutes leurs versions, les empreintes de fichier et les références de documents comptables. Les listes de lots utilisent des métadonnées distinctes pour éviter de transférer tous les originaux.

`audit_events` conserve les actions avec acteur, horodatage UTC, lot et détails. Toute mutation métier et son audit sont validés dans une même transaction SQLite. Les préconditions de version refusent les écritures concurrentes périmées.

La base ne contient aucune facture de démonstration. Un enregistrement technique `qa:persistence-check` sert uniquement à vérifier qu’un redémarrage du conteneur conserve le stockage ; il n’est pas un lot et n’apparaît pas dans le portail.

## Sauvegardes

`/opt/gbtor365/backup.py` utilise l’API SQLite de sauvegarde en ligne. `/etc/cron.d/gbtor365-backup` l’exécute chaque jour à 03:35 selon l’horloge du VPS. Quatorze copies journalières sont conservées dans `/srv/gbtor365-db/backups/`, avec droits privés. Une première copie a été créée. Ces sauvegardes restent sur le même VPS ; aucune copie hors site n’est configurée.

Sauvegarde manuelle :

```sh
ssh o7-vps 'sudo -n python3 /opt/gbtor365/backup.py'
```

Restauration : conserver une copie de l’état courant, arrêter uniquement `gbtor365-store`, restaurer une sauvegarde SQLite dans le dossier dédié avec propriétaire UID/GID 10001, enlever les anciens WAL/SHM uniquement lorsque le service est arrêté, puis redémarrer le conteneur et vérifier les compteurs. Ne jamais restaurer dans la base EGG Order.

## Déploiement et contrôles

```sh
npm test
npm run check
npm run build
git push origin main
vercel deploy --prod --yes --scope olivier-steineur
```

Une modification de `ops/store.py` doit également être installée dans `/opt/gbtor365/store.py`, puis seul le conteneur dédié est redémarré. Tester la configuration Nginx avant tout rechargement lors d’une modification de sa route ; conserver les autres fichiers de configuration.

`scripts/check-storage.cjs` reçoit le jeton par entrée standard masquée, vérifie le refus anonyme, écrit un marqueur technique non comptable, redémarre uniquement le service dédié et contrôle sa persistance. Aucun fichier ni facture de test n’est injecté dans le portail de production.

## Retour arrière

Une version Vercel précédente peut être restaurée via la CLI Vercel, mais les anciennes versions du portail affichent la maquette ; il est préférable de corriger la version opérationnelle. Ne pas supprimer la base ni restaurer une sauvegarde lors d’un simple retour arrière d’interface. Les originaux et les décisions demeurent disponibles dans la base.

Le stockage échoue explicitement en cas d’indisponibilité. Aucune donnée n’est remplacée par des factures fictives, une base en mémoire ou le `localStorage` du navigateur.
