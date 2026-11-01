# Brief de reprise — GBtoR365

## Objectif

Créer un portail Artimex dédié à la préparation, la validation et au transfert de données comptables de GlobalBake vers Restaurant365. Le domaine envisagé est `gbtor365.artimexbakery.com` ; il n'est pas configuré par ce prototype. Garder ce projet séparé d'EGG Order, qui gère l'autre sens : commandes restaurant R365 → GlobalBake.

Conserver le logo Artimex et l'identité du prototype. Les deux circuits prioritaires sont les factures fournisseurs et les journaux hebdomadaires de ventes. Les échanges comptables API et les tâches planifiées ne sont pas implémentés. Un accès administrateur initial a été ajouté à la demande d’Olivier ; voir `docs/AUTHENTICATION.md`.

## Personnes et rôles proposés à confirmer

| Fonction proposée | Usage |
| --- | --- |
| Revue comptable | Revue et export |
| Préparation | Préparation des ventes |
| Supervision financière | Supervision et exceptions |
| Administration | Configuration et accès |

Les personnes et adresses proposées restent dans le brief original privé local `.private/GBtoR365/CODEX_BRIEF.md`. Les profils du site public sont fictifs.

Le compte administrateur initial et six comptes individuels sont actifs avec leurs droits attribués. Aucun email ni invitation envoyé. Voir `docs/AUTHENTICATION.md`. La gestion d’équipe persistante reste à construire ; le changement de profil du mockup hors ligne reste une simulation.

## Factures fournisseurs

La procédure reçue décrit Week/Month → Platinum MYO Export → Export Purchase → fichier AP0001. Prévoir un parseur versionné pour les en-têtes H, les lignes D et les lignes de répartition. Obtenir un AP0001 original complet avant de coder les positions et exclusions : les captures ne suffisent pas.

Le total de facture doit alimenter Amount et être rapproché de la somme de Detail Amount. Ne pas sommer le montant d'en-tête répété sur chaque détail. Clé métier candidate : entité + fournisseur + numéro de facture, à confirmer avec les règles de corrections/avoirs R365.

Règle observée : `0092-55120000` → `55120`. Ne l'appliquer qu'au format validé, pas à tous les préfixes. La procédure montre 0092, le CSV cible EGG70 : le lien reste à confirmer. Les codes de localisation comptable R365 ne sont pas les noms des restaurants EGG.

## Ventes

La procédure décrit Ledger → Reports → G/L Transaction Report, choix de la période, export, conservation de Type=Sale, regroupement par facture puis par compte, préparation des lignes Journal Entry pour Rosa.

Conserver les lignes sources et les raisons d'exclusion. Établir une correspondance client / compte / localisation explicite et versionnée. Utiliser des décimaux exacts ou des centimes, avec rapprochement par journal et, selon les règles validées, par localisation.

Les écritures négatives et les commentaires de période signalés dans le prototype sont des points à examiner, pas des erreurs comptables prouvées. Toute correction doit produire un avant/après et une validation nominative.

## Étapes proposées

1. Valider les écrans et les responsabilités avec Rosa, Jorge et Aamer.
2. Recueillir un AP0001 brut, un G/L Transaction Report brut et des exports R365 acceptés. Confirmer codes fournisseurs, comptes, localisations, formats de date, avoirs et traitement des corrections.
3. Construire le backend : authentification, droits serveur, fichiers originaux immuables, base de lots, règles de mapping versionnées et journal d'audit persistant.
4. Construire les convertisseurs, les diagnostics par ligne, le rapprochement et la génération déterministe des fichiers cibles. Tester les lots de référence dans R365 de test.
5. Documenter les capacités réelles d'export GB et d'import/API R365 avec les équipes concernées. Ne pas inventer de points d'accès. Stocker les secrets côté serveur uniquement.
6. Connecter un mode test, récupérer les confirmations d'import et les identifiants R365. Distinguer « fichier généré », « transmis » et « import confirmé ».
7. Ajouter ensuite la planification, les reprises après échec et les notifications décidées par l'équipe.

## Modèle de données initial proposé

Utilisateurs et rôles ; fichiers sources (empreinte, nom, taille, auteur) ; lots (type, période, entité, statut) ; documents et lignes ; règles de correspondance avec version ; contrôles ; décisions de revue ; exports ; tentatives de transfert ; confirmations et événements d'audit.

Prévoir une clé d'idempotence et des contraintes uniques persistantes. Un téléchargement ne prouve jamais un import R365. Un délai réseau ne prouve pas un échec : vérifier la réception avant toute nouvelle transmission. Une modification d'un lot doit invalider son approbation antérieure.

## Critères d'acceptation

- Échantillon fournisseurs original : vérifier les chiffres de référence de l’audit privé ; chaque facture se rapproche indépendamment. Le jeu public est fictif, voir `docs/SOURCE_AUDIT.md`.
- Semaine 19–25 octobre originale : vérifier les montants de référence de l’audit privé ; 62 lignes JE dont 60 non nulles et 53 références de facture. Les montants fictifs sont différents.
- Zéros initiaux, suffixes, dates, signes et commentaires conservés.
- Deux écritures négatives et neuf commentaires de période signalés sans correction implicite.
- Les erreurs de deux factures ou de deux journaux ne peuvent pas se compenser pour masquer une anomalie.
- Réimport identique, version corrigée, rejet partiel et réponse réseau inconnue traités sans doublon.
- Les profils non autorisés ne peuvent ni approuver ni transmettre côté serveur.
- Un export accepté dans l'environnement R365 de test est rapproché de la source et de son accusé de réception.

Le scope ne comprend pas le moteur météo, les commandes EGG ni le catalogue e-commerce XML : ces projets restent distincts.
