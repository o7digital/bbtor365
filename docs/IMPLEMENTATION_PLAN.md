# Suite de l’intégration — GBtoR365

Le dépôt CSV, les originaux immuables, les mappings versionnés, les traitements après dépôt, les contrôles, revues, approbations, fichiers cibles et l’audit sont maintenant implémentés côté serveur et stockés dans une base dédiée. Les comptes et rôles existants sont conservés. Voir `REAL_WORKFLOW_DELIVERY.md` et `OPERATIONS.md` pour la livraison et l’exploitation.

## Confirmer les sources GlobalBake

Demander à Pam, pour les achats et les ventes, le rapport exact, les options, la méthode supportée pour enregistrer un CSV et un export brut complet. Le fichier AP0001 et le G/L Transaction Report sont les références attendues. Ne pas supposer qu’un export CSV direct existe si GlobalBake exige une autre méthode.

Avec Rosa/Jorge et l’équipe comptable, valider fournisseurs, clients, comptes, localisations, dates, signes, exclusions, corrections/avoirs et les regroupements. Définir le traitement des en-têtes/contreparties AP0001 à partir du fichier complet, pas de captures.

Configurer les modèles dans l’éditeur existant et vérifier deux fichiers successifs avec la même version. Développer un adaptateur spécifique si la structure du rapport excède les associations de colonnes, constantes, filtres, correspondances et regroupements déjà pris en charge. L’ordre des colonnes est libre ; leurs noms et codes doivent respecter le mapping.

## Intégrer R365 TEST

Obtenir instance de test, authentification, droits d’écriture AP/JE, documentation des endpoints, formats de payload et réponses. Aucun endpoint générique d’import CSV n’est supposé.

Construire ensuite les adaptateurs documentés et une action explicite après approbation. Définir les clés d’idempotence, résultats partiels, consultation de réception après délai et corrections/avoirs. Les états « fichier généré », « transmis », « pris en charge » et « import confirmé » doivent rester distincts. Conserver les identifiants externes et les réponses.

Aucun appel d’écriture au simple dépôt d’un CSV. Aucun envoi en production comptable dans cette phase. Le bouton d’envoi reste bloqué jusqu’à intégration et validation de ces dépendances.

## Renforcer l’exploitation et les comptes

Prévoir une sauvegarde hors site et une politique de rétention des originaux et audits. Les sauvegardes locales et leur rétention sont déjà en place. Ajouter filtres/pagination d’historique au-delà de la liste des 500 lots / 1 000 événements les plus récents, sans supprimer les enregistrements persistants.

Prévoir la gestion de comptes en base, le changement personnel de mot de passe, réinitialisations/suspensions immédiates, 2FA et limitation distribuée des tentatives. Conserver les rôles confirmés : les trois comptes de Chris, Miguel et Charles restent en consultation, conformément à la dernière instruction d’Olivier.

Le domaine `gbtor365.artimexbakery.com` nécessite encore confirmation et rattachement DNS. Les autres projets Artimex restent indépendants.
