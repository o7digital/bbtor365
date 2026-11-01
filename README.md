# GBtoR365 · Artimex

Portail authentifié **GlobalBake → Restaurant365** : chargement manuel de rapports CSV, mappings versionnés et réutilisables, contrôles comptables côté serveur, revue et approbation nominatives, export CSV et historique persistant.

Site : **https://gbtor365.vercel.app**. Le portail démarre sans facture ni journal préchargé. Les données affichées proviennent exclusivement des fichiers déposés par les utilisateurs. Les sept comptes existants et leurs droits sont conservés ; voir [l’authentification](docs/AUTHENTICATION.md).

L’identité Artimex, les couleurs crème/olive/cuivre, les langues anglais/espagnol et l’interface HTML/CSS/JavaScript sont conservées. EGG Order et l’e-commerce restent des applications distinctes.

## Parcours de travail

1. Rosa ou Jorge génère le rapport dans GlobalBake et récupère le CSV. La méthode d’obtention du CSV doit être confirmée avec Pam pour chaque rapport ; le portail ne collecte pas de fichiers par FTP.
2. Dans **Supplier invoices** ou **Sales journals**, choisir **Upload a CSV report**, le type de rapport/mapping et la période, puis déposer le fichier UTF-8.
3. Le serveur conserve les octets originaux, l’empreinte SHA-256, l’auteur, la période et la version du mapping. Il transforme les lignes et enregistre les contrôles. Un schéma inconnu reste enregistré en état bloqué avec ses diagnostics.
4. Exécuter **Validate batch**, puis documenter les points de revue : négatifs, commentaires de période, localisations multiples et documents potentiellement déjà présents.
5. Une personne autorisée approuve le lot, puis génère le CSV R365. Les décisions et le fichier généré sont enregistrés dans l’audit ; le téléchargement ne confirme pas un import R365.
6. L’envoi **R365 TEST** reste bloqué tant que l’instance, les accès et les opérations API d’écriture ne sont pas documentés et intégrés. Aucun envoi automatique ni connexion comptable de production.

## Mappings

Les deux modèles initiaux acceptent les colonnes **déjà préparées R365** : Vendor Transaction by Account et Journal Entry. Ils ne se présentent pas comme des convertisseurs AP0001 ou G/L bruts.

Un administrateur peut ajouter un type de rapport ou une version de mapping : association par nom d’en-tête, constantes, transformation de date ISO, montants en centimes, règle de compte documentée `0092-xxxxx000 → xxxxx`, filtre de lignes, correspondances explicites de codes et regroupement. Un code de correspondance inconnu ou des valeurs incompatibles avec le regroupement bloquent le lot.

Depuis un lot bloqué, **Configure from this source** utilise ses véritables en-têtes. Le mapping est contrôlé contre ce fichier avant enregistrement lorsqu’il sert de référence. Les versions existantes restent conservées. **Apply latest version** est une action explicite qui annule les anciennes validation, revue et approbation ; l’original n’est jamais remplacé.

La correspondance `0092 → EGG70` n’est pas supposée. Les comptes et localisations doivent être validés par l’équipe comptable. Les identifiants, suffixes, zéros initiaux, signes et commentaires restent du texte.

## Stockage et droits

Interface et API sur le projet Vercel `gbtor365`. Traitements dans `server/workflow.cjs`, accès dans `server/portal.cjs`, persistance par `server/store.cjs`.

Base SQLite **dédiée** sur VPS1, service Docker `gbtor365-store`, dossier privé `/srv/gbtor365-db/`. Accès HTTPS authentifié réservé à l’API Vercel ; aucune base ni fichier original dans les assets. Voir [l’exploitation et les sauvegardes](docs/OPERATIONS.md).

Les contrôles d’autorisation sont vérifiés côté serveur pour le dépôt, le mapping, la validation, la revue, l’approbation et la génération CSV. Les comptes en consultation ne peuvent pas effectuer ces mutations. Les mises à jour sont atomiques avec contrôle de version : un écran périmé reçoit un conflit.

Un fichier identique, même renommé, ouvre le lot existant. Les mêmes références comptables dans des fichiers différents déclenchent un point de revue persistant ; la règle métier des corrections/avoirs et l’idempotence d’une transmission R365 devront être confirmées avec R365.

## Lancement et vérification

Node.js récent et Python 3, sans dépendance applicative à installer :

```sh
npm start
```

Ouvrir http://127.0.0.1:8080. Le terminal affiche un compte local temporaire. Le stockage local par défaut est `.private/local-workflow.sqlite3`, ignoré par Git. `GB_STORE_PATH` permet de choisir une autre base locale. Sur Vercel, aucune écriture dans un fichier temporaire n’est utilisée : l’absence du stockage HTTPS provoque un blocage explicite.

```sh
npm test
npm run check
npm run build
```

Les 25 tests couvrent les contrôles historiques, l’authentification et les rôles, les originaux immuables, les doublons, les mappings et leurs versions, les revues, approbations, exports et conflits. Le packaging produit `artifacts/GBtoR365_Artimex_Code.zip` avec le backend et les scripts d’exploitation ; il ne produit plus de maquette autonome hors ligne.

Avec Playwright et Chrome disponibles :

```sh
PLAYWRIGHT_MODULE=/chemin/vers/playwright npm run test:workflow-browser
```

Ce test utilise une base locale temporaire. `GB_REAL_AP` et `GB_REAL_JE` permettent de vérifier les fichiers reçus en local sans les déposer sur le site. Les fixtures fictives sont uniquement dans `tests/`, jamais servies ni chargées par le portail.

## Limites et dépendances externes

CSV UTF-8 jusqu’à 2 Mo, 20 000 lignes et 100 colonnes ; sortie JSON transformée jusqu’à 2,5 Mo. Cette limite permet de conserver un dépôt et un téléchargement compatibles avec les [limites Vercel](https://vercel.com/docs/functions/limitations). Les classeurs XLSX ne sont pas déposés dans ce nouveau parcours : utiliser un CSV extrait du rapport selon la méthode confirmée. L’outil d’extraction JE de référence est réservé aux tests privés du classeur préparé reçu.

Il manque les exports GlobalBake bruts complets AP0001/G/L et leurs règles validées pour certifier les premiers convertisseurs métier ; l’API R365 TEST exige également son contrat d’écriture et ses accès. Le portail ne fabrique aucun endpoint et ne marque aucun lot comme importé. Le domaine `gbtor365.artimexbakery.com` n’est pas rattaché.

Voir [le rapport de livraison](docs/REAL_WORKFLOW_DELIVERY.md), [les sources](docs/SOURCE_AUDIT.md) et [le plan restant](docs/IMPLEMENTATION_PLAN.md).
