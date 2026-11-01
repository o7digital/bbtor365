# Passage au parcours opérationnel — 1er novembre 2026

## Implémenté

Suppression des données comptables fictives du site et de leur chargement. Les fixtures sont déplacées dans `tests/` et servent uniquement aux vérifications locales. L’accueil, les factures et les journaux partent d’un état vide.

Le dépôt CSV conserve côté serveur les octets originaux, le SHA-256, l’auteur, le type et la période. Contrôles par facture et par journal, diagnostics par ligne, revue des exceptions avec note nominative, approbation selon les droits, génération CSV et audit persistant. Aucun total d’en-tête AP n’est additionné plusieurs fois ; les zéros initiaux, signes et commentaires sont conservés.

Mappings enregistrés par nom d’en-tête, versions, constantes, transformations bornées, filtres, correspondances de codes et regroupements avec refus des conflits. Réutilisation automatique au prochain fichier du même type. Un retraitement explicite conserve l’original et invalide les anciennes décisions.

Détection persistante des fichiers identiques, même renommés, et signalement des références de documents déjà rencontrées. Versions concurrentes refusées. Les sept comptes existants et leurs droits restent inchangés.

## Stockage déployé

Service et base SQLite dédiés sur VPS1, passerelle HTTPS avec jeton serveur, aucune base dans Vercel ou dans les assets. Sauvegardes journalières locales avec rétention de quatorze jours. Le marqueur technique de contrôle ne représente aucune facture et n’est pas listé comme lot.

## Testé localement

25 tests Node et contrôles syntaxiques. Parcours Chrome EN/ES sur huit écrans et quatre largeurs (1 440, 768, 390, 320 px), dépôt des fichiers comptables préparés réellement reçus, comparaison des originaux octet par octet, contrôles de référence, détail facture, doublon renommé, mapping, retraitement, approbation, téléchargement et historique après rechargement. Le journal réel est extrait du classeur préparé de référence pour ces tests privés, sans conversion supposée d’un G/L brut.

Les données reçues sont vérifiées dans une base locale temporaire. Aucun lot fictif ou comptable réel n’est préchargé dans la base de production.

## Dépendances qui restent bloquées

- GlobalBake : fichier AP0001 complet et G/L Transaction Report brut, options et méthode supportée pour obtenir les CSV auprès de Pam, correspondances métier approuvées.
- R365 TEST : instance, méthode d’authentification, accès et documentation des opérations d’écriture AP/JE, formats et réponses de confirmation. Aucun endpoint ni accusé de réception inventé ; l’envoi reste désactivé.
- Authentification : les comptes existants fonctionnent ; la 2FA et le changement autonome de mot de passe ne sont pas ajoutés par cette évolution du flux comptable.

Le parcours local vérifié va du CSV réellement déposé au fichier cible approuvé. La génération du rapport dans GlobalBake et un import accepté dans R365 TEST ne sont pas vérifiés de bout en bout sans les éléments ci-dessus.

## Vérifié sur le site déployé

Publication CLI Vercel à partir du commit `b6b8fcb`, déploiement `dpl_ESjSfCdaZLHe8HT2UdDBo3AsmLSv`, URL stable https://gbtor365.vercel.app.

Vérification externe : huit écrans accessibles, aucune erreur JavaScript, affichage mobile sans débordement, aucun lot préchargé et deux modèles de colonnes préparées. Les anciennes données fictives et les fixtures de tests ne sont plus accessibles dans les assets. Les sept comptes ont été reconnectés séparément avec leurs identifiants existants et les droits attendus.

Le stockage HTTPS refuse les requêtes sans jeton. Un marqueur technique a été retrouvé après redémarrage du seul service dédié ; le compteur de lots restait nul. Le code de stockage installé sur VPS1 correspond exactement à la source versionnée. Aucun fichier comptable de test ou de référence n’a été déposé en production.
