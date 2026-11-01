# Connexion et comptes — GBtoR365

L’accès hébergé demande maintenant un email et un mot de passe. La vérification est effectuée côté serveur. Le compte administrateur initial est conservé. Six comptes individuels ont été ajoutés à la demande d’Olivier, avec les droits confirmés : supervision financière, revue/export, préparation et trois accès en consultation. Aucun email ni invitation envoyé.

## Fonctionnement

`api/portal.js` utilise `server/portal.cjs` comme point d’entrée unique. Toutes les routes Vercel passent par cette fonction, y compris les fichiers JavaScript contenant les données de démonstration. Seuls la page de connexion, ses scripts/styles et le logo/favicon sont publics. Une requête anonyme vers le portail redirige vers `/login` ; une requête directe vers les données reçoit 401.

Le mot de passe n’est pas dans le code, le HTML, le navigateur ou Git. Seules des empreintes scrypt avec sel sont stockées dans les variables Vercel sensibles. `GB_AUTH_CONFIG` conserve le compte administrateur et sa clé de signature ; chaque nouveau compte utilise sa propre variable `GB_USER_<empreinte_email>`. Aucun secret d’EGG Order n’est repris. Les sessions sont signées HMAC-SHA256, limitées à huit heures et liées à la version du mot de passe et du rôle. Une session d’un compte retiré, désactivé ou dont le rôle change est refusée après déploiement de la nouvelle configuration. Le cookie est HttpOnly, SameSite=Strict, Secure en production, sans domaine partagé. Les réponses authentifiées et d’authentification ne sont pas mises en cache.

Les identifiants invalides ont le même message d’erreur. Les requêtes de connexion/déconnexion doivent être de même origine ; corps limité à 4 Ko. Les tentatives invalides sont limitées par instance (8 échecs par fenêtre de 15 minutes), avec une limite de calculs simultanés. Cette limitation n’est pas un compteur distribué persistant.

`/api/session` fournit uniquement le nom, l’email, le rôle attribué et les capacités associées et l’expiration de session. Le compte connecté apparaît dans la barre supérieure. `/api/team`, réservé aux sessions valides, fournit l’annuaire des comptes actifs et leurs rôles, sans empreinte ni secret. L’écran Équipe affiche ces comptes réels et ne propose pas d’édition fictive des droits. Son menu permet de se déconnecter ; le changement de profil simulé n’est pas disponible dans le portail hébergé. La session est vérifiée au chargement et périodiquement lorsque l’onglet reste ouvert.

## Exécution locale et tests

```sh
npm start
```

Le serveur Node démarre sur http://127.0.0.1:8080 et affiche un compte local temporaire avec un mot de passe aléatoire. Ces identifiants locaux ne fonctionnent pas en production et sont renouvelés au redémarrage. Pour utiliser une configuration locale préparée, passer `GB_AUTH_CONFIG` dans l’environnement du processus ; aucun fichier de secrets n’est requis.

```sh
npm test
npm run check
npm run build
PLAYWRIGHT_MODULE=/chemin/vers/playwright npm run test:auth-browser
```

Le dernier script démarre lui-même son serveur et un compte de test temporaire, puis vérifie connexion EN/ES et mobile, refus des mauvais identifiants, rechargement, déconnexion, cookie falsifié et les parcours comptables. Il n’emploie pas le compte de production. Le test distant utilise `BASE_URL`, `--remote` et une entrée standard masquée ; il ne journalise pas les identifiants.

Le packaging ne génère plus d’aperçu autonome hors ligne. L’application nécessite son serveur authentifié et son stockage persistant. Les fixtures comptables fictives restent uniquement dans les tests.

## Administration

Le compte initial a été provisionné par CLI Vercel. Les identifiants ont été communiqués uniquement dans la conversation de livraison ; aucun email n’est envoyé.

`scripts/provision-admin.cjs <email> <nom>` génère une nouvelle configuration et l’envoie à Vercel par l’entrée standard, en mode sensible pour Production et Preview. Il affiche le nouveau mot de passe une seule fois. Il refuse d’écraser silencieusement une variable existante. Une rotation nécessite une mise à jour explicite de `GB_AUTH_CONFIG` par CLI et un redéploiement ; elle invalide les anciennes sessions.

## Portée et suite

Il s’agit de comptes individuels pour accéder au prototype. Le portail ne précharge aucune donnée comptable. Les fichiers déposés, contrôles, décisions et historiques sont désormais conservés dans une base dédiée. Les imports R365 restent bloqués jusqu’à configuration du contrat API de test ; aucun résultat d’import n’est simulé.

Une base de comptes administrable en temps réel, les invitations, le changement/rétablissement de mot de passe en autonomie, l’authentification multifacteur, la révocation individuelle des sessions et une limitation distribuée restent à construire avec un service d’identité adapté. La déconnexion actuelle efface le cookie du navigateur ; une session signée copiée ailleurs n’est invalidée qu’à expiration ou rotation de la configuration.

Références : [fonctions Node Vercel](https://vercel.com/docs/functions/runtimes/node-js), [routage et configuration Vercel](https://vercel.com/docs/project-configuration/vercel-json).


## Droits attribués

| Rôle | Consultation | Chargement local | Contrôles/revue | Approbation/export CSV |
| --- | --- | --- | --- | --- |
| Administrateur | Oui | Oui | Oui | Oui |
| Revue/export | Oui | Oui | Oui | Oui |
| Préparation | Oui | Oui | Oui | Non |
| Supervision financière | Oui | Non | Oui | Oui |
| Consultation | Oui | Non | Non | Non |

Les identités et rôles proviennent de la session vérifiée côté serveur. Les capacités sont contrôlées à nouveau par chaque API métier de dépôt, mapping, validation, revue, approbation et export. Les comptes en consultation lisent les lots, originaux et historiques mais ne peuvent pas modifier les décisions ni générer un export approuvé.

## Ajout de comptes

`node scripts/provision-users.cjs` lit une liste JSON de noms/emails/rôles par une entrée standard masquée. Il génère des mots de passe individuels aléatoires, transmet seulement les empreintes salées aux variables sensibles Production/Preview et affiche chaque nouveau mot de passe une fois pour remise privée. Les variables existantes sont ignorées : rejouer la liste ne réinitialise pas les comptes. Le compte administrateur initial et la clé de signature sont préservés.

Les trois premières adresses proviennent du brief privé GBtoR365 ; celles de Chris/Christian Garcia, Miguel Solis et Charles Bonaparte sont vérifiées dans l’annuaire local d’EGG Order (`lib/directory.mjs`), consulté en lecture seule. Les droits de ce projet n’ont pas été repris d’EGG Order : les trois accès en consultation ont été confirmés par Olivier. Aucun fichier de cet autre projet modifié.

`npm run test:team-browser` démarre un serveur et sept comptes fictifs pour vérifier leurs connexions séparées, les capacités, l’annuaire et les déconnexions. Le mode distant lit les identifiants par entrée standard masquée, sans les journaliser.
