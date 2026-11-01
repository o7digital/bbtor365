# GBtoR365 — état opérationnel

Le portail est passé du prototype au dépôt et traitement de CSV côté serveur. Aucun jeu de factures n’est préchargé. Sources de développement : `dist/`, `server/`, `api/`, `ops/` ; voir `README.md`, `docs/REAL_WORKFLOW_DELIVERY.md` et `docs/OPERATIONS.md`.

Le parcours est : génération manuelle du rapport GlobalBake par Rosa/Jorge → obtention du CSV → dépôt dans le portail → mapping réutilisé → contrôles → revue nominative → approbation → export CSV. L’envoi vers R365 TEST est une action distincte qui reste bloquée tant que les accès et opérations API ne sont pas documentés.

Les fichiers sources, empreintes, auteurs, périodes, versions de mapping, contrôles, décisions et audits sont persistants dans une base SQLite dédiée sur VPS1. Les données EGG Order, CRM et e-commerce ne sont pas partagées.

Les deux mappings initiaux acceptent le format R365 déjà préparé fourni comme référence. Les fichiers AP0001 et G/L bruts et leurs règles complètes restent requis pour certifier les convertisseurs des exports GlobalBake. Aucune règle d’import ni correspondance de localisation non validée n’est inventée.

Les sept comptes conservent leurs identifiants et droits : administration, supervision financière, revue/export, préparation et trois accès en consultation. Aucun email envoyé automatiquement. Les permissions des opérations métier sont contrôlées côté serveur.

Les critères comptables restent : rapprochements indépendants par facture/journal, en-tête AP compté une seule fois, identifiants texte et zéros initiaux, signes et commentaires conservés, erreurs non compensables globalement, revues des négatifs/périodes/localisations et des documents déjà rencontrés. Une nouvelle version de traitement invalide les décisions antérieures sans remplacer l’original.

Aucune transmission comptable de production. Un export généré n’est pas un import R365 confirmé. Les développements dépendants de GlobalBake et R365 sont détaillés dans `docs/IMPLEMENTATION_PLAN.md`.
