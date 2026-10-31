# Sources, confidentialité et jeu de démonstration

Le ZIP GBtoR365 fourni contient des extraits de documents comptables réels. Avant toute publication dans le dépôt GitHub public, une copie intégrale des 16 fichiers originaux a été conservée localement dans `.private/GBtoR365/`. Son `docs/SOURCE_AUDIT.md` conserve les chiffres de référence, observations par ligne et noms des documents d’origine. Ce dossier est exclu de Git, de Vercel et du packaging portable.

Le prototype reçu a passé ses 11 tests avant modification. Les mêmes invariants, plus le contrôle des montants invalides, sont vérifiés avec les extraits privés via `GB_SAMPLE_DATA`. Les originaux AP0001, G/L, CSV et classeur de 96 feuilles cités dans le brief ne sont pas inclus dans le ZIP : seuls les extraits JavaScript et la maquette autonome sont disponibles.

## Jeu public indépendant

`scripts/generate-demo.cjs` construit des données entièrement fictives sans lire les sources privées. Codes fournisseurs `DEMO…`, factures avec suffixe `DM`, localisations `DEMO70` à `DEMO73`, clients fictifs et profils `example.com`. Les montants sont calculés à partir de constantes de démonstration, sans reprendre les valeurs réelles.

| Lot fictif | Factures/références | Lignes | Lignes JE non nulles | Montant USD |
| --- | ---: | ---: | ---: | ---: |
| Fournisseurs | 39 (24 fournisseurs) | 79 répartitions | — | 9 986,21 |
| Ventes 19–25 octobre | 53 | 62 | 60 | Débit = crédit : 2 075,20 |
| Ventes 12–18 octobre | 47 | 56 | 54 | Débit = crédit : 1 814,09 |
| Ventes 5–11 octobre | 41 | 50 | 48 | Débit = crédit : 1 558,26 |
| Ventes 1–4 octobre | 21 | 30 | 28 | Débit = crédit : 653,56 |

La première facture fictive a quatre répartitions. La première semaine fictive comprend deux écritures négatives de -12,34 USD et neuf commentaires d’une autre période, volontairement conservés pour vérifier la revue. La troisième semaine comporte plusieurs localisations fictives. Ce sont des scénarios de démonstration, sans valeur comptable.

L’identité graphique et le logo Artimex du ZIP sont conservés. La règle `0092-55120000 → 55120` et l’hypothèse de localisation `0092 → EGG70` restent affichées comme éléments documentés à confirmer, sans conversion implicite.

## Limites de vérification

Les parcours navigateur XLSX sont vérifiés avec un classeur OOXML fictif de quatre feuilles, généré par `scripts/demo-imports.py` dans `artifacts/`. Il utilise les colonnes JE N:X et l’en-tête en ligne 5. Le classeur original de 96 feuilles n’a pas été reçu et ne peut donc pas être retesté ici.

Aucun test d’import dans R365, aucune transmission comptable, aucun compte réel ni invitation. Les prochaines dépendances figurent dans le plan d’implémentation.
