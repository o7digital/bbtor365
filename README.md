# GBtoR365 · Artimex

Prototype statique du portail comptable **GlobalBake → Restaurant365**, indépendant d’EGG Order et du site e-commerce Artimex. L’identité Artimex, le logo, la palette crème/olive/cuivre et les écrans anglais/espagnol du ZIP sont conservés. Aucune migration de framework. Une fonction Node Vercel protège maintenant l’accès par connexion administrateur.

Le dépôt et l’aperçu hébergé utilisent exclusivement un **jeu fictif**, généré sans lire les extraits comptables reçus. Les profils publics sont fictifs (`example.com`). Un compte administrateur réel permet la connexion ; les autres profils restent des propositions fictives, sans compte créé. Voir [la connexion et son administration](docs/AUTHENTICATION.md).

## Lancement local

```sh
npm start
```

Ouvrir http://127.0.0.1:8080. Le serveur affiche un email et un mot de passe **locaux temporaires** dans le terminal. Les identifiants hébergés sont indépendants.

Les sources de l’interface restent dans `dist/`, sans compilation ni dépendance applicative. Node.js récent sert l’accès authentifié et les contrôles ; Python 3 sert au packaging. La page `/login` conserve le logo, les couleurs Artimex et les versions anglais/espagnol.

## Vérifications et livrables

```sh
npm test
npm run check
npm run build
```

`build` vérifie que le jeu est fictif puis crée `artifacts/GBtoR365-preview.html` (consultation autonome) et `artifacts/GBtoR365_Artimex_Code.zip`. Ces artefacts ne sont pas versionnés. Le ZIP portable inclut la configuration Vercel ; les fichiers locaux privés en sont exclus.

Les 11 contrôles comptables livrés sont conservés et adaptés aux deux jeux de référence. Un douzième vérifie les montants JE invalides. Cinq tests supplémentaires couvrent la connexion, les sessions falsifiées/expirées, les accès directs, les origines, les erreurs de configuration et la limitation des tentatives. Pour contrôler les extraits originaux sur cette machine :

```sh
GB_SAMPLE_DATA=.private/GBtoR365/dist/assets/sample-data.js npm test
```

Le ZIP original complet a été conservé dans `.private/GBtoR365/`, ignoré par Git et Vercel. Il n’est pas requis par la suite de tests publique. Pour consulter sa version autonome, ouvrir `.private/GBtoR365/GBtoR365-preview.html` localement ; ne pas servir la racine du dépôt.

La vérification navigateur optionnelle nécessite Playwright et Chrome :

```sh
npm install --no-save --package-lock=false playwright
npm run test:auth-browser
```

Avec une installation Playwright existante, utiliser `PLAYWRIGHT_MODULE=/chemin/vers/playwright npm run test:auth-browser`. Les vérifications authentifiées distantes utilisent `BASE_URL` et une entrée standard masquée ; voir `docs/AUTHENTICATION.md`. Les captures et fichiers de test fictifs restent dans `artifacts/`.

## Parcours et limites

Navigation, recherche, pagination, détail des répartitions, quatre semaines de journaux, contrôles en centimes, revue des exceptions, approbation simulée, téléchargement CSV et historique de session. Les imports CSV/TSV/TXT utilisent les colonnes R365 ; XLSX lit les feuilles JE OOXML compatibles et leurs valeurs enregistrées, sans recalcul de formules. Limites : 10 Mo par fichier, 20 000 lignes et décompression bornée. XLS ancien et classeurs chiffrés non pris en charge.

Les totaux d’en-tête AP ne sont comptés qu’une fois par facture. Les rapprochements restent indépendants par facture et numéro de journal. Les identifiants texte, suffixes, zéros initiaux, signes négatifs et commentaires restent conservés. Les points de revue ne sont jamais corrigés automatiquement. La règle de compte `0092-55120000 → 55120` reste bornée au format documenté ; le lien `0092 → EGG70` reste à confirmer.

Aucun envoi à GlobalBake ou R365. Le téléchargement `PREVIEW.csv` ne prouve aucun import. Lots importés, décisions et historique sont en mémoire et disparaissent au rechargement. Seule la langue est mémorisée lorsque le navigateur le permet. La détection de doublon porte sur le lot actif.

## Hébergement

Démo publiée : **https://gbtor365.vercel.app**. Les sept écrans et l’affichage mobile ont été vérifiés sur cette URL.

Projet Vercel distinct `gbtor365`, dossier servi : `dist/`, installation et compilation de l’interface désactivées. Une fonction Node traite toutes les routes et vérifie la session avant de servir le portail ou ses données. `vercel.json` suit la [configuration officielle Vercel](https://vercel.com/docs/project-configuration/vercel-json). Publication par CLI après tests :

```sh
vercel link --yes --project gbtor365 --scope olivier-steineur
vercel deploy --prod --yes
```

`.private/`, `.env*`, artefacts et documents ne sont pas envoyés par la CLI. Le portail demande une connexion administrateur. Les données restent fictives ; `noindex` reste un réglage de référencement distinct du contrôle d’accès serveur. Le domaine envisagé `gbtor365.artimexbakery.com` n’est pas configuré par cette reprise.

Voir [l’audit des sources](docs/SOURCE_AUDIT.md), [le brief](CODEX_BRIEF.md) et [le plan de production](docs/IMPLEMENTATION_PLAN.md).
