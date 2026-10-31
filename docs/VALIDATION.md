# Validation de la reprise — 31 octobre 2026

## Changements

Import du projet fourni dans le dépôt dédié. Design, logo, CSS et structure HTML/JavaScript conservés ; aucun framework ou service comptable ajouté.

Les changements fonctionnels concernent `dist/assets/core.js` (diagnostic des montants JE invalides), `dist/assets/xlsx-reader.js` (références de facture alphanumériques conservées comme texte) et `dist/assets/app.js` (langue utilisable lorsque le stockage navigateur est indisponible, profils et avertissement de démonstration, tableau de correspondances issu des données fictives). Le fichier d’entrée, le logo et les styles sont ceux du ZIP.

Le jeu `dist/assets/sample-data.js` est fictif et reproductible par `scripts/generate-demo.cjs`. Les originaux restent dans `.private/GBtoR365/`, exclus du dépôt, des déploiements et des artefacts publics. `scripts/check-public.cjs` bloque le packaging d’un jeu non fictif.

Ajouts : configuration Vercel statique, scripts de démarrage et de packaging, fixtures XLSX et parcours navigateur, documentation de reprise et plan d’implémentation.

## Résultats locaux

- Les 11 tests reçus passent avant modification.
- `npm test` : 12/12, avec les invariants initiaux et un test de régression des montants JE invalides.
- `GB_SAMPLE_DATA=.private/GBtoR365/dist/assets/sample-data.js npm test` : 12/12 avec les extraits privés et le code courant.
- `npm run check` : syntaxe JavaScript valide.
- `npm run build` : vérification du jeu fictif, génération de l’aperçu autonome et du ZIP portable ; configuration Vercel incluse, fichiers privés et secrets exclus.
- Parcours Chrome automatisé : les sept écrans à 1 440, 768, 390 et 320 px sans débordement de page ; navigation et langue EN/ES, y compris les écrans espagnols à 390 px et la conservation de langue après rechargement.
- Recherche, pagination et détail d’une facture à quatre répartitions ; validation et approbation simulée ; téléchargements AP (79 lignes) et JE (62 lignes), références texte et zéros initiaux conservés.
- Journal : équilibre maintenu ; deux négatifs et neuf commentaires de période conservés après export ; revue de plusieurs localisations ; approbation inaccessible au profil de préparation.
- Imports CSV, TSV, TXT avec séparateur point-virgule et XLSX OOXML fictif ; sélection parmi quatre feuilles ; import de 56 lignes et 47 références avec suffixes ; doublons du lot actif reconnus ; colonnes manquantes refusées.
- Historique de session, téléchargement d’export, remise à zéro et absence de persistance des événements après rechargement ; interface fonctionnelle lorsque `localStorage` est bloqué ; aucune erreur JavaScript non gérée.

Les captures et fichiers de revue fictifs se trouvent dans `artifacts/` et ne sont pas versionnés. La QA navigateur utilise une installation Playwright existante et Chrome ; aucune dépendance applicative ajoutée.

## Limites

La vérification XLSX utilise un classeur synthétique compatible. Le classeur original de 96 feuilles et les exports bruts complets ne sont pas dans le ZIP reçu. Aucun test d’import R365 ni connexion comptable de production. Les dépendances métier et techniques sont détaillées dans `IMPLEMENTATION_PLAN.md`. Le domaine envisagé n’est pas configuré.

## Déploiement vérifié

Publication par `vercel deploy --prod --yes --scope olivier-steineur` sur le projet dédié `gbtor365`. URL stable : https://gbtor365.vercel.app ; déploiement `dpl_75sCK999ZUb1nJ9XctCbU1EepSYq`, état READY.

Contrôle externe : page d’entrée et six assets principaux en HTTP 200 ; données servies identiques au jeu fictif local ; en-tête `X-Robots-Tag: noindex, nofollow`. Les chemins privés, `.env.local`, documents et aperçu autonome à la racine répondent 404. Les sept vues `#overview`, `#ap`, `#sales`, `#mapping`, `#activity`, `#team`, `#guide` s’ouvrent dans Chrome sans erreur JavaScript ; l’accueil mobile à 390 px ne déborde pas. Captures finales dans `artifacts/production-desktop.png` et `artifacts/production-mobile.png`.

Code poussé sur `setup/gbtor365-preview` dans `o7digital/bbtor365`. Aucun autre projet Artimex ni domaine existant modifié.
