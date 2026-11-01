# Sources et limites de validation

Le ZIP initial contient une maquette et des extraits comptables réels. Sa copie intégrale est conservée dans `.private/GBtoR365/`, hors Git et déploiement. La version opérationnelle ne précharge plus aucun de ces extraits ni les données fictives ajoutées pour la première démonstration.

## Documents retrouvés dans les téléchargements d’Olivier

- CSV R365 Vendor Transaction by Account : fichier préparé de référence, utile pour valider le rapprochement des factures et le format de sortie AP.
- Classeur `1- Artx JEs Sales by Wk Oct 2026.xlsx` : journaux déjà préparés, dont la feuille `ArtxSales JE 1019-1025`, colonnes N:X avec en-tête ligne 5. Les valeurs enregistrées sont utilisées pour les tests privés, sans recalcul de formules.
- Procédure fournisseurs Word et procédure ventes PDF : décrivent le travail dans GlobalBake et les transformations manuelles.

Ces fichiers ne prouvent pas le schéma des exports bruts AP0001 ou G/L Transaction Report. Ces exports complets, les options d’obtention du CSV et les correspondances métier validées restent nécessaires avant de certifier un convertisseur GlobalBake.

Les comptes/location `0092-55120000 → 55120` et le lien éventuel `0092 → EGG70` ne sont pas généralisés. La première règle peut être choisie explicitement dans un mapping pour son format borné ; la seconde reste à confirmer.

## Validation privée

Le parcours opérationnel est vérifié localement avec le CSV fournisseurs réellement reçu et un CSV extrait du journal préparé de référence. Les originaux sont comparés octet par octet après stockage ; montants, zéros initiaux, signes, commentaires et contrôles sont rapprochés des références privées. Le CSV JE extrait ne se présente pas comme un export GlobalBake brut.

Aucun fichier comptable reçu n’est ajouté aux assets, au dépôt public ou préchargé en production. Les tests publics utilisent `tests/fixtures-demo.js` dans des bases temporaires exclusivement. Le portail ne charge ni ce fichier ni des exemples fictifs.

## R365

La documentation publique ne remplace pas le contrat d’accès de l’équipe R365. L’instance de test, les droits d’écriture, endpoints applicables, payloads et réponses d’import doivent être confirmés. Aucun import R365 ni réception GlobalBake n’est annoncé sans preuve.
