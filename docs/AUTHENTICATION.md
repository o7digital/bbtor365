# Connexion administrateur — GBtoR365

L’accès hébergé demande maintenant un email et un mot de passe. La vérification est effectuée côté serveur. Le compte initial est celui d’Olivier ; aucun compte ni invitation n’est créé pour les autres personnes proposées dans le brief.

## Fonctionnement

`api/portal.js` utilise `server/portal.cjs` comme point d’entrée unique. Toutes les routes Vercel passent par cette fonction, y compris les fichiers JavaScript contenant les données de démonstration. Seuls la page de connexion, ses scripts/styles et le logo/favicon sont publics. Une requête anonyme vers le portail redirige vers `/login` ; une requête directe vers les données reçoit 401.

Le mot de passe n’est pas dans le code, le HTML, le navigateur ou Git. Seule une empreinte scrypt avec sel est stockée avec la configuration du compte dans la variable Vercel sensible `GB_AUTH_CONFIG`. Les sessions sont signées HMAC-SHA256, limitées à huit heures et liées à la version du mot de passe. Le cookie est HttpOnly, SameSite=Strict, Secure en production, sans domaine partagé. Les réponses authentifiées et d’authentification ne sont pas mises en cache.

Les identifiants invalides ont le même message d’erreur. Les requêtes de connexion/déconnexion doivent être de même origine ; corps limité à 4 Ko. Les tentatives invalides sont limitées par instance (8 échecs par fenêtre de 15 minutes), avec une limite de calculs simultanés. Cette limitation n’est pas un compteur distribué persistant.

`/api/session` fournit uniquement le nom, l’email, le rôle administrateur et l’expiration de session. Le compte réel remplace le profil simulé dans la barre supérieure. Son menu permet de se déconnecter ; le changement de profil simulé n’est pas disponible dans le portail hébergé. La session est vérifiée au chargement et périodiquement lorsque l’onglet reste ouvert.

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

L’aperçu HTML autonome généré dans `artifacts/` reste une copie de consultation **hors ligne** à données fictives. Il ne contient ni compte ni mécanisme d’accès serveur. Ne pas l’utiliser comme point d’entrée de l’hébergement.

## Administration

Le compte initial a été provisionné par CLI Vercel. Les identifiants ont été communiqués uniquement dans la conversation de livraison ; aucun email n’est envoyé.

`scripts/provision-admin.cjs <email> <nom>` génère une nouvelle configuration et l’envoie à Vercel par l’entrée standard, en mode sensible pour Production et Preview. Il affiche le nouveau mot de passe une seule fois. Il refuse d’écraser silencieusement une variable existante. Une rotation nécessite une mise à jour explicite de `GB_AUTH_CONFIG` par CLI et un redéploiement ; elle invalide les anciennes sessions.

## Portée et suite

Il s’agit d’un accès administrateur initial au prototype. Les données comptables restent fictives ; les validations, approbations et historiques restent des interactions locales de démonstration. La connexion ne crée pas de stockage de lots, d’import R365 ou de confirmations comptables.

La gestion d’équipe persistante, les invitations, le changement/rétablissement de mot de passe en autonomie, l’authentification multifacteur, la révocation individuelle des sessions et une limitation distribuée restent à construire avec un service d’identité adapté. La déconnexion actuelle efface le cookie du navigateur ; une session signée copiée ailleurs n’est invalidée qu’à expiration ou rotation de la configuration.

Références : [fonctions Node Vercel](https://vercel.com/docs/functions/runtimes/node-js), [routage et configuration Vercel](https://vercel.com/docs/project-configuration/vercel-json).
