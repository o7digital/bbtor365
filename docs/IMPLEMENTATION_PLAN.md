# Plan d’implémentation — GBtoR365

La reprise conserve le prototype comptable, désormais protégé par un accès administrateur initial ; voir `AUTHENTICATION.md`. Les étapes suivantes nécessitent une validation métier et des fichiers complets ; aucune règle comptable manquante n’est déduite du mockup.

## 1. Valider les parcours et réunir les sources

Faire valider les écrans et responsabilités par la revue comptable, la préparation des ventes, la supervision financière et l’administration. Les personnes proposées et leurs adresses restent dans le brief original local `.private/GBtoR365/CODEX_BRIEF.md` ; un compte administrateur initial existe, les autres comptes restent à créer.

Obtenir : AP0001 brut complet ; G/L Transaction Report brut ; classeur de ventes original ; exemples R365 acceptés/rejetés ; correspondances fournisseurs, clients, comptes et localisations validées ; traitement des avoirs/corrections ; formats de date ; modalités d’export GlobalBake ; documentation des accès et capacités d’import R365, avec un environnement de test.

Livrable attendu : contrat de données versionné avec exemples et critères d’acceptation signés. La correspondance `0092 → EGG70` est bloquée jusqu’à confirmation ; les localisations comptables ne sont pas les noms des restaurants EGG.

## 2. Construire le socle persistant

Choisir l’hébergement du backend et le fournisseur d’identité après clarification des accès de l’équipe. Contrôler les droits côté serveur : préparation, revue/export, supervision et administration. Définir les droits exacts et l’éventuelle séparation préparation/approbation avec l’équipe.

Stocker les originaux immuables avec empreinte, auteur, date et taille ; lots et versions ; documents et lignes ; contrôles ; décisions de revue ; exports ; tentatives de transfert ; confirmations ; journal d’audit. Définir accès, rétention et sauvegardes. Conserver les secrets côté serveur.

Critères : refus serveur pour un utilisateur sans droit, lecture limitée aux lots autorisés, audit durable et récupération après fermeture de session. Le sélecteur de profil actuel ne sera pas réutilisé comme authentification.

## 3. Correspondances et convertisseurs

Versionner les correspondances validées et figer leur version sur chaque lot. Construire des parseurs AP0001 et G/L uniquement après réception des originaux. Conserver les lignes originales et les raisons d’exclusion ; produire un diagnostic précis par ligne et des sorties reproductibles.

Pour AP, compter l’en-tête une fois et rapprocher chaque facture de ses répartitions. Pour les ventes, appliquer le filtre Sale validé, grouper selon le contrat métier et rapprocher chaque journal en centimes, puis les localisations si confirmé. Préserver identifiants, signes et commentaires. Toute correction exige un avant/après et une décision nominative ; toute nouvelle version invalide son approbation.

Critères : lots privés de référence rapprochés ; cas d’erreurs qui se compensent globalement toujours bloqués ; formats inconnus rejetés avec diagnostic.

## 4. Doublons et corrections

Confirmer la clé métier (candidate AP : entité + fournisseur + numéro) et les règles d’avoirs/corrections. Ajouter empreintes, contraintes uniques et clés d’idempotence persistantes. Distinguer doublon exact, version corrigée et document métier déjà importé. Vérifier la réception après un délai réseau avant de réessayer.

Critères : import identique, version corrigée, rejet partiel et état de réception inconnu couverts par des tests d’intégration ; reprise après incident sans nouvel enregistrement comptable.

## 5. Valider dans R365 de test, puis connecter

Faire accepter et rapprocher les fichiers cibles dans R365 de test. Confirmer les capacités réelles avec la documentation fournie ; aucun endpoint ni comportement d’import n’est supposé. Conserver identifiants externes et accusés de réception.

États explicites : préparé → validé → approuvé → fichier généré → transmis → import confirmé/rejeté/à vérifier. Un téléchargement reste « fichier généré ». Toute mise en production comptable est une phase distincte après validation des résultats de test.

## 6. Domaine et exploitation

Confirmer le contrôle DNS de `gbtor365.artimexbakery.com` avant de le rattacher au projet dédié. Ajouter planification, reprise et notifications après décision de l’équipe. Les projets EGG Order, e-commerce et leurs configurations restent hors périmètre.
